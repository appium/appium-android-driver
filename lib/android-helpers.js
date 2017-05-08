import _ from 'lodash';
import path from 'path';
import { exec } from 'teen_process';
import { retry, retryInterval } from 'asyncbox';
import logger from './logger';
import { fs } from 'appium-support';
import { path as unicodeIMEPath } from 'appium-android-ime';
import { path as settingsApkPath } from 'io.appium.settings';
import { path as unlockApkPath } from 'appium-unlock';
import Bootstrap from 'appium-android-bootstrap';
import ADB from 'appium-adb';
import { default as unlocker, PIN_UNLOCK, PASSWORD_UNLOCK, PATTERN_UNLOCK, FINGERPRINT_UNLOCK } from './unlock-helpers';

const REMOTE_TEMP_PATH = "/data/local/tmp";
const REMOTE_INSTALL_TIMEOUT = 90000; // milliseconds
const CHROME_BROWSERS = ["Chrome", "Chromium", "Chromebeta", "Browser",
                         "chrome", "chromium", "chromebeta", "browser",
                         "chromium-browser", "chromium-webview"];
const SETTINGS_HELPER_PKG_ID = 'io.appium.settings';

let helpers = {};

helpers.parseJavaVersion = function (stderr) {
  let lines = stderr.split("\n");
  for (let line of lines) {
    if (new RegExp(/(java|openjdk) version/).test(line)) {
      return line.split(" ")[2].replace(/"/g, '');
    }
  }
  return null;
};

helpers.getJavaVersion = async function () {
  logger.debug("Getting Java version");

  let {stderr} = await exec('java', ['-version']);
  let javaVer = helpers.parseJavaVersion(stderr);
  if (javaVer === null) {
    throw new Error("Could not get the Java version. Is Java installed?");
  }
  logger.info(`Java version is: ${javaVer}`);
  return javaVer;
};

helpers.prepareEmulator = async function (adb, opts) {
  let {avd, avdArgs, language, locale, avdLaunchTimeout,
       avdReadyTimeout} = opts;
  if (!avd) {
    throw new Error("Cannot launch AVD without AVD name");
  }
  let avdName = avd.replace('@', '');
  let runningAVD = await adb.getRunningAVD(avdName);
  if (runningAVD !== null) {
    if (avdArgs && avdArgs.toLowerCase().indexOf("-wipe-data") > -1) {
      logger.debug(`Killing '${avdName}' because it needs to be wiped at start.`);
      await adb.killEmulator(avdName);
    } else {
      logger.debug("Not launching AVD because it is already running.");
      return;
    }
  }
  await adb.launchAVD(avd, avdArgs, language, locale, avdLaunchTimeout,
                      avdReadyTimeout);
};

helpers.ensureDeviceLocale = async function (adb, language, country) {
  let haveLanguage = language && typeof language === "string";
  let haveCountry = country && typeof country === "string";
  if (!haveLanguage && !haveCountry) {
    return;
  }
  let changed = false;
  if (await adb.getApiLevel() < 23) {
    let curLanguage = await adb.getDeviceLanguage();
    let curCountry = await adb.getDeviceCountry();
    if (haveLanguage && language !== curLanguage) {
      await adb.setDeviceLanguage(language);
      changed = true;
    }
    if (haveCountry && country !== curCountry) {
      await adb.setDeviceCountry(country);
      changed = true;
    }
  } else { //API >= 23
    let curLocale = await adb.getDeviceLocale();
    let locale;
    if (!haveCountry) {
      locale = language.toLowerCase();
    } else if (!haveLanguage) {
      locale = country;
    } else {
      locale = `${language.toLowerCase()}-${country.toUpperCase()}`;
    }
    if (locale !== curLocale) {
      await adb.setDeviceLocale(locale);
      changed = true;
    }
  }
  if (changed) {
    await adb.reboot();
  }
};

helpers.getDeviceInfoFromCaps = async function (opts = {}) {
  // we can create a throwaway ADB instance here, so there is no dependency
  // on instantiating on earlier (at this point, we have no udid)
  // we can only use this ADB object for commands that would not be confused
  // if multiple devices are connected
  let adb = await ADB.createADB({
    javaVersion: opts.javaVersion,
    adbPort: opts.adbPort
  });
  let udid = opts.udid;
  let emPort = null;

  // a specific avd name was given. try to initialize with that
  if (opts.avd) {
    await helpers.prepareEmulator(adb, opts);
    udid = adb.curDeviceId;
    emPort = adb.emulatorPort;
  } else {
    // no avd given. lets try whatever's plugged in devices/emulators
    logger.info("Retrieving device list");
    let devices = await adb.getDevicesWithRetry();

    // udid was given, lets try to init with that device
    if (udid) {
      if (!_.contains(_.pluck(devices, 'udid'), udid)) {
        logger.errorAndThrow(`Device ${udid} was not in the list ` +
                             `of connected devices`);
      }
      emPort = adb.getPortFromEmulatorString(udid);
    } else if (opts.platformVersion) {
      // a platform version was given. lets try to find a device with the same os
      logger.info(`Looking for a device with Android '${opts.platformVersion}'`);

      // in case we fail to find something, give the user a useful log that has
      // the device udids and os versions so they know what's available
      let availDevicesStr = [];

      // first try started devices/emulators
      for (let device of devices) {
        // direct adb calls to the specific device
        await adb.setDeviceId(device.udid);
        let deviceOS = await adb.getPlatformVersion();

        // build up our info string of available devices as we iterate
        availDevicesStr.push(`${device.udid} (${deviceOS})`);

        // we do a begins with check for implied wildcard matching
        // eg: 4 matches 4.1, 4.0, 4.1.3-samsung, etc
        if (deviceOS.indexOf(opts.platformVersion) === 0) {
          udid = device.udid;
          break;
        }
      }

      // we couldn't find anything! quit
      if (!udid) {
        logger.errorAndThrow(`Unable to find an active device or emulator ` +
                             `with OS ${opts.platformVersion}. The following ` +
                             `are available: ` + availDevicesStr.join(', '));
      }

      emPort = adb.getPortFromEmulatorString(udid);
    } else {
      // a udid was not given, grab the first device we see
      udid = devices[0].udid;
      emPort = adb.getPortFromEmulatorString(udid);
    }
  }

  logger.info(`Using device: ${udid}`);
  return {udid, emPort};
};

// returns a new adb instance with deviceId set
helpers.createADB = async function (javaVersion, udid, emPort, adbPort, suppressKillServer) {
  let adb = await ADB.createADB({javaVersion, adbPort, suppressKillServer});

  adb.setDeviceId(udid);
  if (emPort) {
    adb.setEmulatorPort(emPort);
  }

  return adb;
};

helpers.getLaunchInfo = async function (adb, opts) {
  let {app, appPackage, appActivity, appWaitPackage, appWaitActivity} = opts;
  if (!app) {
    logger.warn("No app sent in, not parsing package/activity");
    return;
  }
  if (appPackage && appActivity) {
    return;
  }

  logger.debug("Parsing package and activity from app manifest");
  let {apkPackage, apkActivity} =
    await adb.packageAndLaunchActivityFromManifest(app);
  if (apkPackage && !appPackage) {
    appPackage = apkPackage;
  }
  if (!appWaitPackage) {
    appWaitPackage = appPackage;
  }
  if (apkActivity && !appActivity) {
    appActivity = apkActivity;
  }
  if (!appWaitActivity) {
    appWaitActivity = appActivity;
  }
  logger.debug(`Parsed package and activity are: ${apkPackage}/${apkActivity}`);
  return {appPackage, appWaitPackage, appActivity, appWaitActivity};
};

helpers.getRemoteApkPath = function (localApkMd5, androidInstallPath) {
  let remotePath = path.posix.join(androidInstallPath || REMOTE_TEMP_PATH, `${localApkMd5}.apk`);
  logger.info(`Remote apk path is ${remotePath}`);
  return remotePath;
};

helpers.resetApp = async function (adb, localApkPath, pkg, fastReset,
  androidInstallTimeout = REMOTE_INSTALL_TIMEOUT, androidInstallPath = REMOTE_TEMP_PATH) {
  if (fastReset) {
    logger.debug("Running fast reset (stop and clear)");
    await adb.stopAndClear(pkg);
  } else {
    logger.debug("Running old fashion reset (reinstall)");
    let apkMd5 = await fs.md5(localApkPath);
    let remotePath = helpers.getRemoteApkPath(apkMd5, androidInstallPath);
    if (!await adb.fileExists(remotePath)) {
      throw new Error("Can't run slow reset without a remote apk!");
    }
    await helpers.reinstallRemoteApk(adb, localApkPath, pkg, remotePath, androidInstallTimeout);
  }
};

helpers.reinstallRemoteApk = async function (adb, localApkPath, pkg,
                                             remotePath, androidInstallTimeout, tries = 2) {
  await retry(tries, async () => {
    try {
      // first do an uninstall of the package to make sure it's not there
      await adb.uninstallApk(pkg);
    } catch (e) {
      logger.warn("Uninstalling remote APK failed, maybe it wasn't installed");
    }
    try {
      await adb.installFromDevicePath(remotePath, {timeout: androidInstallTimeout});
    } catch (e) {
      logger.warn("Installing remote APK failed, going to uninstall and try " +
                  "again");
      // if remote install failed, remove ALL the apks and re-push ours
      // to the remote cache
      await helpers.removeRemoteApks(adb);
      await adb.push(localApkPath, remotePath);
      throw e; // throw an error to trigger the retry
    }
  });
};

helpers.installApkRemotely = async function (adb, opts) {
  let {app, appPackage, fastReset, androidInstallTimeout} = opts;

  if (!app || !appPackage) {
    throw new Error("'app' and 'appPackage' options are required");
  }

  let apkMd5 = await fs.md5(app);
  let remotePath = helpers.getRemoteApkPath(apkMd5, opts.androidInstallPath);
  let remoteApkExists = await adb.fileExists(remotePath);
  logger.debug("Checking if app is installed");
  let installed = await adb.isAppInstalled(appPackage);

  if (installed && remoteApkExists && fastReset) {
    logger.info("Apk is already on remote and installed, resetting");
    await helpers.resetApp(adb, app, appPackage, fastReset, androidInstallTimeout);
  } else if (!installed || (!remoteApkExists && fastReset)) {
    if (!installed) {
      logger.info("Apk is not yet installed");
    } else {
      logger.info("Apk was already installed but not from our remote path");
    }
    logger.info(`${installed ? 'Re' : ''}installing apk from remote`);
    await adb.mkdir(REMOTE_TEMP_PATH);
    logger.info("Clearing out any existing remote apks with the same hash");
    await helpers.removeRemoteApks(adb, [apkMd5]);
    if (!remoteApkExists) {
      // push from local to remote
      logger.info(`Pushing ${appPackage} to device. Will wait up to ${androidInstallTimeout} ` +
                  `milliseconds before aborting`);
      await adb.push(app, remotePath, {timeout: androidInstallTimeout});
    }

    // Next, install from the remote path. This can be flakey. If it doesn't
    // work, clear out any cached apks, re-push from local, and try again
    await helpers.reinstallRemoteApk(adb, app, appPackage, remotePath, androidInstallTimeout);
  }
};

helpers.removeRemoteApks = async function (adb, exceptMd5s = null) {
  logger.debug("Removing any old apks");
  if (exceptMd5s) {
    logger.debug(`Except ${JSON.stringify(exceptMd5s)}`);
  } else {
    exceptMd5s = [];
  }
  let apks = await adb.ls(`${REMOTE_TEMP_PATH}/*.apk`);
  if (apks.length < 1) {
    logger.debug("No apks to examine");
    return;
  }
  apks = apks.filter((apk) => {
    for (let md5 of exceptMd5s) {
      return apk.indexOf(md5) === -1;
    }
  });
  for (let apk of apks) {
    logger.info(`Will remove ${apk}`);
    await adb.shell(['rm', '-f', apk]);
  }
};

helpers.initUnicodeKeyboard = async function (adb) {
  logger.debug('Enabling Unicode keyboard support');
  logger.debug("Pushing unicode ime to device...");
  await adb.install(unicodeIMEPath, false);

  // get the default IME so we can return back to it later if we want
  let defaultIME = await adb.defaultIME();

  logger.debug(`Unsetting previous IME ${defaultIME}`);
  const appiumIME = 'io.appium.android.ime/.UnicodeIME';
  logger.debug(`Setting IME to '${appiumIME}'`);
  await adb.enableIME(appiumIME);
  await adb.setIME(appiumIME);
  return defaultIME;
};

helpers.setMockLocationApp = async function (adb, app) {
  if (parseInt(await adb.getApiLevel(), 10) < 23) {
    await adb.shell(['settings', 'put', 'secure', 'mock_location', '1']);
  } else {
    await adb.shell(['appops', 'set', app, 'android:mock_location', 'allow']);
  }
};

helpers.pushSettingsApp = async function (adb) {
  logger.debug("Pushing settings apk to device...");
  try {
    await adb.installOrUpgrade(settingsApkPath, SETTINGS_HELPER_PKG_ID);
  } catch (err) {
    logger.warn(`Ignored error while installing Appium Settings helper: "${err.message}". ` +
                `Expect some Appium features may not work as expected unless this problem is fixed.`);
  }
  try {
    await adb.grantAllPermissions(SETTINGS_HELPER_PKG_ID);
  } catch (err) {
    // errors are expected there, since the app contains non-changeable permissons
  }
};

helpers.pushUnlock = async function (adb) {
  logger.debug("Pushing unlock helper app to device...");
  await adb.install(unlockApkPath, false);
};

// pushStrings method extracts string.xml and converts it to string.json and pushes
// it to /data/local/tmp/string.json on for use of bootstrap
// if app is not present to extract string.xml it deletes remote strings.json
// if app does not have strings.xml we push an empty json object to remote
helpers.pushStrings = async function (language, adb, opts) {
  let remotePath = '/data/local/tmp';
  let stringsJson = 'strings.json';
  let stringsTmpDir = path.resolve(opts.tmpDir, opts.appPackage);
  try {
    logger.debug('Extracting strings from apk', opts.app, language, stringsTmpDir);
    let {apkStrings, localPath} = await adb.extractStringsFromApk(
          opts.app, language, stringsTmpDir);
    await adb.push(localPath, remotePath);
    return apkStrings;
  } catch (err) {
    if (!(await fs.exists(opts.app))) {
      // delete remote string.json if present
      await adb.rimraf(`${remotePath}/${stringsJson}`);
    } else {
      logger.warn("Could not get strings, continuing anyway");
      let remoteFile = `${remotePath}/${stringsJson}`;
      await adb.shell('echo', [`'{}' > ${remoteFile}`]);
    }
  }
  return {};
};

helpers.unlockWithUIAutomation = async function (driver, adb, unlockCapabilities) {
  let unlockType = unlockCapabilities.unlockType;
  if (!unlocker.isValidUnlockType(unlockType)) {
    throw new Error(`Invalid unlock type ${unlockType}`);
  }
  let unlockKey = unlockCapabilities.unlockKey;
  if (!unlocker.isValidKey(unlockType, unlockKey)) {
    throw new Error(`Missing unlockKey ${unlockKey} capability for unlockType ${unlockType}`);
  }
  const unlockMethod = {
    [PIN_UNLOCK]: unlocker.pinUnlock,
    [PASSWORD_UNLOCK]: unlocker.passwordUnlock,
    [PATTERN_UNLOCK]: unlocker.patternUnlock,
    [FINGERPRINT_UNLOCK]: unlocker.fingerprintUnlock
  }[unlockType];
  await unlockMethod(adb, driver, unlockCapabilities);
};

helpers.unlockWithHelperApp = async function(adb) {
  logger.info("Unlocking screen");
  await adb.forceStop('io.appium.unlock');
  // then start the app twice, as once is flakey
  let startOpts = {
    pkg: "io.appium.unlock",
    activity: ".Unlock",
    action: "android.intent.action.MAIN",
    category: "android.intent.category.LAUNCHER",
    flags: "0x10200000",
    stopApp: false
  };
  await adb.startApp(startOpts);
  await adb.startApp(startOpts);
};

helpers.unlock = async function (driver, adb, capabilities) {
  if (!(await adb.isScreenLocked())) {
    logger.info("Screen already unlocked, doing nothing");
    return;
  }
  if (_.isUndefined(capabilities.unlockType)) {
    // Leave the old unlock to avoid breaking existing tests
    await retryInterval(10, 1000, async () => {
      logger.debug("Screen is locked, trying to unlock");
      // check if it worked, twice
      logger.warn("Using app unlock, this is going to be deprecated!");
      await helpers.unlockWithHelperApp(adb);
      await helpers.verifyUnlock(adb);
    });
  } else {
    await helpers.unlockWithUIAutomation(driver, adb, {unlockType: capabilities.unlockType, unlockKey: capabilities.unlockKey});
    await helpers.verifyUnlock(adb);
  }
};

helpers.verifyUnlock = async function (adb) {
  await retryInterval(2, 1000, async () => {
    if (await adb.isScreenLocked()) {
      throw new Error("Screen did not unlock successfully, retrying");
    }
    logger.debug("Screen unlocked successfully");
  });
};

helpers.initDevice = async function (adb, opts) {
  await adb.waitForDevice();

  await helpers.ensureDeviceLocale(adb, opts.language, opts.locale);
  await adb.startLogcat();
  let defaultIME;
  if (opts.unicodeKeyboard) {
    defaultIME = await helpers.initUnicodeKeyboard(adb);
  }
  if (!opts.avd) {
    await helpers.pushSettingsApp(adb);
  }
  if (_.isUndefined(opts.unlockType)) {
    await helpers.pushUnlock(adb);
  }
  await helpers.setMockLocationApp(adb, 'io.appium.settings');
  return defaultIME;
};

helpers.removeNullProperties = function (obj) {
  for (let key of _.keys(obj)) {
    if (_.isNull(obj[key]) || _.isUndefined(obj[key])) {
      delete obj[key];
    }
  }
};

helpers.truncateDecimals = function (number, digits) {
  let multiplier = Math.pow(10, digits),
      adjustedNum = number * multiplier,
      truncatedNum = Math[adjustedNum < 0 ? 'ceil' : 'floor'](adjustedNum);

  return truncatedNum / multiplier;
};

helpers.isChromeBrowser = function (browser) {
  return _.contains(CHROME_BROWSERS, browser);
};

helpers.getChromePkg = function (browser) {
  let pkg, activity;

  browser = browser.toLowerCase();
  if (browser === "chromium") {
    pkg = "org.chromium.chrome.shell";
    activity = ".ChromeShellActivity";
  } else if (browser === "chromebeta") {
    pkg = "com.chrome.beta";
    activity = "com.google.android.apps.chrome.Main";
  } else if (browser === "browser") {
    pkg = "com.android.browser";
    activity = "com.android.browser.BrowserActivity";
  } else if (browser === "chromium-browser") {
    pkg = "org.chromium.chrome";
    activity = "com.google.android.apps.chrome.Main";
  } else if (browser === "chromium-webview") {
    pkg = "org.chromium.webview_shell";
    activity = "org.chromium.webview_shell.WebViewBrowserActivity";
  } else {
    pkg = "com.android.chrome";
    activity = "com.google.android.apps.chrome.Main";
  }
  return {pkg, activity};
};

helpers.bootstrap = Bootstrap;
helpers.unlocker = unlocker;

export default helpers;
export { CHROME_BROWSERS };
