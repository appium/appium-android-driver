import _ from 'lodash';
import {util} from '@appium/support';
import ADB from 'appium-adb';
import {retryInterval} from 'asyncbox';
import {
  path as SETTINGS_APK_PATH,
  SETTINGS_HELPER_ID,
  UNICODE_IME,
  EMPTY_IME,
} from 'io.appium.settings';
import B from 'bluebird';
import { prepareEmulatorForImageInjection } from '../image-injection';

const HELPER_APP_INSTALL_RETRIES = 3;
const HELPER_APP_INSTALL_RETRY_DELAY_MS = 5000;

/**
 * @this {import('../../driver').AndroidDriver}
 * @param {string} errMsg
 */
export function requireEmulator(errMsg) {
  if (!this.isEmulator()) {
    throw this.log.errorWithException(errMsg);
  }
}

/**
 * @this {import('../../driver').AndroidDriver}
 * @param {string} networkSpeed
 * @returns {string}
 */
export function ensureNetworkSpeed(networkSpeed) {
  if (networkSpeed.toUpperCase() in this.adb.NETWORK_SPEED) {
    return networkSpeed;
  }
  this.log.warn(
    `Wrong network speed param '${networkSpeed}', using default: ${this.adb.NETWORK_SPEED.FULL}. ` +
      `Supported values: ${_.values(this.adb.NETWORK_SPEED)}`,
  );
  return this.adb.NETWORK_SPEED.FULL;
}

/**
 * @this {import('../../driver').AndroidDriver}
 * @returns {string[]}
 */
export function prepareAvdArgs() {
  const {networkSpeed, isHeadless, avdArgs} = this.opts;
  const result = [];
  if (avdArgs) {
    if (_.isArray(avdArgs)) {
      result.push(...avdArgs);
    } else {
      result.push(...util.shellParse(`${avdArgs}`));
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
 * @this {import('../../driver').AndroidDriver}
 * @param {ADB} adb
 * @returns {Promise<void>}
 */
export async function prepareEmulator(adb) {
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
    // This API implicitly modifies curDeviceId and emulatorPort properties of the adb instance
    await adb.getRunningAVDWithRetry(avdName, 5000);
  } catch (e) {
    this.log.debug(`Emulator '${avdName}' is not running: ${e.message}`);
    isEmulatorRunning = false;
  }
  const args = prepareAvdArgs.bind(this)();
  if (isEmulatorRunning) {
    if (await prepareEmulatorForImageInjection.bind(this)(/** @type {string} */ (adb.sdkRoot))
      || args.includes('-wipe-data')) {
      this.log.debug(`Killing '${avdName}'`);
      await adb.killEmulator(avdName);
    } else {
      this.log.debug('Not launching AVD because it is already running.');
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
}

/**
 * @param {import('../../driver').AndroidDriverOpts?} [opts=null]
 * @returns {Promise<ADB>}
 */
export async function createBaseADB(opts = null) {
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
 * @this {import('../../driver').AndroidDriver}
 * @param {boolean} throwIfError
 * @returns {Promise<void>}
 */
export async function pushSettingsApp(throwIfError) {
  this.log.debug('Pushing settings apk to the device...');

  try {
    // Sometimes adb push or adb instal take more time than expected to install an app
    // e.g. https://github.com/appium/io.appium.settings/issues/40#issuecomment-476593174
    await retryInterval(
      HELPER_APP_INSTALL_RETRIES,
      HELPER_APP_INSTALL_RETRY_DELAY_MS,
      async () =>
        await this.adb.installOrUpgrade(SETTINGS_APK_PATH, SETTINGS_HELPER_ID, {
          grantPermissions: true,
        }),
    );
  } catch (err) {
    if (throwIfError) {
      throw err;
    }

    this.log.warn(
      `Ignored error while installing '${SETTINGS_APK_PATH}': ` +
        `'${err.message}'. Features that rely on this helper ` +
        'require the apk such as toggle WiFi and getting location ' +
        'will raise an error if you try to use them.',
    );
  }

  // Reinstall would stop the settings helper process anyway, so
  // there is no need to continue if the application is still running
  if (await this.settingsApp.isRunningInForeground()) {
    this.log.debug(
      `${SETTINGS_HELPER_ID} is already running. ` + `There is no need to reset its permissions.`,
    );
    return;
  }

  const fixSettingsAppPermissionsForLegacyApis = async () => {
    if ((await this.adb.getApiLevel()) > 23) {
      return;
    }

    // Android 6- devices should have granted permissions
    // https://github.com/appium/appium/pull/11640#issuecomment-438260477
    const perms = ['SET_ANIMATION_SCALE', 'CHANGE_CONFIGURATION', 'ACCESS_FINE_LOCATION'];
    this.log.info(`Granting permissions ${perms} to '${SETTINGS_HELPER_ID}'`);
    await this.adb.grantPermissions(
      SETTINGS_HELPER_ID,
      perms.map((x) => `android.permission.${x}`),
    );
  };

  try {
    await B.all([
      this.settingsApp.adjustNotificationsPermissions(),
      this.settingsApp.adjustMediaProjectionServicePermissions(),
      fixSettingsAppPermissionsForLegacyApis(),
    ]);
  } catch (e) {
    this.log.debug(e.stack);
  }

  // launch io.appium.settings app due to settings failing to be set
  // if the app is not launched prior to start the session on android 7+
  // see https://github.com/appium/appium/issues/8957
  try {
    await this.settingsApp.requireRunning({
      timeout: this.isEmulator() ? 30000 : 5000,
    });
  } catch (err) {
    this.log.debug(err.stack);
    if (throwIfError) {
      throw err;
    }
  }
}

/**
 * @deprecated
 * @this {import('../../driver').AndroidDriver}
 * @returns {Promise<string?>}
 */
export async function initUnicodeKeyboard() {
  this.log.debug('Enabling Unicode keyboard support');

  // get the default IME so we can return back to it later if we want
  const defaultIME = await this.adb.defaultIME();

  this.log.debug(`Unsetting previous IME ${defaultIME}`);
  this.log.debug(`Setting IME to '${UNICODE_IME}'`);
  await this.adb.enableIME(UNICODE_IME);
  await this.adb.setIME(UNICODE_IME);
  return defaultIME;
}

/**
 * @this {import('../../driver').AndroidDriver}
 * @returns {Promise<void>}
 */
export async function hideKeyboardCompletely() {
  this.log.debug(`Hiding the on-screen keyboard by setting IME to '${EMPTY_IME}'`);
  await this.adb.enableIME(EMPTY_IME);
  await this.adb.setIME(EMPTY_IME);
}
