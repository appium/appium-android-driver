import _ from 'lodash';
import path from 'path';
import { exec } from 'teen_process';
import { retry, retryInterval } from 'asyncbox';
import logger from './logger';
import { fs } from 'appium-support';
import { path as unicodeIMEPath } from 'appium-android-ime';
import { path as settingsApkPath } from 'io.appium.settings';
import { path as unlockApkPath } from 'appium-unlock';

const REMOTE_TEMP_PATH = "/data/local/tmp";
const REMOTE_INSTALL_TIMEOUT = 90000; // milliseconds
const CHROME_BROWSERS = ["Chrome", "Chromium", "Chromebeta", "Browser"];

let helpers = {};

helpers.parseJavaVersion = function (stderr) {
  let lines = stderr.split("\n");
  for (let line of lines) {
    if (new RegExp("java version").test(line)) {
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
    logger.debug("Not launching AVD because it is already running.");
    return;
  }
  await adb.launchAVD(avd, avdArgs, language, locale, avdLaunchTimeout,
                      avdReadyTimeout);
};

helpers.ensureDeviceLocale = async function (adb, language, locale) {
  let haveLanguage = language && typeof language === "string";
  let haveCountry = locale && typeof locale === "string";
  if (!haveLanguage && !haveCountry) {
    return;
  }
  let curLanguage = await adb.getDeviceLanguage();
  let country = await adb.getDeviceCountry();
  let changed = false;
  if (haveLanguage && language !== curLanguage) {
    await adb.setDeviceLanguage(language);
    changed = true;
  }
  if (haveCountry && locale !== country) {
    await adb.setDeviceCountry(locale);
    changed = true;
  }
  if (changed) {
    await adb.reboot();
  }
};

helpers.getActiveDevice = async function (adb, udid) {
  logger.info("Retrieving device list");
  let devices = await adb.getDevicesWithRetry();
  let deviceId = null, emPort = null;
  if (udid) {
    if (!_.contains(_.pluck(devices, 'udid'), udid)) {
      logger.errorAndThrow(`Device ${udid} was not in the list ` +
                           `of connected devices`);
    }
    deviceId = udid;
    emPort = adb.getPortFromEmulatorString(deviceId);
  } else {
    deviceId = devices[0].udid;
    emPort = adb.getPortFromEmulatorString(deviceId);
  }
  logger.info(`Found device: ${deviceId}`);
  return {deviceId, emPort};
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

helpers.getRemoteApkPath = function (localApkMd5) {
  let remotePath = path.resolve(REMOTE_TEMP_PATH, `${localApkMd5}.apk`);
  logger.info(`Remote apk path is ${remotePath}`);
  return remotePath;
};

helpers.resetApp = async function (adb, localApkPath, pkg, fastReset) {
  if (fastReset) {
    logger.debug("Running fast reset (stop and clear)");
    await adb.stopAndClear(pkg);
  } else {
    logger.debug("Running old fashion reset (reinstall)");
    let apkMd5 = await fs.md5(localApkPath);
    let remotePath = helpers.getRemoteApkPath(apkMd5, localApkPath);
    if (!await adb.fileExists(remotePath)) {
      throw new Error("Can't run slow reset without a remote apk!");
    }
    await helpers.reinstallRemoteApk(adb, localApkPath, pkg, remotePath);
  }
};

helpers.reinstallRemoteApk = async function (adb, localApkPath, pkg,
                                             remotePath, tries = 2) {
  await retry(tries, async () => {
    try {
      // first do an uninstall of the package to make sure it's not there
      await adb.uninstallApk(pkg);
    } catch (e) {
      logger.warn("Uninstalling remote APK failed, maybe it wasn't installed");
    }
    try {
      await adb.installFromDevicePath(remotePath, {timeout: 90000});
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

helpers.installApkRemotely = async function (adb, localApkPath, pkg, fastReset) {
  let installTimeout = REMOTE_INSTALL_TIMEOUT;

  let apkMd5 = await fs.md5(localApkPath);
  let remotePath = await helpers.getRemoteApkPath(apkMd5, localApkPath);
  let remoteApkExists = await adb.fileExists(remotePath);
  logger.debug("Checking if app is installed");
  let installed = await adb.isAppInstalled(pkg);

  if (installed && remoteApkExists && fastReset) {
    logger.info("Apk is already on remote and installed, resetting");
    await helpers.resetApp(adb, localApkPath, pkg, fastReset);
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
      logger.info(`Pushing ${pkg} to device. Will wait up to ${installTimeout} ` +
                  `milliseconds before aborting`);
      await adb.push(localApkPath, remotePath, {timeout: installTimeout});
    }

    // Next, install from the remote path. This can be flakey. If it doesn't
    // work, clear out any cached apks, re-push from local, and try again
    await helpers.reinstallRemoteApk(adb, localApkPath, pkg, remotePath);
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
  apks = apks.filter(apk => {
    for (let md5 of exceptMd5s) {
      return apk.indexOf(md5) === -1;
    }
  });
  for (let apk of apks) {
    logger.info(`Will remove ${apk}`);
    await adb.shell(['rm', apk]);
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

helpers.pushSettingsApp = async function (adb) {
  logger.debug("Pushing settings apk to device...");
  await adb.install(settingsApkPath, false);
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
    this.apkStrings[language] = apkStrings;
    await this.adb.push(localPath, remotePath);
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

helpers.unlock = async function (adb) {
  if (!(await adb.isScreenLocked())) {
    logger.info("Screen already unlocked, doing nothing");
    return;
  }
  logger.info("Unlocking screen");

  await retryInterval(10, 1000, async () => {
    logger.debug("Screen is locked, trying to unlock");
    await adb.startApp({
      pkg: "io.appium.unlock",
      activity: ".Unlock",
      action: "android.intent.action.MAIN",
      category: "android.intent.category.LAUNCHER",
      flags: "0x10200000"
    });
    if (!await adb.isScreenLocked()) {
      logger.debug("Screen unlocked successfully");
    } else {
      throw new Error("Screen did not unlock successfully, retrying");
    }
  });
};

helpers.initDevice = async function (adb, opts) {
  if (opts.avd) {
    await helpers.prepareEmulator(adb, opts);
  }
  let {deviceId, emPort} = await helpers.getActiveDevice(adb, opts.udid);
  adb.setDeviceId(deviceId);
  if (emPort) {
    adb.setEmulatorPort(emPort);
  }

  await adb.waitForDevice();
  await helpers.ensureDeviceLocale(adb, opts.language, opts.locale);
  await adb.startLogcat();
  let defaultIME;
  if (opts.unicodeKeyboard) {
    defaultIME = await helpers.initUnicodeKeyboard(adb);
  }
  await helpers.pushSettingsApp(adb);
  await helpers.pushUnlock(adb);
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
  let pkg, act;
  if (browser === "Chromium") {
    pkg = "org.chromium.chrome.shell";
    act = ".ChromeShellActivity";
  } else if (browser === "Chromebeta") {
    pkg = "com.chrome.beta";
    act = "com.google.android.apps.chrome.Main";
  } else if (browser === "Browser") {
    pkg = "com.android.browser";
    act = "com.android.browser.BrowserActivity";
  } else {
    pkg = "com.android.chrome";
    act = "com.google.android.apps.chrome.Main";
  }
  return {pkg, activity: act};
};

export default helpers;
export { CHROME_BROWSERS };
