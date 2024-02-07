import {util} from '@appium/support';
import {sleep, waitForCondition} from 'asyncbox';
import _ from 'lodash';

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
export const KEYCODE_NUMPAD_ENTER = 66;
export const UNLOCK_WAIT_TIME = 100;
export const INPUT_KEYS_WAIT_TIME = 100;
const NUMBER_ZERO_KEYCODE = 7;
const TOUCH_DELAY_MS = 1000;

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
 * @param {import('../types').UnlockType} unlockType
 * @returns {string}
 */
export function toCredentialType(unlockType) {
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
 * @template {AndroidDriverCaps} T
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
        `Unlock key value '${unlockKey}' must only include from two to nine digits in range 1..9`,
      );
    }
    if (/([1-9]).*?\1/.test(_.trim(unlockKey))) {
      throw new Error(
        `Unlock key value '${unlockKey}' must define a valid pattern where repeats are not allowed`,
      );
    }
  } else if (unlockType === PASSWORD_UNLOCK) {
    // Dont trim password key, you can use blank spaces in your android password
    // ¯\_(ツ)_/¯
    if (!/.{4,}/g.test(String(unlockKey))) {
      throw new Error(
        `The minimum allowed length of unlock key value '${unlockKey}' is 4 characters`,
      );
    }
  } else {
    throw new Error(
      `Invalid unlock type '${unlockType}'. ` +
        `Only the following unlock types are supported: ${UNLOCK_TYPES}`,
    );
  }
  return caps;
}

/**
 * @this {AndroidDriver}
 * @param {import('../types').FastUnlockOptions} opts
 */
export async function fastUnlock(opts) {
  const {credential, credentialType} = opts;
  this.log.info(`Unlocking the device via ADB using ${credentialType} credential '${credential}'`);
  const wasLockEnabled = await this.adb.isLockEnabled();
  if (wasLockEnabled) {
    await this.adb.clearLockCredential(credential);
    // not sure why, but the device's screen still remains locked
    // if a preliminary wake up cycle has not been performed
    await this.adb.cycleWakeUp();
  } else {
    this.log.info('No active lock has been detected. Proceeding to the keyguard dismissal');
  }
  try {
    await this.adb.dismissKeyguard();
  } finally {
    if (wasLockEnabled) {
      await this.adb.setLockCredential(credentialType, credential);
    }
  }
}

/**
 *
 * @param {string} key
 * @returns {string}
 */
export function encodePassword(key) {
  return `${key}`.replace(/\s/gi, '%s');
}

/**
 *
 * @param {string} key
 * @returns {string[]}
 */
export function stringKeyToArr(key) {
  return `${key}`.trim().replace(/\s+/g, '').split(/\s*/);
}

/**
 * @this {AndroidDriver}
 * @param {AndroidDriverCaps} capabilities
 * @returns {Promise<void>}
 */
export async function fingerprintUnlock(capabilities) {
  if ((await this.adb.getApiLevel()) < 23) {
    throw new Error('Fingerprint unlock only works for Android 6+ emulators');
  }
  await this.adb.fingerprint(String(capabilities.unlockKey));
  await sleep(UNLOCK_WAIT_TIME);
}

/**
 * @this {AndroidDriver}
 * @param {AndroidDriverCaps} capabilities
 * @returns {Promise<void>}
 */
export async function pinUnlock(capabilities) {
  this.log.info(`Trying to unlock device using pin ${capabilities.unlockKey}`);
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
      let el;
      try {
        el = await this.findElOrEls('id', `com.android.keyguard:id/key${pin}`, false);
      } catch (ign) {
        return await pinUnlockWithKeyEvent.bind(this)(capabilities);
      }
      await this.click(util.unwrapElement(el));
    }
  }
  await waitForUnlock(this.adb);
}

/**
 * @this {AndroidDriver}
 * @param {AndroidDriverCaps} capabilities
 * @returns {Promise<void>}
 */
export async function pinUnlockWithKeyEvent(capabilities) {
  this.log.info(`Trying to unlock device using pin with keycode ${capabilities.unlockKey}`);
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
 * @this {AndroidDriver}
 * @param {AndroidDriverCaps} capabilities
 * @returns {Promise<void>}
 */
export async function passwordUnlock(capabilities) {
  const {unlockKey} = capabilities;
  this.log.info(`Trying to unlock device using password ${unlockKey}`);
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
export function getPatternKeyPosition(key, initPos, piece) {
  /*
  How the math works:
  We have 9 buttons divided in 3 columns and 3 rows inside the lockPatternView,
  every button has a position on the screen corresponding to the lockPatternView since
  it is the parent view right at the middle of each column or row.
  */
  const cols = 3;
  const pins = 9;
  const xPos = (key, x, piece) => Math.round(x + (key % cols || cols) * piece - piece / 2);
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
 * @returns {import('@appium/types').StringRecord[]}
 */
export function getPatternActions(keys, initPos, piece) {
  /** @type {import('@appium/types').StringRecord[]} */
  // https://www.w3.org/TR/webdriver2/#actions
  const pointerActions = [];
  /** @type {number[]} */
  const intKeys = keys.map((key) => (_.isString(key) ? _.parseInt(key) : key));
  /** @type {import('@appium/types').Position|undefined} */
  let lastPos;
  for (const key of intKeys) {
    const keyPos = getPatternKeyPosition(key, initPos, piece);
    if (!lastPos) {
      pointerActions.push(
        {type: 'pointerMove', duration: TOUCH_DELAY_MS, x: keyPos.x, y: keyPos.y},
        {type: 'pointerDown', button: 0},
      );
      lastPos = keyPos;
      continue;
    }
    const moveTo = {x: 0, y: 0};
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
    pointerActions.push({
      type: 'pointerMove',
      duration: TOUCH_DELAY_MS,
      x: moveTo.x + lastPos.x,
      y: moveTo.y + lastPos.y
    });
    lastPos = keyPos;
  }
  pointerActions.push({type: 'pointerUp', button: 0});
  return [{
    type: 'pointer',
    id: 'patternUnlock',
    parameters: {
      pointerType: 'touch',
    },
    actions: pointerActions,
  }];
}

/**
 * @this {AndroidDriver}
 * @param {number?} [timeoutMs=null]
 */
export async function verifyUnlock(timeoutMs = null) {
  try {
    await waitForCondition(async () => !(await this.adb.isScreenLocked()), {
      waitMs: timeoutMs ?? 2000,
      intervalMs: 500,
    });
  } catch (ign) {
    throw new Error('The device has failed to be unlocked');
  }
  this.log.info('The device has been successfully unlocked');
}

/**
 * @this {AndroidDriver}
 * @param {AndroidDriverCaps} capabilities
 */
export async function patternUnlock(capabilities) {
  const {unlockKey} = capabilities;
  this.log.info(`Trying to unlock device using pattern ${unlockKey}`);
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
    false,
  );
  const initPos = await this.getLocation(util.unwrapElement(el));
  const size = await this.getSize(util.unwrapElement(el));
  // Get actions to perform
  const actions = getPatternActions(keys, initPos, size.width / 3);
  // Perform gesture
  await this.performActions(actions);
  // Waits a bit for the device to be unlocked
  await sleep(UNLOCK_WAIT_TIME);
}

/**
 * @typedef {import('@appium/types').Capabilities<import('../../constraints').AndroidDriverConstraints>} AndroidDriverCaps
 * @typedef {import('../../driver').AndroidDriver} AndroidDriver
 */
