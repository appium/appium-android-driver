import _ from 'lodash';
import { util } from '@appium/support';
import ADB from 'appium-adb';

/**
 * @this {import('../driver').AndroidDriver}
 * @returns {void}
 */
export function validatePackageActivityNames() {
  for (const key of ['appPackage', 'appActivity', 'appWaitPackage', 'appWaitActivity']) {
    const name = this.opts[key];
    if (!name) {
      continue;
    }

    const match = /([^\w.*,])+/.exec(String(name));
    if (!match) {
      continue;
    }

    this.log.warn(
      `Capability '${key}' is expected to only include latin letters, digits, underscore, dot, comma and asterisk characters.`
    );
    this.log.warn(
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
export function ensureNetworkSpeed(networkSpeed) {
  if (networkSpeed.toUpperCase() in this.adb.NETWORK_SPEED) {
    return networkSpeed;
  }
  this.log.warn(
    `Wrong network speed param '${networkSpeed}', using default: ${this.adb.NETWORK_SPEED.FULL}. ` +
      `Supported values: ${_.values(this.adb.NETWORK_SPEED)}`
  );
  return this.adb.NETWORK_SPEED.FULL;
}

/**
 * @this {import('../driver').AndroidDriver}
 * @returns {string[]}
 */
export function prepareAvdArgs() {
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
export async function prepareEmulator() {
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

/**
 * @param {import('../driver').AndroidDriverOpts?} [opts=null]
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
