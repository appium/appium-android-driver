import * as semver from 'semver';
import _ from 'lodash';
import B from 'bluebird';
import path from 'node:path';
import {setMockLocationApp} from '../geolocation';
import {SETTINGS_HELPER_ID} from 'io.appium.settings';
import {hideKeyboardCompletely, initUnicodeKeyboard} from '../keyboard';
import {
  createBaseADB,
  prepareEmulator,
  pushSettingsApp,
} from './utils';
import {adjustTimeZone} from '../time';
import { retryInterval } from 'asyncbox';
import {
  GET_SERVER_LOGS_FEATURE,
  nativeLogEntryToSeleniumEntry
} from '../../utils';

/**
 * @this {AndroidDriver}
 * @returns {Promise<import('../types').ADBDeviceInfo>}
 */
export async function getDeviceInfoFromCaps() {
  // we can create a throwaway ADB instance here, so there is no dependency
  // on instantiating on earlier (at this point, we have no udid)
  // we can only use this ADB object for commands that would not be confused
  // if multiple devices are connected
  const adb = await createBaseADB(this.opts);
  let udid = this.opts.udid;
  let emPort;

  // a specific avd name was given. try to initialize with that
  if (this.opts?.avd) {
    await prepareEmulator.bind(this)(adb);
    udid = adb.curDeviceId;
    emPort = adb.emulatorPort;
  } else {
    // no avd given. lets try whatever's plugged in devices/emulators
    this.log.info('Retrieving device list');
    const devices = await adb.getDevicesWithRetry();

    // udid was given, lets try to init with that device
    if (udid) {
      if (!_.includes(_.map(devices, 'udid'), udid)) {
        throw this.log.errorWithException(`Device ${udid} was not in the list of connected devices`);
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
          (bothVersionsCanBeCoerced &&
            /** @type {semver.SemVer} */ (semverDO).version ===
              /** @type {semver.SemVer} */ (semverPV).version) ||
          (bothVersionsAreStrings && _.toLower(deviceOS) === _.toLower(platformVersion))
        ) {
          // Got an exact match - proceed immediately
          udid = device.udid;
          break;
        } else if (!bothVersionsCanBeCoerced) {
          // There is no point to check for partial match if either of version numbers is not coercible
          continue;
        }

        const pvMajor = /** @type {semver.SemVer} */ (semverPV).major;
        const pvMinor = /** @type {semver.SemVer} */ (semverPV).minor;
        const dvMajor = /** @type {semver.SemVer} */ (semverDO).major;
        const dvMinor = /** @type {semver.SemVer} */ (semverDO).minor;
        if (
          ((!_.includes(this.opts.platformVersion, '.') && pvMajor === dvMajor) ||
            (pvMajor === dvMajor && pvMinor === dvMinor)) &&
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
        throw this.log.errorWithException(
          `Unable to find an active device or emulator ` +
            `with OS ${this.opts.platformVersion}. The following are available: ` +
            availDevices.join(', '),
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
 * @this {AndroidDriver}
 * @returns {Promise<import('appium-adb').ADB>}
 */
export async function createADB() {
  // @ts-expect-error do not put arbitrary properties on opts
  const {udid, emPort} = this.opts;
  const adb = await createBaseADB(this.opts);
  adb.setDeviceId(udid ?? '');
  if (emPort) {
    adb.setEmulatorPort(emPort);
  }
  return adb;
}

/**
 * @this {AndroidDriver}
 * @returns {Promise<import('../types').ADBLaunchInfo | undefined>}
 */
export async function getLaunchInfo() {
  let {appPackage, appActivity, appWaitPackage, appWaitActivity, app} = this.opts;
  if (appPackage && appActivity || (!app && !appPackage)) {
    return;
  }

  let apkPackage;
  let apkActivity;
  if (app) {
    this.log.debug(`Parsing package and activity from the '${path.basename(app)}' file manifest`);
    ({apkPackage, apkActivity} = await this.adb.packageAndLaunchActivityFromManifest(app));
  } else if (appPackage) {
    this.log.debug(`Parsing activity from the installed '${appPackage}' package manifest`);
    apkActivity = await this.adb.resolveLaunchableActivity(appPackage);
  }
  if (apkPackage && !appPackage) {
    appPackage = apkPackage;
  }
  if (apkActivity && !appActivity) {
    appActivity = apkActivity;
  }
  this.log.debug(`Resolved launch package -> activity: ${appPackage} -> ${appActivity}`);
  if (!appWaitPackage) {
    appWaitPackage = appPackage;
  }
  if (!appWaitActivity) {
    appWaitActivity = appActivity;
  }
  this.log.debug(`Resolved wait package -> activity: ${appWaitPackage} -> ${appWaitActivity}`);
  return {appPackage, appWaitPackage, appActivity, appWaitActivity};
}

/**
 * @this {AndroidDriver}
 * @returns {Promise<void>}
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
    timeZone,
  } = this.opts;

  if (skipDeviceInitialization) {
    this.log.info(`'skipDeviceInitialization' is set. Skipping device initialization.`);
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
        !skipUnlock,
    );
    await pushSettingsApp.bind(this)(shouldThrowError);
  }

  /** @type {Promise[]} */
  const setupPromises = [];
  if (!this.isEmulator()) {
    setupPromises.push((async () => {
      if (mockLocationApp || _.isUndefined(mockLocationApp)) {
        await setMockLocationApp.bind(this)(mockLocationApp || SETTINGS_HELPER_ID);
      } else {
        await this.mobileResetGeolocation();
      }
    })());
  }
  if (language && locale) {
    setupPromises.push(this.ensureDeviceLocale(language, locale, localeScript));
  }
  if (skipLogcatCapture) {
    this.log.info(`'skipLogcatCapture' is set. Skipping starting logcat capture.`);
  } else {
    const logcatStartupPromise = async () => {
      await this.adb.startLogcat({
        format: logcatFormat,
        filterSpecs: logcatFilterSpecs,
      });
      this.eventEmitter.emit('syslogStarted', this.adb.logcat);
      if (this.adb.logcat) {
        this.assignBiDiLogListener(this.adb.logcat, {
          type: 'syslog',
        });
      }
    };
    setupPromises.push(logcatStartupPromise());
  }
  setupPromises.push((async () => {
    if (hideKeyboard) {
      // Sometimes we have a race condition when Android
      // does not register input services soon enough
      // after Settings app is installed
      await retryInterval(3, 500, async () => await hideKeyboardCompletely.bind(this)());
    } else if (hideKeyboard === false) {
      await this.adb.shell(['ime', 'reset']);
    }
  })());
  if (unicodeKeyboard) {
    setupPromises.push((async () => {
      this.log.warn(
        `The 'unicodeKeyboard' capability has been deprecated and will be removed. ` +
          `Set the 'hideKeyboard' capability to 'true' in order to make the on-screen keyboard invisible.`,
      );
      await initUnicodeKeyboard.bind(this)();
    })());
  }
  if (timeZone) {
    setupPromises.push(adjustTimeZone.bind(this)(timeZone));
  }
  if (this.isFeatureEnabled(GET_SERVER_LOGS_FEATURE)) {
    [, this._bidiServerLogListener] = this.assignBiDiLogListener(
      this.log.unwrap(), {
        type: 'server',
        srcEventName: 'log',
        entryTransformer: nativeLogEntryToSeleniumEntry,
      }
    );
  }

  await B.all(setupPromises);
}

/**
 * @typedef {import('../../driver').AndroidDriver} AndroidDriver
 */
