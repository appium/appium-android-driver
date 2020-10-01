import _ from 'lodash';
import path from 'path';
import { retry, retryInterval } from 'asyncbox';
import logger from './logger';
import { fs, util } from 'appium-support';
import { path as settingsApkPath } from 'io.appium.settings';
import Bootstrap from './bootstrap';
import B from 'bluebird';
import ADB from 'appium-adb';
import {
  default as unlocker, PIN_UNLOCK, PASSWORD_UNLOCK,
  PATTERN_UNLOCK, FINGERPRINT_UNLOCK
} from './unlock-helpers';
import { EOL } from 'os';
import semver from 'semver';

const PACKAGE_INSTALL_TIMEOUT = 90000; // milliseconds
// https://cs.chromium.org/chromium/src/chrome/browser/devtools/device/android_device_info_query.cc
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
const SETTINGS_HELPER_UNLOCK_ACTIVITY = '.Unlock';
const EMULATOR_PATTERN = /\bemulator\b/i;


function ensureNetworkSpeed (adb, networkSpeed) {
  if (_.values(adb.NETWORK_SPEED).includes(networkSpeed)) {
    return networkSpeed;
  }
  logger.warn(`Wrong network speed param '${networkSpeed}', using default: ${adb.NETWORK_SPEED.FULL}. ` +
    `Supported values: ${_.values(adb.NETWORK_SPEED)}`);
  return adb.NETWORK_SPEED.FULL;
}

function prepareAvdArgs (adb, opts) {
  const {
    networkSpeed,
    isHeadless,
    avdArgs,
  } = opts;
  const result = [];
  if (avdArgs) {
    if (_.isArray(avdArgs)) {
      result.push(...avdArgs);
    } else {
      result.push(...(util.shellParse(`${avdArgs}`)));
    }
  }
  if (networkSpeed) {
    result.push('-netspeed', ensureNetworkSpeed(adb, networkSpeed));
  }
  if (isHeadless) {
    result.push('-no-window');
  }
  return result;
}


const helpers = {};

helpers.createBaseADB = async function createBaseADB (opts = {}) {
  // filter out any unwanted options sent in
  // this list should be updated as ADB takes more arguments
  const {
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
    remoteAppsCacheLimit,
    buildToolsVersion,
    allowOfflineDevices,
    allowDelayAdb,
  } = opts;
  return await ADB.createADB({
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
    remoteAppsCacheLimit,
    buildToolsVersion,
    allowOfflineDevices,
    allowDelayAdb,
  });
};

helpers.prepareEmulator = async function prepareEmulator (adb, opts) {
  const {
    avd,
    avdEnv: env,
    language,
    locale: country,
    avdLaunchTimeout: launchTimeout,
    avdReadyTimeout: readyTimeout,
  } = opts;
  if (!avd) {
    throw new Error('Cannot launch AVD without AVD name');
  }

  const avdName = avd.replace('@', '');
  const runningAVD = await adb.getRunningAVD(avdName);
  const args = prepareAvdArgs(adb, opts);
  if (runningAVD) {
    if (args.includes('-wipe-data')) {
      logger.debug(`Killing '${avdName}' because it needs to be wiped at start.`);
      await adb.killEmulator(avdName);
    } else {
      logger.debug('Not launching AVD because it is already running.');
      return;
    }
  }
  await adb.launchAVD(avd, {
    args,
    env,
    language,
    country,
    launchTimeout,
    readyTimeout,
  });
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
helpers.ensureDeviceLocale = async function ensureDeviceLocale (adb, language, country, script = null) {
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

helpers.getDeviceInfoFromCaps = async function getDeviceInfoFromCaps (opts = {}) {
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
    logger.info('Retrieving device list');
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
      const platformVersion = semver.coerce(opts.platformVersion) || opts.platformVersion;
      logger.info(`Looking for a device with Android '${platformVersion}'`);

      // in case we fail to find something, give the user a useful log that has
      // the device udids and os versions so they know what's available
      const availDevices = [];
      let partialMatchCandidate = null;
      // first try started devices/emulators
      for (const device of devices) {
        // direct adb calls to the specific device
        await adb.setDeviceId(device.udid);
        const rawDeviceOS = await adb.getPlatformVersion();
        // The device OS could either be a number, like `6.0`
        // or an abbreviation, like `R`
        availDevices.push(`${device.udid} (${rawDeviceOS})`);
        const deviceOS = semver.coerce(rawDeviceOS) || rawDeviceOS;
        if (!deviceOS) {
          continue;
        }

        const bothVersionsCanBeCoerced = semver.valid(deviceOS) && semver.valid(platformVersion);
        const bothVersionsAreStrings = _.isString(deviceOS) && _.isString(platformVersion);
        if (bothVersionsCanBeCoerced && deviceOS.version === platformVersion.version
            || bothVersionsAreStrings && _.toLower(deviceOS) === _.toLower(platformVersion)) {
          // Got an exact match - proceed immediately
          udid = device.udid;
          break;
        } else if (!bothVersionsCanBeCoerced) {
          // There is no point to check for partial match if either of version numbers is not coercible
          continue;
        }

        if ((!_.includes(opts.platformVersion, '.') && platformVersion.major === deviceOS.major
            || platformVersion.major === deviceOS.major && platformVersion.minor === deviceOS.minor)
            // Got a partial match - make sure we consider the most recent
            // device version available on the host system
            && (partialMatchCandidate && semver.gt(deviceOS, _.values(partialMatchCandidate)[0])
                || !partialMatchCandidate)) {
          partialMatchCandidate = {[device.udid]: deviceOS};
        }
      }
      if (!udid && partialMatchCandidate) {
        udid = _.keys(partialMatchCandidate)[0];
        await adb.setDeviceId(udid);
      }

      if (!udid) {
        // we couldn't find anything! quit
        logger.errorAndThrow(`Unable to find an active device or emulator ` +
          `with OS ${opts.platformVersion}. The following are available: ` +
          availDevices.join(', '));
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
helpers.createADB = async function createADB (opts = {}) {
  const {udid, emPort} = opts;
  const adb = await helpers.createBaseADB(opts);
  adb.setDeviceId(udid);
  if (emPort) {
    adb.setEmulatorPort(emPort);
  }

  return adb;
};

helpers.validatePackageActivityNames = function validatePackageActivityNames (opts) {
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

helpers.getLaunchInfo = async function getLaunchInfo (adb, opts) {
  let {app, appPackage, appActivity, appWaitPackage, appWaitActivity} = opts;
  if (!app) {
    logger.warn('No app sent in, not parsing package/activity');
    return;
  }

  this.validatePackageActivityNames(opts);

  if (appPackage && appActivity) {
    return;
  }

  logger.debug('Parsing package and activity from app manifest');
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

helpers.resetApp = async function resetApp (adb, opts = {}) {
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

helpers.installApk = async function installApk (adb, opts = {}) {
  const {
    app,
    appPackage,
    fastReset,
    fullReset,
    androidInstallTimeout = PACKAGE_INSTALL_TIMEOUT,
    autoGrantPermissions,
    allowTestPackages,
    enforceAppInstall,
  } = opts;

  if (!app || !appPackage) {
    throw new Error("'app' and 'appPackage' options are required");
  }

  if (fullReset) {
    await this.resetApp(adb, opts);
    return;
  }

  const {
    appState,
    wasUninstalled
  } = await adb.installOrUpgrade(app, appPackage, {
    grantPermissions: autoGrantPermissions,
    timeout: androidInstallTimeout,
    allowTestPackages,
    enforceCurrentBuild: enforceAppInstall,
  });

  // There is no need to reset the newly installed app
  const isInstalledOverExistingApp = !wasUninstalled
    && appState !== adb.APP_INSTALL_STATE.NOT_INSTALLED;
  if (fastReset && isInstalledOverExistingApp) {
    logger.info(`Performing fast reset on '${appPackage}'`);
    await this.resetApp(adb, opts);
  }
};

/**
 * Installs an array of apks
 * @param {ADB} adb Instance of Appium ADB object
 * @param {Object} opts Opts defined in driver.js
 */
helpers.installOtherApks = async function installOtherApks (otherApps, adb, opts) {
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

/**
 * Uninstall an array of packages
 * @param {ADB} adb Instance of Appium ADB object
 * @param {Array<string>} appPackages An array of package names to uninstall. If this includes `'*'`, uninstall all of 3rd party apps
 * @param {Array<string>} filterPackages An array of packages does not uninstall when `*` is provided as `appPackages`
 */
helpers.uninstallOtherPackages = async function uninstallOtherPackages (adb, appPackages, filterPackages = []) {
  if (appPackages.includes('*')) {
    logger.debug('Uninstall third party packages');
    appPackages = await this.getThirdPartyPackages(adb, filterPackages);
  }

  logger.debug(`Uninstalling packages: ${appPackages}`);
  await B.all(appPackages.map((appPackage) => adb.uninstallApk(appPackage)));
};

/**
 * Get third party packages filtered with `filterPackages`
 * @param {ADB} adb Instance of Appium ADB object
 * @param {Array<string>} filterPackages An array of packages does not uninstall when `*` is provided as `appPackages`
 * @returns {Array<string>} An array of installed third pary packages
 */
helpers.getThirdPartyPackages = async function getThirdPartyPackages (adb, filterPackages = []) {
  try {
    const packagesString = await adb.shell(['pm', 'list', 'packages', '-3']);
    const appPackagesArray = packagesString.trim().replace(/package:/g, '').split(EOL);
    logger.debug(`'${appPackagesArray}' filtered with '${filterPackages}'`);
    return _.difference(appPackagesArray, filterPackages);
  } catch (err) {
    logger.warn(`Unable to get packages with 'adb shell pm list packages -3': ${err.message}`);
    return [];
  }
};

helpers.initUnicodeKeyboard = async function initUnicodeKeyboard (adb) {
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

helpers.setMockLocationApp = async function setMockLocationApp (adb, app) {
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

helpers.installHelperApp = async function installHelperApp (adb, apkPath, packageId) {
  // Sometimes adb push or adb instal take more time than expected to install an app
  // e.g. https://github.com/appium/io.appium.settings/issues/40#issuecomment-476593174
  await retry(2, async function retryInstallHelperApp () {
    await adb.installOrUpgrade(apkPath, packageId, {grantPermissions: true});
  });
};

/**
 * Pushes and installs io.appium.settings app.
 * Throws an error if the setting app is required
 *
 * @param {Adb} adb - The adb module instance.
 * @param {boolean} throwError[false] - Whether throw error or not
 * @throws {Error} If throwError is true and something happens in installation step
 */
helpers.pushSettingsApp = async function pushSettingsApp (adb, throwError = false) {
  logger.debug('Pushing settings apk to device...');

  try {
    await helpers.installHelperApp(adb, settingsApkPath, SETTINGS_HELPER_PKG_ID, throwError);
  } catch (err) {
    if (throwError) {
      throw err;
    }

    logger.warn(`Ignored error while installing '${settingsApkPath}': ` +
                `'${err.message}'. Features that rely on this helper ` +
                'require the apk such as toggle WiFi and getting location ' +
                'will raise an error if you try to use them.');
  }

  // Reinstall will stop the settings helper process anyway, so
  // there is no need to continue if the application is still running
  if (await adb.processExists(SETTINGS_HELPER_PKG_ID)) {
    logger.debug(`${SETTINGS_HELPER_PKG_ID} is already running. ` +
      `There is no need to reset its permissions.`);
    return;
  }

  if (await adb.getApiLevel() <= 23) { // Android 6- devices should have granted permissions
    // https://github.com/appium/appium/pull/11640#issuecomment-438260477
    const perms = ['SET_ANIMATION_SCALE', 'CHANGE_CONFIGURATION', 'ACCESS_FINE_LOCATION'];
    logger.info(`Granting permissions ${perms} to '${SETTINGS_HELPER_PKG_ID}'`);
    await adb.grantPermissions(SETTINGS_HELPER_PKG_ID, perms.map((x) => `android.permission.${x}`));
  }

  // launch io.appium.settings app due to settings failing to be set
  // if the app is not launched prior to start the session on android 7+
  // see https://github.com/appium/appium/issues/8957
  try {
    await adb.requireRunningSettingsApp();
  } catch (err) {
    logger.debug(err);
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
helpers.pushStrings = async function pushStrings (language, adb, opts) {
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

helpers.unlockWithUIAutomation = async function unlockWithUIAutomation (driver, adb, unlockCapabilities) {
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

helpers.unlockWithHelperApp = async function unlockWithHelperApp (adb) {
  logger.info('Unlocking screen');

  // Unlock succeed with a couple of retries.
  let firstRun = true;
  await retry(3, async function launchHelper () {
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
        logger.warn('"adb shell dumpsys window" command has timed out.');
        logger.warn('The reason of this timeout is the delayed adb response. Resetting adb server can improve it.');
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

helpers.unlock = async function unlock (driver, adb, capabilities) {
  if (!(await adb.isScreenLocked())) {
    logger.info('Screen already unlocked, doing nothing');
    return;
  }

  logger.debug('Screen is locked, trying to unlock');
  if (_.isUndefined(capabilities.unlockType)) {
    logger.warn('Using app unlock, this is going to be deprecated!');
    await helpers.unlockWithHelperApp(adb);
  } else {
    await helpers.unlockWithUIAutomation(driver, adb, {unlockType: capabilities.unlockType, unlockKey: capabilities.unlockKey});
    await helpers.verifyUnlock(adb, capabilities.unlockSuccessTimeout);
  }
};

helpers.verifyUnlock = async function verifyUnlock (adb, unlockSuccessTimeout) {
  let successTimeout = unlockSuccessTimeout || 2000;
  await retryInterval(successTimeout / 1000, successTimeout, async () => {
    if (await adb.isScreenLocked()) {
      throw new Error('Screen did not unlock successfully, retrying');
    }
    logger.debug('Screen unlocked successfully');
  });
};

helpers.initDevice = async function initDevice (adb, opts) {
  const {
    skipDeviceInitialization,
    locale,
    language,
    localeScript,
    unicodeKeyboard,
    disableWindowAnimation,
    skipUnlock,
    mockLocationApp,
    skipLogcatCapture,
    logcatFormat,
    logcatFilterSpecs,
  } = opts;

  if (skipDeviceInitialization) {
    logger.info(`'skipDeviceInitialization' is set. Skipping device initialization.`);
  } else {
    await adb.waitForDevice();
    // pushSettingsApp required before calling ensureDeviceLocale for API Level 24+

    // Some feature such as location/wifi are not necessary for all users,
    // but they require the settings app. So, try to configure it while Appium
    // does not throw error even if they fail.
    const shouldThrowError = language
      || locale
      || localeScript
      || unicodeKeyboard
      || disableWindowAnimation
      || !skipUnlock;
    await helpers.pushSettingsApp(adb, shouldThrowError);
  }

  if (!helpers.isEmulator(adb, opts) && (mockLocationApp || _.isUndefined(mockLocationApp))) {
    await helpers.setMockLocationApp(adb, mockLocationApp || SETTINGS_HELPER_PKG_ID);
  }

  if (language || locale) {
    await helpers.ensureDeviceLocale(adb, language, locale, localeScript);
  }

  if (skipLogcatCapture) {
    logger.info(`'skipLogcatCapture' is set. Skipping starting logcat capture.`);
  } else {
    await adb.startLogcat({
      format: logcatFormat,
      filterSpecs: logcatFilterSpecs,
    });
  }

  if (unicodeKeyboard) {
    return await helpers.initUnicodeKeyboard(adb);
  }
};

helpers.removeNullProperties = function removeNullProperties (obj) {
  for (let key of _.keys(obj)) {
    if (_.isNull(obj[key]) || _.isUndefined(obj[key])) {
      delete obj[key];
    }
  }
};

helpers.truncateDecimals = function truncateDecimals (number, digits) {
  let multiplier = Math.pow(10, digits),
      adjustedNum = number * multiplier,
      truncatedNum = Math[adjustedNum < 0 ? 'ceil' : 'floor'](adjustedNum);

  return truncatedNum / multiplier;
};

helpers.isChromeBrowser = function isChromeBrowser (browser) {
  return _.includes(Object.keys(CHROME_BROWSER_PACKAGE_ACTIVITY), (browser || '').toLowerCase());
};

helpers.getChromePkg = function getChromePkg (browser) {
  return CHROME_BROWSER_PACKAGE_ACTIVITY[browser.toLowerCase()] || CHROME_BROWSER_PACKAGE_ACTIVITY.default;
};

helpers.removeAllSessionWebSocketHandlers = async function removeAllSessionWebSocketHandlers (server, sessionId) {
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
helpers.parseArray = function parseArray (cap) {
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

/**
 * Validate desired capabilities. Returns true if capability is valid
 *
 * @param {*} cap A desired capability
 * @return {boolean} Returns true if the capability is valid
 * @throws {Error} If the caps has invalid capability
 */
helpers.validateDesiredCaps = function validateDesiredCaps (caps) {
  if (caps.browserName) {
    if (caps.app) {
      // warn if the capabilities have both `app` and `browser, although this is common with selenium grid
      logger.warn(`The desired capabilities should generally not include both an 'app' and a 'browserName'`);
    }
    if (caps.appPackage) {
      logger.errorAndThrow(`The desired should not include both of an 'appPackage' and a 'browserName'`);
    }
  }

  if (caps.uninstallOtherPackages) {
    try {
      this.parseArray(caps.uninstallOtherPackages);
    } catch (e) {
      logger.errorAndThrow(`Could not parse "uninstallOtherPackages" capability: ${e.message}`);
    }
  }

  return true;
};

/**
 * Adjust the capabilities for a browser session
 *
 * @param {Object} caps - Current capabilities object
 * !!! The object is mutated by this method call !!!
 * @returns {Object} The same possibly mutated `opts` instance.
 * No mutation is happening is the current session if
 * appPackage/appActivity caps have already been provided.
 */
helpers.adjustBrowserSessionCaps = function adjustBrowserSessionCaps (caps = {}) {
  const { browserName } = caps;
  logger.info(`The current session is considered browser-based`);
  logger.info(`Supported browser names: ${JSON.stringify(_.keys(CHROME_BROWSER_PACKAGE_ACTIVITY))}`);
  if (caps.appPackage || caps.appActivity) {
    logger.info(`Not overriding appPackage/appActivity capability values for '${browserName}' ` +
      'because some of them have been already provided');
    return caps;
  }

  const {pkg, activity} = this.getChromePkg(browserName);
  caps.appPackage = pkg;
  caps.appActivity = activity;
  logger.info(`appPackage/appActivity capabilities have been automatically set to ${pkg}/${activity} ` +
    `for '${browserName}'`);
  logger.info(`Consider changing the browserName to the one from the list of supported browser names ` +
    `or provide custom appPackage/appActivity capability values if the automatically assigned ones do ` +
    `not make sense`);
  return caps;
};

/**
 * Checks whether the current device under test is an emulator
 *
 * @param {ADB} adb - appium-adb instance
 * @param {Object} opts - driver options mapping
 * @returns {boolean} `true` if the device is an Android emulator
 */
helpers.isEmulator = function isEmulator (adb, opts) {
  const possibleNames = [opts.udid, adb?.curDeviceId];
  return !!opts.avd || possibleNames.some((x) => EMULATOR_PATTERN.test(x));
};

helpers.bootstrap = Bootstrap;
helpers.unlocker = unlocker;

export { helpers, SETTINGS_HELPER_PKG_ID, prepareAvdArgs, ensureNetworkSpeed };
export default helpers;
