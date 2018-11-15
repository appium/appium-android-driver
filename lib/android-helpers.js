import _ from 'lodash';
import path from 'path';
import { exec } from 'teen_process';
import { retry, retryInterval } from 'asyncbox';
import logger from './logger';
import { fs } from 'appium-support';
import { path as settingsApkPath } from 'io.appium.settings';
import Bootstrap from './bootstrap';
import B from 'bluebird';
import ADB from 'appium-adb';
import { default as unlocker, PIN_UNLOCK, PASSWORD_UNLOCK,
         PATTERN_UNLOCK, FINGERPRINT_UNLOCK } from './unlock-helpers';


const PACKAGE_INSTALL_TIMEOUT = 90000; // milliseconds
const CHROME_BROWSER_PACKAGE_ACTIVITY = {
  chrome: {
    pkg: 'com.android.chrome',
    activity: 'com.google.android.apps.chrome.Main',
  },
  chromium: {
    pkg: 'org.chromium.chrome.shell',
    activity: '.ChromeShellActivity',
  },
  chromebeta: {
    pkg: 'com.chrome.beta',
    activity: 'com.google.android.apps.chrome.Main',
  },
  browser: {
    pkg: 'com.android.browser',
    activity: 'com.android.browser.BrowserActivity',
  },
  'chromium-browser': {
    pkg: 'org.chromium.chrome',
    activity: 'com.google.android.apps.chrome.Main',
  },
  'chromium-webview': {
    pkg: 'org.chromium.webview_shell',
    activity: 'org.chromium.webview_shell.WebViewBrowserActivity',
  },
  default: {
    pkg: 'com.android.chrome',
    activity: 'com.google.android.apps.chrome.Main',
  },
};
const SETTINGS_HELPER_PKG_ID = 'io.appium.settings';
const SETTINGS_HELPER_MAIN_ACTIVITY = '.Settings';
const SETTINGS_HELPER_UNLOCK_ACTIVITY = '.Unlock';

let helpers = {};

helpers.createBaseADB = async function (opts = {}) {
  // filter out any unwanted options sent in
  // this list should be updated as ADB takes more arguments
  const {
    javaVersion,
    adbPort,
    suppressKillServer,
    remoteAdbHost,
    clearDeviceLogsOnStart,
    adbExecTimeout,
    useKeystore,
    keystorePath,
    keystorePassword,
    keyAlias,
    keyPassword,
  } = opts;
  return await ADB.createADB({
    javaVersion,
    adbPort,
    suppressKillServer,
    remoteAdbHost,
    clearDeviceLogsOnStart,
    adbExecTimeout,
    useKeystore,
    keystorePath,
    keystorePassword,
    keyAlias,
    keyPassword,
  });
};

helpers.parseJavaVersion = function (stderr) {
  let lines = stderr.split("\n");
  for (let line of lines) {
    if (new RegExp(/(java|openjdk) version/).test(line)) {
      return line.split(" ")[2].replace(/"/g, '');
    }
  }
  return null;
};

helpers.getJavaVersion = async function (logVersion = true) {
  let {stderr} = await exec('java', ['-version']);
  let javaVer = helpers.parseJavaVersion(stderr);
  if (javaVer === null) {
    throw new Error("Could not get the Java version. Is Java installed?");
  }
  if (logVersion) {
    logger.info(`Java version is: ${javaVer}`);
  }
  return javaVer;
};

helpers.prepareEmulator = async function (adb, opts) {
  let {
    avd,
    avdArgs,
    language,
    locale,
    avdLaunchTimeout,
    avdReadyTimeout,
  } = opts;
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

/**
 * Set and ensure the locale name of the device under test.
 *
 * @param {Object} adb - The adb module instance.
 * @param {string} language - Language. The language field is case insensitive, but Locale always canonicalizes to lower case.
 *                            format: [a-zA-Z]{2,8}. e.g. en, ja : https://developer.android.com/reference/java/util/Locale.html
 * @param {string} country - Country. The country (region) field is case insensitive, but Locale always canonicalizes to upper case.
 *                            format: [a-zA-Z]{2} | [0-9]{3}. e.g. US, JP : https://developer.android.com/reference/java/util/Locale.html
 * @param {?string} script - Script. The script field is case insensitive but Locale always canonicalizes to title case.
 *                            format: [a-zA-Z]{4}. e.g. Hans in zh-Hans-CN : https://developer.android.com/reference/java/util/Locale.html
 * @throws {Error} If it failed to set locale properly
 */
helpers.ensureDeviceLocale = async function (adb, language, country, script = null) {
  if (!_.isString(language) && !_.isString(country)) {
    logger.warn(`setDeviceLanguageCountry requires language or country.`);
    logger.warn(`Got language: '${language}' and country: '${country}'`);
    return;
  }

  await adb.setDeviceLanguageCountry(language, country, script);

  if (!await adb.ensureCurrentLocale(language, country, script)) {
    const message = script ? `language: ${language}, country: ${country} and script: ${script}` : `language: ${language} and country: ${country}`;
    throw new Error(`Failed to set ${message}`);
  }
};

helpers.getDeviceInfoFromCaps = async function (opts = {}) {
  // we can create a throwaway ADB instance here, so there is no dependency
  // on instantiating on earlier (at this point, we have no udid)
  // we can only use this ADB object for commands that would not be confused
  // if multiple devices are connected
  const adb = await helpers.createBaseADB(opts);
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
        logger.errorAndThrow(`Device ${udid} was not in the list of connected devices`);
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
          `with OS ${opts.platformVersion}. The following are available: ` + availDevicesStr.join(', '));
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
helpers.createADB = async function (opts = {}) {
  const {udid, emPort} = opts;
  const adb = await helpers.createBaseADB(opts);
  adb.setDeviceId(udid);
  if (emPort) {
    adb.setEmulatorPort(emPort);
  }

  return adb;
};

helpers.validatePackageActivityNames = function (opts) {
  for (const key of ['appPackage', 'appActivity', 'appWaitPackage', 'appWaitActivity']) {
    const name = opts[key];
    if (!name) {
      continue;
    }

    const match = /([^\w.*,])+/.exec(name);
    if (!match) {
      continue;
    }

    logger.warn(`Capability '${key}' is expected to only include latin letters, digits, underscore, dot, comma and asterisk characters.`);
    logger.warn(`Current value '${name}' has non-matching character at index ${match.index}: '${name.substring(0, match.index + 1)}'`);
  }
};

helpers.getLaunchInfo = async function (adb, opts) {
  let {app, appPackage, appActivity, appWaitPackage, appWaitActivity} = opts;
  if (!app) {
    logger.warn("No app sent in, not parsing package/activity");
    return;
  }

  this.validatePackageActivityNames(opts);

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
  const {
    app,
    appPackage,
    fastReset,
    fullReset,
    androidInstallTimeout = PACKAGE_INSTALL_TIMEOUT,
    autoGrantPermissions,
    allowTestPackages
  } = opts;

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
    timeout: androidInstallTimeout,
    allowTestPackages,
  });
};

helpers.installApk = async function (adb, opts = {}) {
  const {
    app,
    appPackage,
    fastReset,
    fullReset,
    androidInstallTimeout = PACKAGE_INSTALL_TIMEOUT,
    autoGrantPermissions,
    allowTestPackages
  } = opts;

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
    timeout: androidInstallTimeout,
    allowTestPackages,
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
    autoGrantPermissions,
    allowTestPackages
  } = opts;

  // Install all of the APK's asynchronously
  await B.all(otherApps.map((otherApp) => {
    logger.debug(`Installing app: ${otherApp}`);
    return adb.installOrUpgrade(otherApp, null, {
      grantPermissions: autoGrantPermissions,
      timeout: androidInstallTimeout,
      allowTestPackages,
    });
  }));
};

helpers.initUnicodeKeyboard = async function (adb) {
  logger.debug('Enabling Unicode keyboard support');

  // get the default IME so we can return back to it later if we want
  let defaultIME = await adb.defaultIME();

  logger.debug(`Unsetting previous IME ${defaultIME}`);
  const appiumIME = `${SETTINGS_HELPER_PKG_ID}/.UnicodeIME`;
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

  if (await adb.getApiLevel() < 23) { // Android 6- devices should have granted permissions
    // https://github.com/appium/appium/pull/11640#issuecomment-438260477
    logger.info('Granting android.permission.SET_ANIMATION_SCALE, CHANGE_CONFIGURATION, ACCESS_FINE_LOCATION by pm grant');
    await adb.grantPermissions(SETTINGS_HELPER_PKG_ID, [
      'android.permission.SET_ANIMATION_SCALE',
      'android.permission.CHANGE_CONFIGURATION',
      'android.permission.ACCESS_FINE_LOCATION'
    ]);
  }

  // launch io.appium.settings app due to settings failing to be set
  // if the app is not launched prior to start the session on android 7+
  // see https://github.com/appium/appium/issues/8957
  try {
    await adb.startApp({
      pkg: SETTINGS_HELPER_PKG_ID,
      activity: SETTINGS_HELPER_MAIN_ACTIVITY,
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

/**
 * Extracts string.xml and converts it to string.json and pushes
 * it to /data/local/tmp/string.json on for use of bootstrap
 * If app is not present to extract string.xml it deletes remote strings.json
 * If app does not have strings.xml we push an empty json object to remote
 *
 * @param {?string} language - Language abbreviation, for example 'fr'. The default language
 * is used if this argument is not defined.
 * @param {Object} adb - The adb module instance.
 * @param {Object} opts - Driver options dictionary.
 * @returns {Object} The dictionary, where string resource identifiers are keys
 * along with their corresponding values for the given language or an empty object
 * if no matching resources were extracted.
 */
helpers.pushStrings = async function (language, adb, opts) {
  const remoteDir = '/data/local/tmp';
  const stringsJson = 'strings.json';
  const remoteFile = path.posix.resolve(remoteDir, stringsJson);

  // clean up remote string.json if present
  await adb.rimraf(remoteFile);

  let app;
  try {
    app = opts.app || await adb.pullApk(opts.appPackage, opts.tmpDir);
  } catch (err) {
    logger.info(`Failed to pull an apk from '${opts.appPackage}' to '${opts.tmpDir}'. Original error: ${err.message}`);
  }

  if (_.isEmpty(opts.appPackage) || !(await fs.exists(app))) {
    logger.debug(`No app or package specified. Returning empty strings`);
    return {};
  }

  const stringsTmpDir = path.resolve(opts.tmpDir, opts.appPackage);
  try {
    logger.debug('Extracting strings from apk', app, language, stringsTmpDir);
    const {apkStrings, localPath} = await adb.extractStringsFromApk(app, language, stringsTmpDir);
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

  // Unlock succeed with a couple of retries.
  let firstRun = true;
  await retry(3, async function () {
    // To reduce a time to call adb.isScreenLocked() since `adb shell dumpsys window` is easy to hang adb commands
    if (firstRun) {
      firstRun = false;
    } else {
      try {
        if (!(await adb.isScreenLocked())) {
          return;
        }
      } catch (e) {
        logger.warn(`Error in isScreenLocked: ${e.message}`);
        logger.warn("\"adb shell dumpsys window\" command has timed out.");
        logger.warn("The reason of this timeout is the delayed adb response. Resetting adb server can improve it.");
      }
    }

    logger.info(`Launching ${SETTINGS_HELPER_UNLOCK_ACTIVITY}`);
    await adb.shell([
      'am', 'start',
      '-n', `${SETTINGS_HELPER_PKG_ID}/${SETTINGS_HELPER_UNLOCK_ACTIVITY}`,
      '-c', 'android.intent.category.LAUNCHER',
      '-a', 'android.intent.action.MAIN',
      '-f', '0x10200000',
    ]);
    await B.delay(1000);
  });
};

helpers.unlock = async function (driver, adb, capabilities) {
  if (!(await adb.isScreenLocked())) {
    logger.info("Screen already unlocked, doing nothing");
    return;
  }

  logger.debug("Screen is locked, trying to unlock");
  if (_.isUndefined(capabilities.unlockType)) {
    logger.warn("Using app unlock, this is going to be deprecated!");
    await helpers.unlockWithHelperApp(adb);
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
  // pushSettingsApp required before calling ensureDeviceLocale for API Level 24+
  await helpers.pushSettingsApp(adb);
  if (!opts.avd) {
    await helpers.setMockLocationApp(adb, SETTINGS_HELPER_PKG_ID);
  }

  await helpers.ensureDeviceLocale(adb, opts.language, opts.locale, opts.localeScript);
  await adb.startLogcat();
  if (opts.unicodeKeyboard) {
    return await helpers.initUnicodeKeyboard(adb);
  }
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
  return _.includes(Object.keys(CHROME_BROWSER_PACKAGE_ACTIVITY), (browser || '').toLowerCase());
};

helpers.getChromePkg = function (browser) {
  return CHROME_BROWSER_PACKAGE_ACTIVITY[browser.toLowerCase()] || CHROME_BROWSER_PACKAGE_ACTIVITY.default;
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

helpers.validateDesiredCaps = function (caps) {
  // make sure that the capabilities have one of `app`, `appPackage` or `browser`
  if ((!caps.browserName || !this.isChromeBrowser(caps.browserName)) && !caps.app && !caps.appPackage) {
    logger.errorAndThrow('The desired capabilities must include either an app, appPackage or browserName');
  }
  if (caps.browserName) {
    if (caps.app) {
      // warn if the capabilities have both `app` and `browser, although this is common with selenium grid
      logger.warn(`The desired capabilities should generally not include both an 'app' and a 'browserName'`);
    }
    if (caps.appPackage) {
      logger.errorAndThrow(`The desired should not include both of an 'appPackage' and a 'browserName'`);
    }
  }

  return true;
};

helpers.bootstrap = Bootstrap;
helpers.unlocker = unlocker;

export { helpers };
export default helpers;
