import {fs, tempDir, util} from '@appium/support';
import type {AppiumServer, StringRecord} from '@appium/types';
import {ADB} from 'appium-adb';
import {retryInterval, waitForCondition} from 'asyncbox';
import B from 'bluebird';
import {path as settingsApkPath} from 'io.appium.settings';
import _ from 'lodash';
import {EOL} from 'node:os';
import path from 'node:path';
import semver, {type SemVer} from 'semver';
import type {SetRequired, ValueOf} from 'type-fest';
import type {UnlockType} from '../commands/types';
import type {AndroidDriver, AndroidDriverCaps, AndroidDriverOpts} from '../driver';
import logger from '../logger';
import type {ADBDeviceInfo, ADBLaunchInfo} from './types';
import Unlocker, {
  FINGERPRINT_UNLOCK,
  PASSWORD_UNLOCK,
  PATTERN_UNLOCK,
  PIN_UNLOCK,
  PIN_UNLOCK_KEY_EVENT,
} from './unlock';

const MOCK_APP_IDS_STORE = '/data/local/tmp/mock_apps.json';
const PACKAGE_INSTALL_TIMEOUT_MS = 90000;
const HELPER_APP_INSTALL_RETRIES = 3;
const HELPER_APP_INSTALL_RETRY_DELAY_MS = 5000;
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
} as const;
const SETTINGS_HELPER_PKG_ID = 'io.appium.settings';
const SETTING_NOTIFICATIONS_LISTENER_SERVICE = `${SETTINGS_HELPER_PKG_ID}/.NLService`;
const EMULATOR_PATTERN = /\bemulator\b/i;
// These constants are in sync with
// https://developer.apple.com/documentation/xctest/xcuiapplicationstate/xcuiapplicationstaterunningbackground?language=objc
const APP_STATE = {
  NOT_INSTALLED: 0,
  NOT_RUNNING: 1,
  RUNNING_IN_BACKGROUND: 3,
  RUNNING_IN_FOREGROUND: 4,
} as const;

function ensureNetworkSpeed(adb: ADB, networkSpeed: string) {
  if (networkSpeed.toUpperCase() in adb.NETWORK_SPEED) {
    return networkSpeed;
  }
  logger.warn(
    `Wrong network speed param '${networkSpeed}', using default: ${adb.NETWORK_SPEED.FULL}. ` +
      `Supported values: ${_.values(adb.NETWORK_SPEED)}`
  );
  return adb.NETWORK_SPEED.FULL;
}

function prepareAvdArgs(adb: ADB, opts: AndroidDriverOpts): string[] {
  const {networkSpeed, isHeadless, avdArgs} = opts;
  const result: string[] = [];
  if (avdArgs) {
    if (_.isArray(avdArgs)) {
      result.push(...avdArgs);
    } else {
      result.push(...(util.shellParse(`${avdArgs}`) as string[]));
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

function toCredentialType(unlockType: UnlockType) {
  const result = {
    [PIN_UNLOCK]: 'pin',
    [PIN_UNLOCK_KEY_EVENT]: 'pin',
    [PASSWORD_UNLOCK]: 'password',
    [PATTERN_UNLOCK]: 'pattern',
  }[unlockType];
  if (result) {
    return result;
  }
  throw new Error(`Unlock type '${unlockType}' is not known`);
}

interface AndroidHelpers {
  createBaseADB(opts?: AndroidDriverOpts): Promise<ADB>;

  prepareEmulator(adb: ADB, opts?: any): Promise<void>;

  /**
   * Set and ensure the locale name of the device under test.
   *
   * @param adb - The adb module instance.
   * @param language - Language. The language field is case insensitive, but Locale always canonicalizes to lower case.
   *                            format: [a-zA-Z]{2,8}. e.g. en, ja : https://developer.android.com/reference/java/util/Locale.html
   * @param country - Country. The country (region) field is case insensitive, but Locale always canonicalizes to upper case.
   *                            format: [a-zA-Z]{2} | [0-9]{3}. e.g. US, JP : https://developer.android.com/reference/java/util/Locale.html
   * @param script - Script. The script field is case insensitive but Locale always canonicalizes to title case.
   *                            format: [a-zA-Z]{4}. e.g. Hans in zh-Hans-CN : https://developer.android.com/reference/java/util/Locale.html
   * @throws {Error} If it failed to set locale properly
   */
  ensureDeviceLocale(adb: ADB, language?: string, country?: string, script?: string): Promise<void>;

  getDeviceInfoFromCaps<Opts extends AndroidDriverOpts>(opts?: Opts): Promise<ADBDeviceInfo>;

  createADB<Opts extends AndroidDriverOpts>(opts?: Opts): Promise<ADB>;

  validatePackageActivityNames<Opts extends AndroidDriverOpts>(opts: Opts): void;
  getLaunchInfo<Opts extends AndroidDriverOpts>(
    adb: ADB,
    opts: Opts
  ): Promise<ADBLaunchInfo | undefined>;
  resetApp<Opts extends AndroidDriverOpts>(
    adb: ADB,
    opts: SetRequired<Opts, 'appPackage' | 'app'>
  ): Promise<void>;
  installApk<Opts extends AndroidDriverOpts>(
    adb: ADB,
    opts: SetRequired<Opts, 'appPackage' | 'app'>
  ): Promise<void>;

  /**
   * Installs an array of apks
   * @param adb Instance of Appium ADB object
   * @param opts Opts defined in driver.js
   */
  installOtherApks<Opts extends AndroidDriverOpts>(
    apks: string[],
    adb: ADB,
    opts: SetRequired<Opts, 'appPackage' | 'app'>
  ): Promise<void>;

  /**
   * Uninstall an array of packages
   * @param adb Instance of Appium ADB object
   * @param appPackages An array of package names to uninstall. If this includes `'*'`, uninstall all of 3rd party apps
   * @param filterPackages An array of packages does not uninstall when `*` is provided as `appPackages`
   */
  uninstallOtherPackages(adb: ADB, appPackages: string[], filterPackages?: string[]): Promise<void>;

  /**
   * Get third party packages filtered with `filterPackages`
   * @param adb Instance of Appium ADB object
   * @param filterPackages An array of packages does not uninstall when `*` is provided as `appPackages`
   * @returns An array of installed third pary packages
   */
  getThirdPartyPackages(adb: ADB, filterPackages?: string[]): Promise<string[]>;
  /**
   * @privateRemarks FIXME: return value is unknown to me
   */
  initUnicodeKeyboard(adb: ADB): Promise<any>;
  setMockLocationApp(adb: ADB, app: string): Promise<void>;
  resetMockLocation(adb: ADB): Promise<void>;
  installHelperApp(adb: ADB, apkPath: string, packageId: string): Promise<void>;

  /**
   * Pushes and installs io.appium.settings app.
   * Throws an error if the setting app is required
   *
   * @param adb - The adb module instance.
   * @param throwError - Whether throw an error if Settings app fails to start
   * @param opts - Driver options dictionary.
   * @throws If throwError is true and something happens in installation step
   */
  pushSettingsApp(adb: ADB, throwError: boolean, opts: AndroidDriverOpts): Promise<void>;

  /**
   * Extracts string.xml and converts it to string.json and pushes
   * it to /data/local/tmp/string.json on for use of bootstrap
   * If app is not present to extract string.xml it deletes remote strings.json
   * If app does not have strings.xml we push an empty json object to remote
   *
   * @param language - Language abbreviation, for example 'fr'. The default language
   * is used if this argument is not defined.
   * @param adb - The adb module instance.
   * @param opts - Driver options dictionary.
   * @returns The dictionary, where string resource identifiers are keys
   * along with their corresponding values for the given language or an empty object
   * if no matching resources were extracted.
   */
  pushStrings(
    language: string | undefined,
    adb: ADB,
    opts: AndroidDriverOpts
  ): Promise<StringRecord>;
  unlock<D extends AndroidDriver, Caps extends AndroidDriverCaps>(
    driver: D,
    adb: ADB,
    capabilities: Caps
  ): Promise<void>;
  verifyUnlock(adb: ADB, timeoutMs?: number | null): Promise<void>;
  initDevice(adb: ADB, opts: AndroidDriverOpts): Promise<string | void>;
  removeNullProperties(obj: any): void;
  truncateDecimals(number: number, digits: number): number;
  isChromeBrowser(browser?: string): boolean;
  getChromePkg(browser: string): ValueOf<typeof CHROME_BROWSER_PACKAGE_ACTIVITY>;
  removeAllSessionWebSocketHandlers(
    server?: AppiumServer,
    sessionId?: string | null
  ): Promise<void>;
  parseArray(cap: string | string[]): string[];

  /**
   * Validate desired capabilities. Returns true if capabilities are valid
   *
   * @param caps Capabilities
   * @return Returns true if the capabilites are valid
   * @throws {Error} If the caps has invalid capability
   */
  validateDesiredCaps(caps: AndroidDriverCaps): boolean;

  /**
   * Adjust the capabilities for a browser session
   *
   * @param caps - Current capabilities object
   * !!! The object is mutated by this method call !!!
   * @returns The same possibly mutated `opts` instance.
   * No mutation is happening is the current session if
   * appPackage/appActivity caps have already been provided.
   * @privateRemarks In practice, this fn is only ever provided a `AndroidDriverOpts` object
   */
  adjustBrowserSessionCaps(caps: AndroidDriverCaps): AndroidDriverCaps;

  /**
   * Checks whether the current device under test is an emulator
   *
   * @param adb - appium-adb instance
   * @param opts - driver options mapping
   * @returns `true` if the device is an Android emulator
   */
  isEmulator(adb?: ADB, opts?: AndroidDriverOpts): boolean;
  unlocker: typeof Unlocker;
}

const AndroidHelpers: AndroidHelpers = {
  async createBaseADB(opts) {
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
  },

  async prepareEmulator(adb, opts) {
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
    let isEmulatorRunning = true;
    try {
      await adb.getRunningAVDWithRetry(avdName, 5000);
    } catch (e) {
      logger.debug(`Emulator '${avdName}' is not running: ${(e as Error).message}`);
      isEmulatorRunning = false;
    }
    const args = prepareAvdArgs(adb, opts);
    if (isEmulatorRunning) {
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
  },

  async ensureDeviceLocale(adb, language, country, script) {
    if (!_.isString(language) && !_.isString(country)) {
      logger.warn(`setDeviceLanguageCountry requires language or country.`);
      logger.warn(`Got language: '${language}' and country: '${country}'`);
      return;
    }

    await adb.setDeviceLanguageCountry(language, country, script);

    if (!(await adb.ensureCurrentLocale(language, country, script))) {
      const message = script
        ? `language: ${language}, country: ${country} and script: ${script}`
        : `language: ${language} and country: ${country}`;
      throw new Error(`Failed to set ${message}`);
    }
  },

  async getDeviceInfoFromCaps(opts) {
    // we can create a throwaway ADB instance here, so there is no dependency
    // on instantiating on earlier (at this point, we have no udid)
    // we can only use this ADB object for commands that would not be confused
    // if multiple devices are connected
    const adb = await AndroidHelpers.createBaseADB(opts);
    let udid: string | undefined = opts?.udid;
    let emPort: number | false | undefined;

    // a specific avd name was given. try to initialize with that
    if (opts?.avd) {
      await AndroidHelpers.prepareEmulator(adb, opts);
      udid = adb.curDeviceId;
      emPort = adb.emulatorPort;
    } else {
      // no avd given. lets try whatever's plugged in devices/emulators
      logger.info('Retrieving device list');
      const devices = await adb.getDevicesWithRetry();

      // udid was given, lets try to init with that device
      if (udid) {
        if (!_.includes(_.map(devices, 'udid'), udid)) {
          logger.errorAndThrow(`Device ${udid} was not in the list of connected devices`);
        }
        emPort = adb.getPortFromEmulatorString(udid);
      } else if (opts?.platformVersion) {
        opts.platformVersion = `${opts.platformVersion}`.trim();

        // a platform version was given. lets try to find a device with the same os
        const platformVersion = semver.coerce(opts.platformVersion) || opts.platformVersion;
        logger.info(`Looking for a device with Android '${platformVersion}'`);

        // in case we fail to find something, give the user a useful log that has
        // the device udids and os versions so they know what's available
        const availDevices: string[] = [];
        let partialMatchCandidate: StringRecord<string> | undefined;
        // first try started devices/emulators
        for (const device of devices) {
          // direct adb calls to the specific device
          adb.setDeviceId(device.udid);
          const rawDeviceOS = await adb.getPlatformVersion();
          // The device OS could either be a number, like `6.0`
          // or an abbreviation, like `R`
          availDevices.push(`${device.udid} (${rawDeviceOS})`);
          const deviceOS = semver.coerce(rawDeviceOS) || rawDeviceOS;
          if (!deviceOS) {
            continue;
          }

          const semverPV = platformVersion as SemVer;
          const semverDO = deviceOS as SemVer;

          const bothVersionsCanBeCoerced = semver.valid(deviceOS) && semver.valid(platformVersion);
          const bothVersionsAreStrings = _.isString(deviceOS) && _.isString(platformVersion);
          if (
            (bothVersionsCanBeCoerced && semverDO.version === semverPV.version) ||
            (bothVersionsAreStrings && _.toLower(deviceOS) === _.toLower(platformVersion))
          ) {
            // Got an exact match - proceed immediately
            udid = device.udid;
            break;
          } else if (!bothVersionsCanBeCoerced) {
            // There is no point to check for partial match if either of version numbers is not coercible
            continue;
          }

          if (
            ((!_.includes(opts.platformVersion, '.') && semverPV.major === semverDO.major) ||
              (semverPV.major === semverDO.major && semverPV.minor === semverDO.minor)) &&
            // Got a partial match - make sure we consider the most recent
            // device version available on the host system
            ((partialMatchCandidate && semver.gt(deviceOS, _.values(partialMatchCandidate)[0])) ||
              !partialMatchCandidate)
          ) {
            partialMatchCandidate = {[device.udid]: deviceOS as string};
          }
        }
        if (!udid && partialMatchCandidate) {
          udid = _.keys(partialMatchCandidate)[0];
          adb.setDeviceId(udid);
        }

        if (!udid) {
          // we couldn't find anything! quit
          logger.errorAndThrow(
            `Unable to find an active device or emulator ` +
              `with OS ${opts.platformVersion}. The following are available: ` +
              availDevices.join(', ')
          );
          throw new Error(); // unreachable; for TS
        }

        emPort = adb.getPortFromEmulatorString(udid);
      } else {
        // a udid was not given, grab the first device we see
        udid = devices[0].udid;
        emPort = adb.getPortFromEmulatorString(udid);
      }
    }

    logger.info(`Using device: ${udid}`);
    return {udid: udid as string, emPort: emPort as number | false};
  },

  async createADB(opts) {
    // @ts-expect-error do not put arbitrary properties on opts
    const {udid, emPort} = opts ?? {};
    const adb = await AndroidHelpers.createBaseADB(opts);
    adb.setDeviceId(udid ?? '');
    if (emPort) {
      adb.setEmulatorPort(emPort);
    }

    return adb;
  },

  validatePackageActivityNames(opts) {
    for (const key of ['appPackage', 'appActivity', 'appWaitPackage', 'appWaitActivity']) {
      const name = opts[key as keyof typeof opts];
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
  },

  async getLaunchInfo(adb, opts) {
    if (!opts.app) {
      logger.warn('No app sent in, not parsing package/activity');
      return;
    }
    let {appPackage, appActivity, appWaitPackage, appWaitActivity} = opts;
    const {app} = opts;

    AndroidHelpers.validatePackageActivityNames(opts);

    if (appPackage && appActivity) {
      return;
    }

    logger.debug('Parsing package and activity from app manifest');
    const {apkPackage, apkActivity} = await adb.packageAndLaunchActivityFromManifest(app);
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
  },

  async resetApp(adb, opts) {
    const {
      app,
      appPackage,
      fastReset,
      fullReset,
      androidInstallTimeout = PACKAGE_INSTALL_TIMEOUT_MS,
      autoGrantPermissions,
      allowTestPackages,
    } = opts ?? {};

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
          throw new Error(
            `Cannot clear the application data of '${appPackage}'. Original error: ${output}`
          );
        }
        // executing `shell pm clear` resets previously assigned application permissions as well
        if (autoGrantPermissions) {
          try {
            await adb.grantAllPermissions(appPackage);
          } catch (error) {
            logger.error(
              `Unable to grant permissions requested. Original error: ${(error as Error).message}`
            );
          }
        }
        logger.debug(
          `Performed fast reset on the installed '${appPackage}' application (stop and clear)`
        );
        return;
      }
    }

    if (!app) {
      throw new Error(
        `Either provide 'app' option to install '${appPackage}' or ` +
          `consider setting 'noReset' to 'true' if '${appPackage}' is supposed to be preinstalled.`
      );
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
  },

  async installApk(adb, opts) {
    const {
      app,
      appPackage,
      fastReset,
      fullReset,
      androidInstallTimeout = PACKAGE_INSTALL_TIMEOUT_MS,
      autoGrantPermissions,
      allowTestPackages,
      enforceAppInstall,
    } = opts ?? {};

    if (!app || !appPackage) {
      throw new Error("'app' and 'appPackage' options are required");
    }

    if (fullReset) {
      await AndroidHelpers.resetApp(adb, opts);
      return;
    }

    const {appState, wasUninstalled} = await adb.installOrUpgrade(app, appPackage, {
      grantPermissions: autoGrantPermissions,
      timeout: androidInstallTimeout,
      allowTestPackages,
      enforceCurrentBuild: enforceAppInstall,
    });

    // There is no need to reset the newly installed app
    const isInstalledOverExistingApp =
      !wasUninstalled && appState !== adb.APP_INSTALL_STATE.NOT_INSTALLED;
    if (fastReset && isInstalledOverExistingApp) {
      logger.info(`Performing fast reset on '${appPackage}'`);
      await AndroidHelpers.resetApp(adb, opts);
    }
  },

  async installOtherApks(otherApps, adb, opts) {
    const {
      androidInstallTimeout = PACKAGE_INSTALL_TIMEOUT_MS,
      autoGrantPermissions,
      allowTestPackages,
    } = opts;

    // Install all of the APK's asynchronously
    await B.all(
      otherApps.map((otherApp) => {
        logger.debug(`Installing app: ${otherApp}`);
        return adb.installOrUpgrade(otherApp, undefined, {
          grantPermissions: autoGrantPermissions,
          timeout: androidInstallTimeout,
          allowTestPackages,
        });
      })
    );
  },

  async uninstallOtherPackages(adb, appPackages, filterPackages = []) {
    if (appPackages.includes('*')) {
      logger.debug('Uninstall third party packages');
      appPackages = await AndroidHelpers.getThirdPartyPackages(adb, filterPackages);
    }

    logger.debug(`Uninstalling packages: ${appPackages}`);
    await B.all(appPackages.map((appPackage) => adb.uninstallApk(appPackage)));
  },

  async getThirdPartyPackages(adb, filterPackages = []) {
    try {
      const packagesString = await adb.shell(['pm', 'list', 'packages', '-3']);
      const appPackagesArray = packagesString
        .trim()
        .replace(/package:/g, '')
        .split(EOL);
      logger.debug(`'${appPackagesArray}' filtered with '${filterPackages}'`);
      return _.difference(appPackagesArray, filterPackages);
    } catch (err) {
      logger.warn(
        `Unable to get packages with 'adb shell pm list packages -3': ${(err as Error).message}`
      );
      return [];
    }
  },

  async initUnicodeKeyboard(adb) {
    logger.debug('Enabling Unicode keyboard support');

    // get the default IME so we can return back to it later if we want
    const defaultIME = await adb.defaultIME();

    logger.debug(`Unsetting previous IME ${defaultIME}`);
    const appiumIME = `${SETTINGS_HELPER_PKG_ID}/.UnicodeIME`;
    logger.debug(`Setting IME to '${appiumIME}'`);
    await adb.enableIME(appiumIME);
    await adb.setIME(appiumIME);
    return defaultIME;
  },

  async setMockLocationApp(adb, app) {
    try {
      if ((await adb.getApiLevel()) < 23) {
        await adb.shell(['settings', 'put', 'secure', 'mock_location', '1']);
      } else {
        await adb.shell(['appops', 'set', app, 'android:mock_location', 'allow']);
      }
    } catch (err) {
      logger.warn(`Unable to set mock location for app '${app}': ${(err as Error).message}`);
      return;
    }
    try {
      let pkgIds: string[] = [];
      if (await adb.fileExists(MOCK_APP_IDS_STORE)) {
        try {
          pkgIds = JSON.parse(await adb.shell(['cat', MOCK_APP_IDS_STORE]));
        } catch (ign) {}
      }
      if (pkgIds.includes(app)) {
        return;
      }
      pkgIds.push(app);
      const tmpRoot = await tempDir.openDir();
      const srcPath = path.posix.join(tmpRoot, path.posix.basename(MOCK_APP_IDS_STORE));
      try {
        await fs.writeFile(srcPath, JSON.stringify(pkgIds), 'utf8');
        await adb.push(srcPath, MOCK_APP_IDS_STORE);
      } finally {
        await fs.rimraf(tmpRoot);
      }
    } catch (e) {
      logger.warn(`Unable to persist mock location app id '${app}': ${(e as Error).message}`);
    }
  },

  async resetMockLocation(adb) {
    try {
      if ((await adb.getApiLevel()) < 23) {
        await adb.shell(['settings', 'put', 'secure', 'mock_location', '0']);
        return;
      }

      const thirdPartyPkgIdsPromise = AndroidHelpers.getThirdPartyPackages(adb);
      let pkgIds = [];
      if (await adb.fileExists(MOCK_APP_IDS_STORE)) {
        try {
          pkgIds = JSON.parse(await adb.shell(['cat', MOCK_APP_IDS_STORE]));
        } catch (ign) {}
      }
      const thirdPartyPkgIds = await thirdPartyPkgIdsPromise;
      // Only include currently installed packages
      const resultPkgs = _.intersection(pkgIds, thirdPartyPkgIds);
      if (_.size(resultPkgs) <= 1) {
        await adb.shell([
          'appops',
          'set',
          resultPkgs[0] ?? SETTINGS_HELPER_PKG_ID,
          'android:mock_location',
          'deny',
        ]);
        return;
      }

      logger.debug(`Resetting mock_location permission for the following apps: ${resultPkgs}`);
      await B.all(
        resultPkgs.map((pkgId) =>
          (async () => {
            try {
              await adb.shell(['appops', 'set', pkgId, 'android:mock_location', 'deny']);
            } catch (ign) {}
          })()
        )
      );
    } catch (err) {
      logger.warn(`Unable to reset mock location: ${(err as Error).message}`);
    }
  },

  async installHelperApp(adb, apkPath, packageId) {
    // Sometimes adb push or adb instal take more time than expected to install an app
    // e.g. https://github.com/appium/io.appium.settings/issues/40#issuecomment-476593174
    await retryInterval(
      HELPER_APP_INSTALL_RETRIES,
      HELPER_APP_INSTALL_RETRY_DELAY_MS,
      async function retryInstallHelperApp() {
        await adb.installOrUpgrade(apkPath, packageId, {grantPermissions: true});
      }
    );
  },

  async pushSettingsApp(adb, throwError, opts) {
    logger.debug('Pushing settings apk to device...');

    try {
      await AndroidHelpers.installHelperApp(adb, settingsApkPath, SETTINGS_HELPER_PKG_ID);
    } catch (err) {
      if (throwError) {
        throw err;
      }

      logger.warn(
        `Ignored error while installing '${settingsApkPath}': ` +
          `'${(err as Error).message}'. Features that rely on this helper ` +
          'require the apk such as toggle WiFi and getting location ' +
          'will raise an error if you try to use them.'
      );
    }

    // Reinstall would stop the settings helper process anyway, so
    // there is no need to continue if the application is still running
    if (await adb.processExists(SETTINGS_HELPER_PKG_ID)) {
      logger.debug(
        `${SETTINGS_HELPER_PKG_ID} is already running. ` +
          `There is no need to reset its permissions.`
      );
      return;
    }

    const apiLevel = await adb.getApiLevel();
    if (apiLevel >= 29) {
      // https://github.com/appium/io.appium.settings#internal-audio--video-recording
      try {
        await adb.shell(['appops', 'set', SETTINGS_HELPER_PKG_ID, 'PROJECT_MEDIA', 'allow']);
      } catch (err) {
        logger.debug((err as Error).message);
      }
      try {
        await adb.shell([
          'cmd',
          'notification',
          'allow_listener',
          SETTING_NOTIFICATIONS_LISTENER_SERVICE,
        ]);
      } catch (err) {
        logger.debug((err as Error).message);
      }
    }
    if (apiLevel <= 23) {
      // Android 6- devices should have granted permissions
      // https://github.com/appium/appium/pull/11640#issuecomment-438260477
      const perms = ['SET_ANIMATION_SCALE', 'CHANGE_CONFIGURATION', 'ACCESS_FINE_LOCATION'];
      logger.info(`Granting permissions ${perms} to '${SETTINGS_HELPER_PKG_ID}'`);
      await adb.grantPermissions(
        SETTINGS_HELPER_PKG_ID,
        perms.map((x) => `android.permission.${x}`)
      );
    }

    // launch io.appium.settings app due to settings failing to be set
    // if the app is not launched prior to start the session on android 7+
    // see https://github.com/appium/appium/issues/8957
    try {
      await adb.requireRunningSettingsApp({
        timeout: AndroidHelpers.isEmulator(adb, opts) ? 30000 : 5000,
      });
    } catch (err) {
      logger.debug(err);
      if (throwError) {
        throw err;
      }
    }
  },

  async pushStrings(language, adb, opts) {
    const remoteDir = '/data/local/tmp';
    const stringsJson = 'strings.json';
    const remoteFile = path.posix.resolve(remoteDir, stringsJson);

    // clean up remote string.json if present
    await adb.rimraf(remoteFile);

    let app: string;
    try {
      app = opts.app || (await adb.pullApk(opts.appPackage!, opts.tmpDir!));
    } catch (err) {
      logger.info(
        `Failed to pull an apk from '${opts.appPackage}' to '${opts.tmpDir}'. Original error: ${
          (err as Error).message
        }`
      );
    }

    if (_.isEmpty(opts.appPackage) || !(await fs.exists(app!))) {
      logger.debug(`No app or package specified. Returning empty strings`);
      return {};
    }

    const stringsTmpDir = path.resolve(opts.tmpDir!, opts.appPackage!);
    try {
      logger.debug('Extracting strings from apk', app!, language, stringsTmpDir);
      const {apkStrings, localPath} = await adb.extractStringsFromApk(
        app!,
        language ?? null,
        stringsTmpDir
      );
      await adb.push(localPath, remoteDir);
      return apkStrings;
    } catch (err) {
      logger.warn(
        `Could not get strings, continuing anyway. Original error: ${(err as Error).message}`
      );
      await adb.shell(['echo', `'{}' > ${remoteFile}`]);
    } finally {
      await fs.rimraf(stringsTmpDir);
    }
    return {};
  },

  async unlock(driver, adb, capabilities) {
    if (!(await adb.isScreenLocked())) {
      logger.info('Screen already unlocked, doing nothing');
      return;
    }

    logger.debug('Screen is locked, trying to unlock');
    if (!capabilities.unlockType && !capabilities.unlockKey) {
      logger.info(
        `Neither 'unlockType' nor 'unlockKey' capability is provided. ` +
          `Assuming the device is locked with a simple lock screen.`
      );
      await adb.dismissKeyguard();
      return;
    }

    const {unlockType, unlockKey, unlockStrategy, unlockSuccessTimeout} =
      Unlocker.validateUnlockCapabilities(capabilities);
    if (
      unlockKey &&
      unlockType !== FINGERPRINT_UNLOCK &&
      (_.isNil(unlockStrategy) || _.toLower(unlockStrategy) === 'locksettings') &&
      (await adb.isLockManagementSupported())
    ) {
      await Unlocker.fastUnlock(adb, {
        credential: unlockKey,
        credentialType: toCredentialType(unlockType as UnlockType),
      });
    } else {
      const unlockMethod = {
        [PIN_UNLOCK]: Unlocker.pinUnlock,
        [PIN_UNLOCK_KEY_EVENT]: Unlocker.pinUnlockWithKeyEvent,
        [PASSWORD_UNLOCK]: Unlocker.passwordUnlock,
        [PATTERN_UNLOCK]: Unlocker.patternUnlock,
        [FINGERPRINT_UNLOCK]: Unlocker.fingerprintUnlock,
      }[unlockType!];
      await unlockMethod!(adb, driver, capabilities);
    }
    await AndroidHelpers.verifyUnlock(adb, unlockSuccessTimeout);
  },

  async verifyUnlock(adb, timeoutMs = null) {
    try {
      await waitForCondition(async () => !(await adb.isScreenLocked()), {
        waitMs: timeoutMs ?? 2000,
        intervalMs: 500,
      });
    } catch (ign) {
      throw new Error('The device has failed to be unlocked');
    }
    logger.info('The device has been successfully unlocked');
  },

  async initDevice(adb, opts) {
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
      if (AndroidHelpers.isEmulator(adb, opts)) {
        // Check if the device wake up only for an emulator.
        // It takes 1 second or so even when the device is already awake in a real device.
        await adb.waitForDevice();
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
          disableWindowAnimation ||
          !skipUnlock
      );
      await AndroidHelpers.pushSettingsApp(adb, shouldThrowError, opts);
    }

    if (!AndroidHelpers.isEmulator(adb, opts)) {
      if (mockLocationApp || _.isUndefined(mockLocationApp)) {
        await AndroidHelpers.setMockLocationApp(adb, mockLocationApp || SETTINGS_HELPER_PKG_ID);
      } else {
        await AndroidHelpers.resetMockLocation(adb);
      }
    }

    if (language || locale) {
      await AndroidHelpers.ensureDeviceLocale(adb, language, locale, localeScript);
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
      return await AndroidHelpers.initUnicodeKeyboard(adb);
    }
  },

  removeNullProperties(obj) {
    for (const key of _.keys(obj)) {
      if (_.isNull(obj[key]) || _.isUndefined(obj[key])) {
        delete obj[key];
      }
    }
  },

  truncateDecimals(number, digits) {
    const multiplier = Math.pow(10, digits),
      adjustedNum = number * multiplier,
      truncatedNum = Math[adjustedNum < 0 ? 'ceil' : 'floor'](adjustedNum);

    return truncatedNum / multiplier;
  },

  isChromeBrowser(browser) {
    return _.includes(Object.keys(CHROME_BROWSER_PACKAGE_ACTIVITY), (browser || '').toLowerCase());
  },

  getChromePkg(browser) {
    return (
      CHROME_BROWSER_PACKAGE_ACTIVITY[
        browser.toLowerCase() as keyof typeof CHROME_BROWSER_PACKAGE_ACTIVITY
      ] || CHROME_BROWSER_PACKAGE_ACTIVITY.default
    );
  },

  async removeAllSessionWebSocketHandlers(server, sessionId) {
    if (!server || !_.isFunction(server.getWebSocketHandlers)) {
      return;
    }

    const activeHandlers = await server.getWebSocketHandlers(sessionId);
    for (const pathname of _.keys(activeHandlers)) {
      await server.removeWebSocketHandler(pathname);
    }
  },

  parseArray(cap) {
    let parsedCaps: string | string[] | undefined;
    try {
      parsedCaps = JSON.parse(cap as string);
    } catch (ign) {}

    if (_.isArray(parsedCaps)) {
      return parsedCaps;
    } else if (_.isString(cap)) {
      return [cap];
    }

    throw new Error(`must provide a string or JSON Array; received ${cap}`);
  },

  validateDesiredCaps(caps) {
    if (caps.browserName) {
      if (caps.app) {
        // warn if the capabilities have both `app` and `browser, although this is common with selenium grid
        logger.warn(
          `The desired capabilities should generally not include both an 'app' and a 'browserName'`
        );
      }
      if (caps.appPackage) {
        logger.errorAndThrow(
          `The desired should not include both of an 'appPackage' and a 'browserName'`
        );
      }
    }

    if (caps.uninstallOtherPackages) {
      try {
        AndroidHelpers.parseArray(caps.uninstallOtherPackages);
      } catch (e) {
        logger.errorAndThrow(
          `Could not parse "uninstallOtherPackages" capability: ${(e as Error).message}`
        );
      }
    }

    return true;
  },

  adjustBrowserSessionCaps(caps) {
    const {browserName} = caps;
    logger.info(`The current session is considered browser-based`);
    logger.info(
      `Supported browser names: ${JSON.stringify(_.keys(CHROME_BROWSER_PACKAGE_ACTIVITY))}`
    );
    if (caps.appPackage || caps.appActivity) {
      logger.info(
        `Not overriding appPackage/appActivity capability values for '${browserName}' ` +
          'because some of them have been already provided'
      );
      return caps;
    }

    const {pkg, activity} = AndroidHelpers.getChromePkg(String(browserName));
    caps.appPackage = pkg;
    caps.appActivity = activity;
    logger.info(
      `appPackage/appActivity capabilities have been automatically set to ${pkg}/${activity} ` +
        `for '${browserName}'`
    );
    logger.info(
      `Consider changing the browserName to the one from the list of supported browser names ` +
        `or provide custom appPackage/appActivity capability values if the automatically assigned ones do ` +
        `not make sense`
    );
    return caps;
  },

  isEmulator(adb, opts) {
    const possibleNames = [opts?.udid, adb?.curDeviceId];
    return !!opts?.avd || possibleNames.some((x) => EMULATOR_PATTERN.test(String(x)));
  },
  unlocker: Unlocker,
};

export const helpers = AndroidHelpers;
export {APP_STATE, SETTINGS_HELPER_PKG_ID, ensureNetworkSpeed, prepareAvdArgs};
export default AndroidHelpers;
