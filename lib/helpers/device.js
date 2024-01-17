import ADB from 'appium-adb';
import semver from 'semver';
import _ from 'lodash';
import { util } from '@appium/support';
import logger from '../logger';
import { resetMockLocation, setMockLocationApp } from '../commands/geolocation';
import { pushSettingsApp } from '../commands/settings-app';
import { SETTINGS_HELPER_ID } from 'io.appium.settings';
import { ensureDeviceLocale } from '../commands/resources';
import { hideKeyboardCompletely, initUnicodeKeyboard } from '../commands/keyboard';

/**
 * @param {import('../driver').AndroidDriverOpts?} [opts=null]
 * @returns {Promise<ADB>}
 */
async function createBaseADB(opts = null) {
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
  } = opts ?? {};
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
}

/**
 * @this {import('../driver').AndroidDriver}
 * @returns {Promise<import('./types').ADBDeviceInfo>}
 */
export async function getDeviceInfoFromCaps() {
  // we can create a throwaway ADB instance here, so there is no dependency
  // on instantiating on earlier (at this point, we have no udid)
  // we can only use this ADB object for commands that would not be confused
  // if multiple devices are connected
  /** @type {ADB} */
  const adb = await createBaseADB.bind(this)();
  let udid = this.opts.udid;
  let emPort;

  // a specific avd name was given. try to initialize with that
  if (this.opts?.avd) {
    await prepareEmulator.bind(this)();
    udid = adb.curDeviceId;
    emPort = adb.emulatorPort;
  } else {
    // no avd given. lets try whatever's plugged in devices/emulators
    this.log.info('Retrieving device list');
    const devices = await adb.getDevicesWithRetry();

    // udid was given, lets try to init with that device
    if (udid) {
      if (!_.includes(_.map(devices, 'udid'), udid)) {
        throw this.log.errorAndThrow(`Device ${udid} was not in the list of connected devices`);
      }
      emPort = adb.getPortFromEmulatorString(udid);
    } else if (this.opts.platformVersion) {
      this.opts.platformVersion = `${this.opts.platformVersion}`.trim();

      // a platform version was given. lets try to find a device with the same os
      const platformVersion = semver.coerce(this.opts.platformVersion) || this.opts.platformVersion;
      this.log.info(`Looking for a device with Android '${platformVersion}'`);

      // in case we fail to find something, give the user a useful log that has
      // the device udids and os versions so they know what's available
      const availDevices = [];
      let partialMatchCandidate;
      // first try started devices/emulators
      for (const device of devices) {
        // direct adb calls to the specific device
        adb.setDeviceId(device.udid);
        /** @type {string} */
        const rawDeviceOS = await adb.getPlatformVersion();
        // The device OS could either be a number, like `6.0`
        // or an abbreviation, like `R`
        availDevices.push(`${device.udid} (${rawDeviceOS})`);
        const deviceOS = semver.coerce(rawDeviceOS) || rawDeviceOS;
        if (!deviceOS) {
          continue;
        }

        const semverPV = platformVersion;
        const semverDO = deviceOS;

        const bothVersionsCanBeCoerced = semver.valid(deviceOS) && semver.valid(platformVersion);
        const bothVersionsAreStrings = _.isString(deviceOS) && _.isString(platformVersion);
        if (
          (bothVersionsCanBeCoerced
            && (/** @type {semver.SemVer} */(semverDO)).version === (/** @type {semver.SemVer} */(semverPV)).version)
          || (bothVersionsAreStrings && _.toLower(deviceOS) === _.toLower(platformVersion))
        ) {
          // Got an exact match - proceed immediately
          udid = device.udid;
          break;
        } else if (!bothVersionsCanBeCoerced) {
          // There is no point to check for partial match if either of version numbers is not coercible
          continue;
        }

        if (
          ((!_.includes(this.opts.platformVersion, '.')
          && (/** @type {semver.SemVer} */(semverPV)).major === (/** @type {semver.SemVer} */(semverDO)).major) ||
            ((/** @type {semver.SemVer} */(semverPV)).major === (/** @type {semver.SemVer} */(semverDO)).major
              && (/** @type {semver.SemVer} */(semverPV)).minor === (/** @type {semver.SemVer} */(semverDO)).minor)) &&
          // Got a partial match - make sure we consider the most recent
          // device version available on the host system
          ((partialMatchCandidate && semver.gt(deviceOS, _.values(partialMatchCandidate)[0])) ||
            !partialMatchCandidate)
        ) {
          partialMatchCandidate = {[device.udid]: deviceOS};
        }
      }
      if (!udid && partialMatchCandidate) {
        udid = _.keys(partialMatchCandidate)[0];
        adb.setDeviceId(udid);
      }

      if (!udid) {
        // we couldn't find anything! quit
        throw this.log.errorAndThrow(
          `Unable to find an active device or emulator ` +
            `with OS ${this.opts.platformVersion}. The following are available: ` +
            availDevices.join(', ')
        );
      }

      emPort = adb.getPortFromEmulatorString(udid);
    } else {
      // a udid was not given, grab the first device we see
      udid = devices[0].udid;
      emPort = adb.getPortFromEmulatorString(udid);
    }
  }

  this.log.info(`Using device: ${udid}`);
  return {udid: String(udid), emPort: emPort ?? false};
}

/**
 * @property {(AndroidDriverOpts & {emPort?: number})?} [opts=null]
 * @returns {Promise<import('appium-adb').ADB>}
 */
export async function createADB(opts = null) {
  // @ts-expect-error do not put arbitrary properties on opts
  const {udid, emPort} = opts ?? {};
  const adb = await createBaseADB(opts);
  adb.setDeviceId(udid ?? '');
  if (emPort) {
    adb.setEmulatorPort(emPort);
  }

  return adb;
}

/**
 * @this {import('../driver').AndroidDriver}
 * @returns {Promise<import('./types').ADBLaunchInfo | undefined>}
 */
export async function getLaunchInfo() {
  if (!this.opts.app) {
    this.log.warn('No app sent in, not parsing package/activity');
    return;
  }
  let {appPackage, appActivity, appWaitPackage, appWaitActivity} = this.opts;
  const {app} = this.opts;

  validatePackageActivityNames(this.opts);

  if (appPackage && appActivity) {
    return;
  }

  this.log.debug('Parsing package and activity from app manifest');
  const {apkPackage, apkActivity} = await this.adb.packageAndLaunchActivityFromManifest(app);
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
  this.log.debug(`Parsed package and activity are: ${apkPackage}/${apkActivity}`);
  return {appPackage, appWaitPackage, appActivity, appWaitActivity};
}

/**
 * @this {import('../driver').AndroidDriver}
 * @returns
 */
export async function initDevice() {
  const {
    skipDeviceInitialization,
    locale,
    language,
    localeScript,
    unicodeKeyboard,
    hideKeyboard,
    disableWindowAnimation,
    skipUnlock,
    mockLocationApp,
    skipLogcatCapture,
    logcatFormat,
    logcatFilterSpecs,
  } = this.opts;

  if (skipDeviceInitialization) {
    logger.info(`'skipDeviceInitialization' is set. Skipping device initialization.`);
  } else {
    if (this.isEmulator()) {
      // Check if the device wake up only for an emulator.
      // It takes 1 second or so even when the device is already awake in a real device.
      await this.adb.waitForDevice();
    }
    // pushSettingsApp required before calling ensureDeviceLocale for API Level 24+

    // Some feature such as location/wifi are not necessary for all users,
    // but they require the settings app. So, try to configure it while Appium
    // does not throw error even if they fail.
    const shouldThrowError = Boolean(
      language ||
        locale ||
        localeScript ||
        unicodeKeyboard ||
        hideKeyboard ||
        disableWindowAnimation ||
        !skipUnlock
    );
    await pushSettingsApp.bind(this)(shouldThrowError);
  }

  if (!this.isEmulator()) {
    if (mockLocationApp || _.isUndefined(mockLocationApp)) {
      await setMockLocationApp.bind(this)(mockLocationApp || SETTINGS_HELPER_ID);
    } else {
      await resetMockLocation.bind(this)();
    }
  }

  if (language || locale) {
    await ensureDeviceLocale.bind(this)(language, locale, localeScript);
  }

  if (skipLogcatCapture) {
    logger.info(`'skipLogcatCapture' is set. Skipping starting logcat capture.`);
  } else {
    await this.adb.startLogcat({
      format: logcatFormat,
      filterSpecs: logcatFilterSpecs,
    });
  }

  if (hideKeyboard) {
    await hideKeyboardCompletely.bind(this)();
  } else if (hideKeyboard === false) {
    await this.adb.shell(['ime', 'reset']);
  }

  if (unicodeKeyboard) {
    logger.warn(
      `The 'unicodeKeyboard' capability has been deprecated and will be removed. ` +
      `Set the 'hideKeyboard' capability to 'true' in order to make the on-screen keyboard invisible.`
    );
    return await initUnicodeKeyboard.bind(this)();
  }
}

// ***
// #region Private Helpers
// ***

/**
 * @param {import('../driver').AndroidDriverOpts} opts
 * @returns {void}
 */
function validatePackageActivityNames(opts) {
  for (const key of ['appPackage', 'appActivity', 'appWaitPackage', 'appWaitActivity']) {
    const name = opts[key];
    if (!name) {
      continue;
    }

    const match = /([^\w.*,])+/.exec(String(name));
    if (!match) {
      continue;
    }

    logger.warn(
      `Capability '${key}' is expected to only include latin letters, digits, underscore, dot, comma and asterisk characters.`
    );
    logger.warn(
      `Current value '${name}' has non-matching character at index ${match.index}: '${String(
        name
      ).substring(0, match.index + 1)}'`
    );
  }
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {string} networkSpeed
 * @returns {string}
 */
function ensureNetworkSpeed(networkSpeed) {
  if (networkSpeed.toUpperCase() in this.adb.NETWORK_SPEED) {
    return networkSpeed;
  }
  logger.warn(
    `Wrong network speed param '${networkSpeed}', using default: ${this.adb.NETWORK_SPEED.FULL}. ` +
      `Supported values: ${_.values(this.adb.NETWORK_SPEED)}`
  );
  return this.adb.NETWORK_SPEED.FULL;
}

/**
 * @this {import('../driver').AndroidDriver}
 * @returns {string[]}
 */
function prepareAvdArgs() {
  const {networkSpeed, isHeadless, avdArgs} = this.opts;
  const result = [];
  if (avdArgs) {
    if (_.isArray(avdArgs)) {
      result.push(...avdArgs);
    } else {
      result.push(...(util.shellParse(`${avdArgs}`)));
    }
  }
  if (networkSpeed) {
    result.push('-netspeed', ensureNetworkSpeed.bind(this)(networkSpeed));
  }
  if (isHeadless) {
    result.push('-no-window');
  }
  return result;
}

/**
 * @this {import('../driver').AndroidDriver}
 * @returns {Promise<void>}
 */
async function prepareEmulator() {
  const {
    avd,
    avdEnv: env,
    language,
    locale: country,
    avdLaunchTimeout: launchTimeout,
    avdReadyTimeout: readyTimeout,
  } = this.opts;
  if (!avd) {
    throw new Error('Cannot launch AVD without AVD name');
  }

  const avdName = avd.replace('@', '');
  let isEmulatorRunning = true;
  try {
    await this.adb.getRunningAVDWithRetry(avdName, 5000);
  } catch (e) {
    this.log.debug(`Emulator '${avdName}' is not running: ${e.message}`);
    isEmulatorRunning = false;
  }
  const args = prepareAvdArgs.bind(this)();
  if (isEmulatorRunning) {
    if (args.includes('-wipe-data')) {
      this.log.debug(`Killing '${avdName}' because it needs to be wiped at start.`);
      await this.adb.killEmulator(avdName);
    } else {
      this.log.debug('Not launching AVD because it is already running.');
      return;
    }
  }
  await this.adb.launchAVD(avd, {
    args,
    env,
    language,
    country,
    launchTimeout,
    readyTimeout,
  });
}

// #endregion