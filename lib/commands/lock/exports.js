import B from 'bluebird';
import {
  validateUnlockCapabilities,
  FINGERPRINT_UNLOCK,
  fastUnlock,
  PIN_UNLOCK,
  pinUnlock,
  PIN_UNLOCK_KEY_EVENT,
  pinUnlockWithKeyEvent,
  PASSWORD_UNLOCK,
  passwordUnlock,
  PATTERN_UNLOCK,
  patternUnlock,
  fingerprintUnlock,
  toCredentialType,
  verifyUnlock,
} from './helpers';
import _ from 'lodash';

/**
 * @this {AndroidDriver}
 * @param {number} [seconds]
 * @returns {Promise<void>}
 */
export async function lock(seconds) {
  await this.adb.lock();
  if (Number.isNaN(seconds)) {
    return;
  }

  const floatSeconds = parseFloat(String(seconds));
  if (floatSeconds <= 0) {
    return;
  }
  await B.delay(1000 * floatSeconds);
  await this.unlock();
}

/**
 * @this {AndroidDriver}
 * @returns {Promise<boolean>}
 */
export async function isLocked() {
  return await this.adb.isScreenLocked();
}

/**
 * @this {AndroidDriver}
 * @returns {Promise<void>}
 */
export async function unlock() {
  await unlockWithOptions.bind(this)();
}

/**
 * @this {AndroidDriver}
 * @param {string} [key] The unlock key. The value of this key depends on the actual unlock type and
 * could be a pin/password/pattern value or a biometric finger id.
 * If not provided then the corresponding value from session capabilities is
 * used.
 * @param {import('../types').UnlockType} [type] The unlock type.
 * If not provided then the corresponding value from session capabilities is used.
 * @param {string} [strategy] Setting it to 'uiautomator' will enforce the driver to avoid using special
 * ADB shortcuts in order to speed up the unlock procedure.
 * 'uiautomator' by default.
 * @param {number} [timeoutMs] The maximum time in milliseconds to wait until the screen gets unlocked
 * 2000ms byde fault.
 * @returns {Promise<void>}
 */
export async function mobileUnlock(key, type, strategy, timeoutMs) {
  if (!key && !type) {
    await this.unlock();
  } else {
    await unlockWithOptions.bind(this)({
      unlockKey: key,
      unlockType: type,
      unlockStrategy: strategy,
      unlockSuccessTimeout: timeoutMs,
    });
  }
}

// #region Internal Helpers

/**
 * @this {AndroidDriver}
 * @param {AndroidDriverCaps?} [caps=null]
 * @returns {Promise<void>}
 */
export async function unlockWithOptions(caps = null) {
  if (!(await this.adb.isScreenLocked())) {
    this.log.info('Screen already unlocked, doing nothing');
    return;
  }

  const capabilities = caps ?? this.opts;
  this.log.debug('Screen is locked, trying to unlock');
  if (!capabilities.unlockType && !capabilities.unlockKey) {
    this.log.info(
      `Neither 'unlockType' nor 'unlockKey' capability is provided. ` +
        `Assuming the device is locked with a simple lock screen.`,
    );
    await this.adb.dismissKeyguard();
    return;
  }

  const {unlockType, unlockKey, unlockStrategy, unlockSuccessTimeout} =
    validateUnlockCapabilities(capabilities);
  if (
    unlockKey &&
    unlockType !== FINGERPRINT_UNLOCK &&
    (_.isNil(unlockStrategy) || _.toLower(unlockStrategy) === 'locksettings') &&
    (await this.adb.isLockManagementSupported())
  ) {
    await fastUnlock.bind(this)({
      credential: unlockKey,
      credentialType: toCredentialType(/** @type {import('../types').UnlockType} */ (unlockType)),
    });
  } else {
    const unlockMethod = {
      [PIN_UNLOCK]: pinUnlock,
      [PIN_UNLOCK_KEY_EVENT]: pinUnlockWithKeyEvent,
      [PASSWORD_UNLOCK]: passwordUnlock,
      [PATTERN_UNLOCK]: patternUnlock,
      [FINGERPRINT_UNLOCK]: fingerprintUnlock,
    }[unlockType];
    await unlockMethod.bind(this)(capabilities);
  }
  await verifyUnlock.bind(this)(unlockSuccessTimeout);
}

// #endregion

/**
 * @typedef {import('@appium/types').Capabilities<import('../../constraints').AndroidDriverConstraints>} AndroidDriverCaps
 * @typedef {import('../../driver').AndroidDriver} AndroidDriver
 */
