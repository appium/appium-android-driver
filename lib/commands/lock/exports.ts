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
import type {AndroidDriver, AndroidDriverCaps} from '../../driver';
import type {UnlockType} from '../types';

/**
 * Locks the device and optionally unlocks it after a specified number of seconds.
 *
 * @param seconds - Optional number of seconds to wait before unlocking. If not provided or invalid, the device remains locked.
 */
export async function lock(this: AndroidDriver, seconds?: number): Promise<void> {
  await this.adb.lock();
  if (Number.isNaN(seconds ?? NaN)) {
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
 * Checks if the device screen is currently locked.
 *
 * @returns True if the screen is locked, false otherwise
 */
export async function isLocked(this: AndroidDriver): Promise<boolean> {
  return await this.adb.isScreenLocked();
}

/**
 * Unlocks the device using the unlock options from session capabilities.
 */
export async function unlock(this: AndroidDriver): Promise<void> {
  await unlockWithOptions.bind(this)();
}

/**
 * Unlocks the device with the specified options.
 *
 * @param key - The unlock key. The value of this key depends on the actual unlock type and
 *              could be a pin/password/pattern value or a biometric finger id.
 *              If not provided then the corresponding value from session capabilities is used.
 * @param type - The unlock type. If not provided then the corresponding value from session capabilities is used.
 * @param strategy - Setting it to 'uiautomator' will enforce the driver to avoid using special
 *                  ADB shortcuts in order to speed up the unlock procedure. 'uiautomator' by default.
 * @param timeoutMs - The maximum time in milliseconds to wait until the screen gets unlocked. 2000ms by default.
 */
export async function mobileUnlock(
  this: AndroidDriver,
  key?: string,
  type?: UnlockType,
  strategy?: string,
  timeoutMs?: number,
): Promise<void> {
  if (!key && !type) {
    await this.unlock();
  } else {
    await unlockWithOptions.bind(this)({
      unlockKey: key,
      unlockType: type,
      unlockStrategy: strategy,
      unlockSuccessTimeout: timeoutMs,
    } as AndroidDriverCaps);
  }
}

// #region Internal Helpers

/**
 * Unlocks the device with the specified capabilities.
 *
 * @param caps - Optional capabilities to use for unlocking. If not provided, uses session capabilities.
 */
export async function unlockWithOptions(
  this: AndroidDriver,
  caps: AndroidDriverCaps | null = null,
): Promise<void> {
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

  const validated = validateUnlockCapabilities(capabilities);
  const {unlockType, unlockKey, unlockStrategy, unlockSuccessTimeout} = validated;
  if (!unlockType) {
    throw new Error('unlockType is required after validation');
  }
  if (
    unlockKey &&
    unlockType !== FINGERPRINT_UNLOCK &&
    (_.isNil(unlockStrategy) || _.toLower(unlockStrategy) === 'locksettings') &&
    (await this.adb.isLockManagementSupported())
  ) {
    await fastUnlock.bind(this)({
      credential: unlockKey,
      credentialType: toCredentialType(unlockType as UnlockType),
    });
  } else {
    const unlockMethodMap: Record<string, (this: AndroidDriver, caps: AndroidDriverCaps) => Promise<void>> = {
      [PIN_UNLOCK]: pinUnlock,
      [PIN_UNLOCK_KEY_EVENT]: pinUnlockWithKeyEvent,
      [PASSWORD_UNLOCK]: passwordUnlock,
      [PATTERN_UNLOCK]: patternUnlock,
      [FINGERPRINT_UNLOCK]: fingerprintUnlock,
    };
    const unlockMethod = unlockMethodMap[unlockType];
    if (!unlockMethod) {
      throw new Error(`Unknown unlock type: ${unlockType}`);
    }
    await unlockMethod.bind(this)(capabilities);
  }
  await verifyUnlock.bind(this)(unlockSuccessTimeout);
}

// #endregion

