import _ from 'lodash';
import path from 'path';
import { exec } from 'teen_process';
import { retryInterval } from 'asyncbox';
import logger from './logger';
import { fs } from 'appium-support';
import { path as unicodeIMEPath } from 'appium-android-ime';
import { path as settingsApkPath } from 'io.appium.settings';
import { path as unlockApkPath } from 'appium-unlock';
import Bootstrap from 'appium-android-bootstrap';
import B from 'bluebird';

import ADB from 'appium-adb';
import { default as unlocker, PIN_UNLOCK, PASSWORD_UNLOCK, PATTERN_UNLOCK, FINGERPRINT_UNLOCK } from './unlock-helpers';


const PACKAGE_INSTALL_TIMEOUT = 90000; // milliseconds
const CHROME_BROWSERS = ["Chrome", "Chromium", "Chromebeta", "Browser",
                         "chrome", "chromium", "chromebeta", "browser",
                         "chromium-browser", "chromium-webview"];
const SETTINGS_HELPER_PKG_ID = 'io.appium.settings';
const SETTINGS_HELPER_PKG_ACTIVITY = ".Settings";
const UNLOCK_HELPER_PKG_ID = 'io.appium.unlock';
const UNLOCK_HELPER_PKG_ACTIVITY = ".Unlock";

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
  avdArgs = this.prepareAVDArgs(opts, adb, avdArgs);
  await adb.launchAVD(avd, avdArgs, language, locale, avdLaunchTimeout,
                      avdReadyTimeout);
};

helpers.prepareAVDArgs = function (opts, adb, avdArgs) {
  let args = avdArgs ? [avdArgs] : [];
  if (!_.isUndefined(opts.networkSpeed)) {
    let networkSpeed = this.ensureNetworkSpeed(adb, opts.networkSpeed);
    args.push('-netspeed', networkSpeed);
  }
  if (opts.isHeadless) {
    args.push('-no-window');
  }
  return args.join(' ');
};

helpers.ensureNetworkSpeed = function (adb, networkSpeed) {
  if (_.values(adb.NETWORK_SPEED).indexOf(networkSpeed) !== -1) {
    return networkSpeed;
  }
  logger.warn(`Wrong network speed param ${networkSpeed}, using default: full. Supported values: ${_.values(adb.NETWORK_SPEED)}`);
  return adb.NETWORK_SPEED.FULL;
};

helpers.ensureDeviceLocale = async function (adb, language, country) {
  if (!_.isString(language) && !_.isString(country)) {
    logger.warn(`setDeviceLanguageCountry requires language or country.`);
    logger.warn(`Got language: '${language}' and country: '${country}'`);
    return;
  }

  await adb.setDeviceLanguageCountry(language, country);

  if (!await adb.ensureCurrentLocale(language, country)) {
    throw new Error(`Failed to set language: ${language} and country: ${country}`);
  }
};

helpers.getDeviceInfoFromCaps = async function (opts = {}) {
  // we can create a throwaway ADB instance here, so there is no dependency
  // on instantiating on earlier (at this point, we have no udid)
  // we can only use this ADB object for commands that would not be confused
  // if multiple devices are connected
  let adb = await ADB.createADB({
    javaVersion: opts.javaVersion,
    adbPort: opts.adbPort,
    remoteAdbHost: opts.remoteAdbHost,
    clearDeviceLogsOnStart: opts.clearDeviceLogsOnStart,
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
      if (!_.includes(_.map(devices, 'udid'), udid)) {
        logger.errorAndThrow(`Device ${udid} was not in the list ` +
                             `of connected devices`);
      }
      emPort = adb.getPortFromEmulatorString(udid);
    } else if (opts.platformVersion) {
      opts.platformVersion = `${opts.platformVersion}`.trim();

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
helpers.createADB = async function (javaVersion, udid, emPort, adbPort, suppressKillServer, remoteAdbHost, clearDeviceLogsOnStart) {
  let adb = await ADB.createADB({
    javaVersion,
    adbPort,
    suppressKillServer,
    remoteAdbHost,
    clearDeviceLogsOnStart,
  });

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

helpers.resetApp = async function (adb, opts = {}) {
  const {app, appPackage, fastReset, fullReset,
    androidInstallTimeout = PACKAGE_INSTALL_TIMEOUT,
    autoGrantPermissions} = opts;

  if (!appPackage) {
    throw new Error("'appPackage' option is required");
  }

  const isInstalled = await adb.isAppInstalled(appPackage);

  if (isInstalled) {
    try {
      await adb.forceStop(appPackage);
    } catch (ign) {}
    // fullReset has priority over fastReset
    if (!fullReset && fastReset) {
      const output = await adb.clear(appPackage);
      if (_.isString(output) && output.toLowerCase().includes('failed')) {
        throw new Error(`Cannot clear the application data of '${appPackage}'. Original error: ${output}`);
      }
      // executing `shell pm clear` resets previously assigned application permissions as well
      if (autoGrantPermissions) {
        try {
          await adb.grantAllPermissions(appPackage);
        } catch (error) {
          logger.error(`Unable to grant permissions requested. Original error: ${error.message}`);
        }
      }
      logger.debug(`Performed fast reset on the installed '${appPackage}' application (stop and clear)`);
      return;
    }
  }

  if (!app) {
    throw new Error("'app' option is required for reinstall");
  }

  logger.debug(`Running full reset on '${appPackage}' (reinstall)`);
  if (isInstalled) {
    await adb.uninstallApk(appPackage);
  }
  await adb.install(app, {
    grantPermissions: autoGrantPermissions,
    timeout: androidInstallTimeout
  });
};

helpers.installApk = async function (adb, opts = {}) {
  const {app, appPackage, fastReset, fullReset,
    androidInstallTimeout = PACKAGE_INSTALL_TIMEOUT,
    autoGrantPermissions} = opts;

  if (!app || !appPackage) {
    throw new Error("'app' and 'appPackage' options are required");
  }

  if (fullReset) {
    await this.resetApp(adb, opts);
    return;
  }

  // There is no need to reset the newly installed app
  const shouldPerformFastReset = fastReset && await adb.isAppInstalled(appPackage);

  await adb.installOrUpgrade(app, appPackage, {
    grantPermissions: autoGrantPermissions,
    timeout: androidInstallTimeout
  });

  if (shouldPerformFastReset) {
    logger.info(`Performing fast reset on '${appPackage}'`);
    await this.resetApp(adb, opts);
  }
};

/**
 * Installs an array of apks
 * @param {ADB} adb Instance of Appium ADB object
 * @param {Object} opts Opts defined in driver.js
 */
helpers.installOtherApks = async function (otherApps, adb, opts) {
  let {
    androidInstallTimeout = PACKAGE_INSTALL_TIMEOUT,
    autoGrantPermissions
  } = opts;

  // Install all of the APK's asynchronously
  await B.all(otherApps.map((otherApp) => {
    logger.debug(`Installing app: ${otherApp}`);
    return adb.installOrUpgrade(otherApp, null, {
      grantPermissions: autoGrantPermissions,
      timeout: androidInstallTimeout,
    });
  }));
};

helpers.initUnicodeKeyboard = async function (adb) {
  logger.debug('Enabling Unicode keyboard support');
  logger.debug("Pushing unicode ime to device...");
  await adb.install(unicodeIMEPath, {replace: false});

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
  try {
    if (await adb.getApiLevel() < 23) {
      await adb.shell(['settings', 'put', 'secure', 'mock_location', '1']);
    } else {
      await adb.shell(['appops', 'set', app, 'android:mock_location', 'allow']);
    }
  } catch (err) {
    logger.warn(`Unable to set mock location for app '${app}': ${err.message}`);
  }
};

helpers.installHelperApp = async function (adb, apkPath, packageId, appName) {
  try {
    await adb.installOrUpgrade(apkPath, packageId, {grantPermissions: true});
  } catch (err) {
    logger.warn(`Ignored error while installing Appium ${appName} helper: ` +
                `'${err.message}'. Manually uninstalling the application ` +
                `with package id '${packageId}' may help. Expect some Appium ` +
                `features may not work as expected unless this problem is ` +
                `fixed.`);
  }
};

helpers.pushSettingsApp = async function (adb, throwError = false) {
  logger.debug("Pushing settings apk to device...");

  await helpers.installHelperApp(adb, settingsApkPath, SETTINGS_HELPER_PKG_ID, 'Settings');

  // Reinstall will stop the settings helper process anyway, so
  // there is no need to continue if the application is still running
  if (await adb.processExists(SETTINGS_HELPER_PKG_ID)) {
    logger.debug(`${SETTINGS_HELPER_PKG_ID} is already running. ` +
                 `There is no need to reset its permissions.`);
    return;
  }

  // lauch io.appium.settings app due to settings failing to be set
  // if the app is not launched prior to start the session on android 7+
  // see https://github.com/appium/appium/issues/8957
  try {
    await adb.startApp({
      pkg: SETTINGS_HELPER_PKG_ID,
      activity: SETTINGS_HELPER_PKG_ACTIVITY,
      action: "android.intent.action.MAIN",
      category: "android.intent.category.LAUNCHER",
      flags: "0x10200000",
      stopApp: false,
    });
  } catch (err) {
    logger.warn(`Failed to launch settings app: ${err.message}`);
    if (throwError) {
      throw err;
    }
  }
};

helpers.pushUnlock = async function (adb) {
  logger.debug("Pushing unlock helper app to device...");

  await helpers.installHelperApp(adb, unlockApkPath, UNLOCK_HELPER_PKG_ID, 'Unlock');
};

/**
 * Extracts string.xml and converts it to string.json and pushes
 * it to /data/local/tmp/string.json on for use of bootstrap
 * If app is not present to extract string.xml it deletes remote strings.json
 * If app does not have strings.xml we push an empty json object to remote
 *
 * @param {?string} language - Language abbreviation, for example 'fr'. The default language
 * is used if this argument is not defined.
 * @param {Object} adb - The adb mofdule instance.
 * @param {Object} opts - Driver options dictionary.
 * @returns {Object} The dictionary, where string resourtces identifiers are keys
 * along with their corresponding values for the given language or an empty object
 * if no matching resources were extracted.
 */
helpers.pushStrings = async function (language, adb, opts) {
  const remoteDir = '/data/local/tmp';
  const stringsJson = 'strings.json';
  const remoteFile = `${remoteDir}/${stringsJson}`;

  // clean up remote string.json if present
  await adb.rimraf(remoteFile);

  if (_.isEmpty(opts.appPackage) || !(await fs.exists(opts.app))) {
    return {};
  }

  const stringsTmpDir = path.resolve(opts.tmpDir, opts.appPackage);
  try {
    logger.debug('Extracting strings from apk', opts.app, language, stringsTmpDir);
    const {apkStrings, localPath} = await adb.extractStringsFromApk(opts.app, language, stringsTmpDir);
    await adb.push(localPath, remoteDir);
    return apkStrings;
  } catch (err) {
    logger.warn(`Could not get strings, continuing anyway. Original error: ${err.message}`);
    await adb.shell('echo', [`'{}' > ${remoteFile}`]);
  } finally {
    await fs.rimraf(stringsTmpDir);
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

helpers.unlockWithHelperApp = async function (adb) {
  logger.info("Unlocking screen");
  await adb.forceStop(UNLOCK_HELPER_PKG_ID);
  // then start the app twice, as once is flakey
  let startOpts = {
    pkg: UNLOCK_HELPER_PKG_ID,
    activity: UNLOCK_HELPER_PKG_ACTIVITY,
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

  if (!opts.avd) {
    // pushSettingsApp required before calling ensureDeviceLocale for API Level 24+
    await helpers.pushSettingsApp(adb);
    await helpers.setMockLocationApp(adb, SETTINGS_HELPER_PKG_ID);
  }

  await helpers.ensureDeviceLocale(adb, opts.language, opts.locale);
  await adb.startLogcat();
  let defaultIME;
  if (opts.unicodeKeyboard) {
    defaultIME = await helpers.initUnicodeKeyboard(adb);
  }
  if (_.isUndefined(opts.unlockType)) {
    await helpers.pushUnlock(adb);
  }
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
  return _.includes(CHROME_BROWSERS, browser);
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

helpers.removeAllSessionWebSocketHandlers = async function (server, sessionId) {
  if (!server || !_.isFunction(server.getWebSocketHandlers)) {
    return;
  }

  const activeHandlers = await server.getWebSocketHandlers(sessionId);
  for (const pathname of _.keys(activeHandlers)) {
    await server.removeWebSocketHandler(pathname);
  }
};

/**
 * Takes a desired capability and tries to JSON.parse it as an array,
 * and either returns the parsed array or a singleton array.
 *
 * @param {any} cap A desired capability
 */
helpers.parseArray = function (cap) {
  let parsedCaps;
  try {
    parsedCaps = JSON.parse(cap);
  } catch (ign) { }

  if (_.isArray(parsedCaps)) {
    return parsedCaps;
  } else if (_.isString(cap)) {
    return [cap];
  }

  throw new Error(`must provide a string or JSON Array; received ${cap}`);
};

helpers.bootstrap = Bootstrap;
helpers.unlocker = unlocker;

export default helpers;
export { CHROME_BROWSERS };
