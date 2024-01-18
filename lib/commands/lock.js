import B from 'bluebird';
import {util} from '@appium/support';
import {sleep, waitForCondition} from 'asyncbox';
import _ from 'lodash';
import logger from '../logger';

export const PIN_UNLOCK = 'pin';
export const PIN_UNLOCK_KEY_EVENT = 'pinWithKeyEvent';
export const PASSWORD_UNLOCK = 'password';
export const PATTERN_UNLOCK = 'pattern';
export const FINGERPRINT_UNLOCK = 'fingerprint';
const UNLOCK_TYPES = /** @type {const}  */ ([
  PIN_UNLOCK,
  PIN_UNLOCK_KEY_EVENT,
  PASSWORD_UNLOCK,
  PATTERN_UNLOCK,
  FINGERPRINT_UNLOCK,
]);
const KEYCODE_NUMPAD_ENTER = 66;
const UNLOCK_WAIT_TIME = 100;
const INPUT_KEYS_WAIT_TIME = 100;
const NUMBER_ZERO_KEYCODE = 7;

/**
 * @this {import('../driver').AndroidDriver}
 * @param {import('./types').LockOpts} opts
 * @returns {Promise<void>}
 */
export async function mobileLock(opts = {}) {
  const {seconds} = opts;
  return await this.lock(seconds);
}

/**
 * @this {import('../driver').AndroidDriver}
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
 * @this {import('../driver').AndroidDriver}
 * @returns {Promise<boolean>}
 */
export async function isLocked() {
  return await this.adb.isScreenLocked();
}

/**
 * @this {import('../driver').AndroidDriver}
 * @returns {Promise<void>}
 */
export async function unlock() {
  await unlockWithOptions.bind(this)();
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {import('./types').UnlockOptions} [opts={}]
 * @returns {Promise<void>}
 */
export async function mobileUnlock(opts = {}) {
  const {key, type, strategy, timeoutMs} = opts;
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

// #region Internal helpers

/**
 *
 * @param {any} value
 * @returns {value is string}
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value !== '';
}

/**
 * Wait for the display to be unlocked.
 * Some devices automatically accept typed 'pin' and 'password' code
 * without pressing the Enter key. But some devices need it.
 * This method waits a few seconds first for such automatic acceptance case.
 * If the device is still locked, then this method will try to send
 * the enter key code.
 *
 * @param {import('appium-adb').ADB} adb The instance of ADB
 */
async function waitForUnlock(adb) {
  await sleep(UNLOCK_WAIT_TIME);
  if (!(await adb.isScreenLocked())) {
    return;
  }

  await adb.keyevent(KEYCODE_NUMPAD_ENTER);
  await sleep(UNLOCK_WAIT_TIME);
}

/**
 *
 * @param {import('./types').UnlockType} unlockType
 * @returns {string}
 */
function toCredentialType(unlockType) {
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

/**
 * @template {import('@appium/types').Capabilities<import('../constraints').AndroidDriverConstraints>} T
 * @param {T} caps
 * @returns {T}
 */
export function validateUnlockCapabilities(caps) {
  const {unlockKey, unlockType} = caps ?? {};
  if (!isNonEmptyString(unlockType)) {
    throw new Error('A non-empty unlock key value must be provided');
  }

  if ([PIN_UNLOCK, PIN_UNLOCK_KEY_EVENT, FINGERPRINT_UNLOCK].includes(unlockType)) {
    if (!/^[0-9]+$/.test(_.trim(unlockKey))) {
      throw new Error(`Unlock key value '${unlockKey}' must only consist of digits`);
    }
  } else if (unlockType === PATTERN_UNLOCK) {
    if (!/^[1-9]{2,9}$/.test(_.trim(unlockKey))) {
      throw new Error(
        `Unlock key value '${unlockKey}' must only include from two to nine digits in range 1..9`
      );
    }
    if (/([1-9]).*?\1/.test(_.trim(unlockKey))) {
      throw new Error(
        `Unlock key value '${unlockKey}' must define a valid pattern where repeats are not allowed`
      );
    }
  } else if (unlockType === PASSWORD_UNLOCK) {
    // Dont trim password key, you can use blank spaces in your android password
    // ¯\_(ツ)_/¯
    if (!/.{4,}/g.test(String(unlockKey))) {
      throw new Error(
        `The minimum allowed length of unlock key value '${unlockKey}' is 4 characters`
      );
    }
  } else {
    throw new Error(
      `Invalid unlock type '${unlockType}'. ` +
        `Only the following unlock types are supported: ${UNLOCK_TYPES}`
    );
  }
  return caps;
}

/**
 *
 * @param {import('appium-adb').ADB} adb
 * @param {import('./types').FastUnlockOptions} opts
 */
async function fastUnlock(adb, opts) {
  const {credential, credentialType} = opts;
  logger.info(`Unlocking the device via ADB using ${credentialType} credential '${credential}'`);
  const wasLockEnabled = await adb.isLockEnabled();
  if (wasLockEnabled) {
    await adb.clearLockCredential(credential);
    // not sure why, but the device's screen still remains locked
    // if a preliminary wake up cycle has not been performed
    await adb.cycleWakeUp();
  } else {
    logger.info('No active lock has been detected. Proceeding to the keyguard dismissal');
  }
  try {
    await adb.dismissKeyguard();
  } finally {
    if (wasLockEnabled) {
      await adb.setLockCredential(credentialType, credential);
    }
  }
}

/**
 *
 * @param {string} key
 * @returns {string}
 */
function encodePassword(key) {
  return `${key}`.replace(/\s/gi, '%s');
}

/**
 *
 * @param {string} key
 * @returns {string[]}
 */
function stringKeyToArr(key) {
  return `${key}`.trim().replace(/\s+/g, '').split(/\s*/);
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {AndroidDriverCaps} capabilities
 * @returns {Promise<void>}
 */
async function fingerprintUnlock(capabilities) {
  if ((await this.adb.getApiLevel()) < 23) {
    throw new Error('Fingerprint unlock only works for Android 6+ emulators');
  }
  await this.adb.fingerprint(String(capabilities.unlockKey));
  await sleep(UNLOCK_WAIT_TIME);
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {AndroidDriverCaps} capabilities
 * @returns {Promise<void>}
 */
async function pinUnlock(capabilities) {
  logger.info(`Trying to unlock device using pin ${capabilities.unlockKey}`);
  await this.adb.dismissKeyguard();
  const keys = stringKeyToArr(String(capabilities.unlockKey));
  if ((await this.adb.getApiLevel()) >= 21) {
    const els = await this.findElOrEls('id', 'com.android.systemui:id/digit_text', true);
    if (_.isEmpty(els)) {
      // fallback to pin with key event
      return await pinUnlockWithKeyEvent.bind(this)(capabilities);
    }
    const pins = {};
    for (const el of els) {
      const text = await this.getAttribute('text', util.unwrapElement(el));
      pins[text] = el;
    }
    for (const pin of keys) {
      const el = pins[pin];
      await this.click(util.unwrapElement(el));
    }
  } else {
    for (const pin of keys) {
      const el = await this.findElOrEls('id', `com.android.keyguard:id/key${pin}`, false);
      if (el === null) {
        // fallback to pin with key event
        return await pinUnlockWithKeyEvent.bind(this)(capabilities);
      }
      await this.click(util.unwrapElement(el));
    }
  }
  await waitForUnlock(this.adb);
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {AndroidDriverCaps} capabilities
 * @returns {Promise<void>}
 */
async function pinUnlockWithKeyEvent(capabilities) {
  logger.info(`Trying to unlock device using pin with keycode ${capabilities.unlockKey}`);
  await this.adb.dismissKeyguard();
  const keys = stringKeyToArr(String(capabilities.unlockKey));

  // Some device does not have system key ids like 'com.android.keyguard:id/key'
  // Then, sending keyevents are more reliable to unlock the screen.
  for (const pin of keys) {
    // 'pin' is number (0-9) in string.
    // Number '0' is keycode '7'. number '9' is keycode '16'.
    await this.adb.shell(['input', 'keyevent', String(parseInt(pin, 10) + NUMBER_ZERO_KEYCODE)]);
  }
  await waitForUnlock(this.adb);
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {AndroidDriverCaps} capabilities
 * @returns {Promise<void>}
 */
async function passwordUnlock(capabilities) {
  const {unlockKey} = capabilities;
  logger.info(`Trying to unlock device using password ${unlockKey}`);
  await this.adb.dismissKeyguard();
  // Replace blank spaces with %s
  const key = encodePassword(String(unlockKey));
  // Why adb ? It was less flaky
  await this.adb.shell(['input', 'text', key]);
  // Why sleeps ? Avoid some flakyness waiting for the input to receive the keys
  await sleep(INPUT_KEYS_WAIT_TIME);
  await this.adb.shell(['input', 'keyevent', String(KEYCODE_NUMPAD_ENTER)]);
  // Waits a bit for the device to be unlocked
  await waitForUnlock(this.adb);
}

/**
 *
 * @param {number} key
 * @param {import('@appium/types').Position} initPos
 * @param {number} piece
 * @returns {import('@appium/types').Position}
 */
function getPatternKeyPosition(key, initPos, piece) {
  /*
  How the math works:
  We have 9 buttons divided in 3 columns and 3 rows inside the lockPatternView,
  every button has a position on the screen corresponding to the lockPatternView since
  it is the parent view right at the middle of each column or row.
  */
  const cols = 3;
  const pins = 9;
  const xPos = (key, x, piece) =>
    Math.round(x + (key % cols || cols) * piece - piece / 2);
  const yPos = (key, y, piece) =>
    Math.round(y + (Math.ceil((key % pins || pins) / cols) * piece - piece / 2));
  return {
    x: xPos(key, initPos.x, piece),
    y: yPos(key, initPos.y, piece),
  };
}

/**
 * @param {string[]|number[]} keys
 * @param {import('@appium/types').Position} initPos
 * @param {number} piece
 * @returns {import('./types').TouchAction[]}
 */
function getPatternActions(keys, initPos, piece) {
  /** @type {import('./types').TouchAction[]} */
  const actions = [];
  /** @type {number[]} */
  const intKeys = keys.map((key) => (_.isString(key) ? _.parseInt(key) : key));
  /** @type {import('@appium/types').Position} */
  let lastPos;
  for (const key of intKeys) {
    const keyPos = getPatternKeyPosition(key, initPos, piece);
    if (key === keys[0]) {
      actions.push({action: 'press', options: {element: undefined, x: keyPos.x, y: keyPos.y}});
      lastPos = keyPos;
      continue;
    }
    const moveTo = {x: 0, y: 0};
    // @ts-ignore lastPos should be defined
    const diffX = keyPos.x - lastPos.x;
    if (diffX > 0) {
      moveTo.x = piece;
      if (Math.abs(diffX) > piece) {
        moveTo.x += piece;
      }
    } else if (diffX < 0) {
      moveTo.x = -1 * piece;
      if (Math.abs(diffX) > piece) {
        moveTo.x -= piece;
      }
    }
    // @ts-ignore lastPos should be defined
    const diffY = keyPos.y - lastPos.y;
    if (diffY > 0) {
      moveTo.y = piece;
      if (Math.abs(diffY) > piece) {
        moveTo.y += piece;
      }
    } else if (diffY < 0) {
      moveTo.y = -1 * piece;
      if (Math.abs(diffY) > piece) {
        moveTo.y -= piece;
      }
    }
    actions.push({
      action: 'moveTo',
      // @ts-ignore lastPos should be defined
      options: {element: undefined, x: moveTo.x + lastPos.x, y: moveTo.y + lastPos.y},
    });
    lastPos = keyPos;
  }
  actions.push({action: 'release'});
  return actions;
}

/**
 * @param {import('appium-adb').ADB} adb
 * @param {number?} [timeoutMs=null]
 */
async function verifyUnlock(adb, timeoutMs = null) {
  try {
    await waitForCondition(async () => !(await adb.isScreenLocked()), {
      waitMs: timeoutMs ?? 2000,
      intervalMs: 500,
    });
  } catch (ign) {
    throw new Error('The device has failed to be unlocked');
  }
  logger.info('The device has been successfully unlocked');
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {AndroidDriverCaps} capabilities
 */
async function patternUnlock(capabilities) {
  const {unlockKey} = capabilities;
  logger.info(`Trying to unlock device using pattern ${unlockKey}`);
  await this.adb.dismissKeyguard();
  const keys = stringKeyToArr(String(unlockKey));
  /* We set the device pattern buttons as number of a regular phone
    *  | • • • |     | 1 2 3 |
    *  | • • • | --> | 4 5 6 |
    *  | • • • |     | 7 8 9 |

  The pattern view buttons are not seeing by the uiautomator since they are
  included inside a FrameLayout, so we are going to try clicking on the buttons
  using the parent view bounds and math.
  */
  const apiLevel = await this.adb.getApiLevel();
  const el = await this.findElOrEls(
    'id',
    `com.android.${apiLevel >= 21 ? 'systemui' : 'keyguard'}:id/lockPatternView`,
    false
  );
  const initPos = await this.getLocation(util.unwrapElement(el));
  const size = await this.getSize(util.unwrapElement(el));
  // Get actions to perform
  const actions = getPatternActions(keys, initPos, size.width / 3);
  // Perform gesture
  await this.performTouch(actions);
  // Waits a bit for the device to be unlocked
  await sleep(UNLOCK_WAIT_TIME);
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {AndroidDriverCaps?} [caps=null]
 * @returns {Promise<void>}
 */
async function unlockWithOptions(caps = null) {
  if (!(await this.adb.isScreenLocked())) {
    logger.info('Screen already unlocked, doing nothing');
    return;
  }

  const capabilities = caps ?? this.opts;
  logger.debug('Screen is locked, trying to unlock');
  if (!capabilities.unlockType && !capabilities.unlockKey) {
    logger.info(
      `Neither 'unlockType' nor 'unlockKey' capability is provided. ` +
        `Assuming the device is locked with a simple lock screen.`
    );
    await this.adb.dismissKeyguard();
    return;
  }

  const {
    unlockType,
    unlockKey,
    unlockStrategy,
    unlockSuccessTimeout
  } = validateUnlockCapabilities(capabilities);
  if (
    unlockKey &&
    unlockType !== FINGERPRINT_UNLOCK &&
    (_.isNil(unlockStrategy) || _.toLower(unlockStrategy) === 'locksettings') &&
    (await this.adb.isLockManagementSupported())
  ) {
    await fastUnlock(this.adb, {
      credential: unlockKey,
      credentialType: toCredentialType(/** @type {import('./types').UnlockType} */(unlockType)),
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
  await verifyUnlock(this.adb, unlockSuccessTimeout);
}

// #endregion

/**
 * @typedef {import('@appium/types').Capabilities<import('../constraints').AndroidDriverConstraints>} AndroidDriverCaps
 */