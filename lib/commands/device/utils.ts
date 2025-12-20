import _ from 'lodash';
import {util} from '@appium/support';
import {ADB} from 'appium-adb';
import {retryInterval} from 'asyncbox';
import {
  path as SETTINGS_APK_PATH,
  SETTINGS_HELPER_ID,
  UNICODE_IME,
  EMPTY_IME,
} from 'io.appium.settings';
import B from 'bluebird';
import {prepareEmulatorForImageInjection} from '../image-injection';
import {ADB_LISTEN_ALL_NETWORK_FEATURE} from '../../utils';
import type {AndroidDriver} from '../../driver';

const HELPER_APP_INSTALL_RETRIES = 3;
const HELPER_APP_INSTALL_RETRY_DELAY_MS = 5000;

/**
 * Requires that the current device is an emulator, throwing an error if not.
 *
 * @param errMsg - Error message to throw if not an emulator
 * @throws {Error} If the device is not an emulator
 */
export function requireEmulator(this: AndroidDriver, errMsg: string): void {
  if (!this.isEmulator()) {
    throw this.log.errorWithException(errMsg);
  }
}

/**
 * Ensures the network speed value is valid, returning the default if not.
 *
 * @param networkSpeed - The network speed value to validate
 * @returns The validated network speed value
 */
export function ensureNetworkSpeed(this: AndroidDriver, networkSpeed: string): string {
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
 * Prepares AVD arguments based on options.
 *
 * @returns An array of AVD arguments
 */
export function prepareAvdArgs(this: AndroidDriver): string[] {
  const {networkSpeed, isHeadless, avdArgs} = this.opts;
  const result: string[] = [];
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
 * Prepares and launches an emulator with the specified AVD name.
 *
 * @param adb - The ADB instance to use
 */
export async function prepareEmulator(this: AndroidDriver, adb: ADB): Promise<void> {
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
    const err = e as Error;
    this.log.debug(`Emulator '${avdName}' is not running: ${err.message}`);
    isEmulatorRunning = false;
  }
  const args = prepareAvdArgs.bind(this)();
  if (isEmulatorRunning) {
    if (await prepareEmulatorForImageInjection.bind(this)(adb.sdkRoot as string)
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
 * Creates a base ADB instance with options from driver configuration.
 *
 * @returns A configured ADB instance
 */
export async function createBaseADB(this: AndroidDriver): Promise<ADB> {
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
    adbListenAllNetwork,
  } = this.opts ?? {};

  if (adbListenAllNetwork) {
    this.assertFeatureEnabled(ADB_LISTEN_ALL_NETWORK_FEATURE);
  }

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
    listenAllNetwork: adbListenAllNetwork,
  });
}

/**
 * Pushes and installs the settings app on the device.
 *
 * @param throwIfError - Whether to throw an error if installation fails
 */
export async function pushSettingsApp(this: AndroidDriver, throwIfError: boolean): Promise<void> {
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
    const error = err as Error;
    if (throwIfError) {
      throw error;
    }

    this.log.warn(
      `Ignored error while installing '${SETTINGS_APK_PATH}': ` +
        `'${error.message}'. Features that rely on this helper ` +
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

  try {
    await B.all([
      this.settingsApp.adjustNotificationsPermissions(),
      this.settingsApp.adjustMediaProjectionServicePermissions(),
    ]);
  } catch (e) {
    const err = e as Error;
    this.log.debug(err.stack);
  }

  // launch io.appium.settings app due to settings failing to be set
  // if the app is not launched prior to start the session on android 7+
  // see https://github.com/appium/appium/issues/8957
  try {
    await this.settingsApp.requireRunning({
      timeout: this.isEmulator() ? 30000 : 5000,
    });
  } catch (err) {
    const error = err as Error;
    this.log.debug(error.stack);
    if (throwIfError) {
      throw error;
    }
  }
}

/**
 * @deprecated
 */
export async function initUnicodeKeyboard(this: AndroidDriver): Promise<string | null> {
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
 * Hides the on-screen keyboard completely by setting an empty IME.
 */
export async function hideKeyboardCompletely(this: AndroidDriver): Promise<void> {
  this.log.debug(`Hiding the on-screen keyboard by setting IME to '${EMPTY_IME}'`);
  await this.adb.enableIME(EMPTY_IME);
  await this.adb.setIME(EMPTY_IME);
}

