import logger from './logger';
import { sleep } from 'asyncbox';
import _ from 'lodash';
import { util } from 'appium-support';

const PIN_UNLOCK = 'pin';
const PIN_UNLOCK_KEY_EVENT = 'pinWithKeyEvent';
const PASSWORD_UNLOCK = 'password';
const PATTERN_UNLOCK = 'pattern';
const FINGERPRINT_UNLOCK = 'fingerprint';
const UNLOCK_TYPES = [
  PIN_UNLOCK, PIN_UNLOCK_KEY_EVENT, PASSWORD_UNLOCK,
  PATTERN_UNLOCK, FINGERPRINT_UNLOCK
];
const KEYCODE_NUMPAD_ENTER = 66;
const UNLOCK_WAIT_TIME = 100;
const INPUT_KEYS_WAIT_TIME = 100;
const NUMBER_ZERO_KEYCODE = 7;

const helpers = {};

helpers.validateUnlockCapabilities = function validateUnlockCapabilities (caps = {}) {
  const {
    unlockKey,
    unlockType,
  } = caps;
  if (_.isNil(unlockKey) || unlockKey === '') {
    throw new Error('A non-empty unlock key value must be provided');
  }

  if ([PIN_UNLOCK, PIN_UNLOCK_KEY_EVENT, FINGERPRINT_UNLOCK].includes(unlockType)) {
    if (!/^[0-9]+$/.test(_.trim(unlockKey))) {
      throw new Error(`Unlock key value '${unlockKey}' must only consist of digits`);
    }
  } else if (unlockType === PATTERN_UNLOCK) {
    if (!/^[1-9]{2,9}$/.test(_.trim(unlockKey))) {
      throw new Error(`Unlock key value '${unlockKey}' must only include from two to nine digits in range 1..9`);
    }
    if (/([1-9]).*?\1/.test(_.trim(unlockKey))) {
      throw new Error(`Unlock key value '${unlockKey}' must define a valid pattern where repeats are not allowed`);
    }
  } else if (unlockType === PASSWORD_UNLOCK) {
    // Dont trim password key, you can use blank spaces in your android password
    // ¯\_(ツ)_/¯
    if (!/.{4,}/g.test(unlockKey)) {
      throw new Error(`The minimum allowed length of unlock key value '${unlockKey}' is 4 characters`);
    }
  } else {
    throw new Error(`Invalid unlock type '${unlockType}'. ` +
      `Only the following unlock types are supported: ${UNLOCK_TYPES}`);
  }
  return caps;
};

helpers.fastUnlock = async function fastUnlock (adb, opts = {}) {
  const {
    credential,
    credentialType,
  } = opts;
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
};

helpers.encodePassword = function encodePassword (key) {
  return `${key}`.replace(/\s/ig, '%s');
};

helpers.stringKeyToArr = function stringKeyToArr (key) {
  return `${key}`.trim().replace(/\s+/g, '').split(/\s*/);
};

helpers.fingerprintUnlock = async function fingerprintUnlock (adb, driver, capabilities) {
  if (await adb.getApiLevel() < 23) {
    throw new Error('Fingerprint unlock only works for Android 6+ emulators');
  }
  await adb.fingerprint(capabilities.unlockKey);
  await sleep(UNLOCK_WAIT_TIME);
};

helpers.pinUnlock = async function pinUnlock (adb, driver, capabilities) {
  logger.info(`Trying to unlock device using pin ${capabilities.unlockKey}`);
  await adb.dismissKeyguard();
  const keys = helpers.stringKeyToArr(capabilities.unlockKey);
  if (await adb.getApiLevel() >= 21) {
    const els = await driver.findElOrEls('id', 'com.android.systemui:id/digit_text', true);
    if (_.isEmpty(els)) {
      // fallback to pin with key event
      return await helpers.pinUnlockWithKeyEvent(adb, driver, capabilities);
    }
    const pins = {};
    for (const el of els) {
      const text = await driver.getAttribute('text', util.unwrapElement(el));
      pins[text] = el;
    }
    for (const pin of keys) {
      const el = pins[pin];
      await driver.click(util.unwrapElement(el));
    }
  } else {
    for (const pin of keys) {
      const el = await driver.findElOrEls('id', `com.android.keyguard:id/key${pin}`, false);
      if (el === null) {
        // fallback to pin with key event
        return await helpers.pinUnlockWithKeyEvent(adb, driver, capabilities);
      }
      await driver.click(util.unwrapElement(el));
    }
  }
  await waitForUnlock(adb);
};

/**
 * Wait for the display to be unlocked.
 * Some devices automatically accept typed 'pin' and 'password' code
 * without pressing the Enter key. But some devices need it.
 * This method waits a few seconds first for such automatic acceptance case.
 * If the device is still locked, then this method will try to send
 * the enter key code.
 *
 * @param {ADB} adb The instance of ADB
 */
async function waitForUnlock (adb) {
  await sleep(UNLOCK_WAIT_TIME);
  if (!await adb.isScreenLocked()) {
    return;
  }

  await adb.keyevent(KEYCODE_NUMPAD_ENTER);
  await sleep(UNLOCK_WAIT_TIME);
}

helpers.pinUnlockWithKeyEvent = async function pinUnlockWithKeyEvent (adb, driver, capabilities) {
  logger.info(`Trying to unlock device using pin with keycode ${capabilities.unlockKey}`);
  await adb.dismissKeyguard();
  const keys = helpers.stringKeyToArr(capabilities.unlockKey);

  // Some device does not have system key ids like 'com.android.keyguard:id/key'
  // Then, sending keyevents are more reliable to unlock the screen.
  for (const pin of keys) {
    // 'pin' is number (0-9) in string.
    // Number '0' is keycode '7'. number '9' is keycode '16'.
    await adb.shell(['input', 'keyevent', parseInt(pin, 10) + NUMBER_ZERO_KEYCODE]);
  }
  await waitForUnlock(adb, driver);
};

helpers.passwordUnlock = async function passwordUnlock (adb, driver, capabilities) {
  const { unlockKey } = capabilities;
  logger.info(`Trying to unlock device using password ${unlockKey}`);
  await adb.dismissKeyguard();
  // Replace blank spaces with %s
  const key = helpers.encodePassword(unlockKey);
  // Why adb ? It was less flaky
  await adb.shell(['input', 'text', key]);
  // Why sleeps ? Avoid some flakyness waiting for the input to receive the keys
  await sleep(INPUT_KEYS_WAIT_TIME);
  await adb.shell(['input', 'keyevent', KEYCODE_NUMPAD_ENTER]);
  // Waits a bit for the device to be unlocked
  await waitForUnlock(adb, driver);
};

helpers.getPatternKeyPosition = function getPatternKeyPosition (key, initPos, piece) {
  /*
  How the math works:
  We have 9 buttons divided in 3 columns and 3 rows inside the lockPatternView,
  every button has a position on the screen corresponding to the lockPatternView since
  it is the parent view right at the middle of each column or row.
  */
  const cols = 3;
  const pins = 9;
  const xPos = (key, x, piece) => Math.round(x + ((key % cols) || cols) * piece - piece / 2);
  const yPos = (key, y, piece) => Math.round(y + (Math.ceil(((key % pins) || pins) / cols) * piece - piece / 2));
  return {
    x: xPos(key, initPos.x, piece),
    y: yPos(key, initPos.y, piece)
  };
};

helpers.getPatternActions = function getPatternActions (keys, initPos, piece) {
  const actions = [];
  let lastPos;
  for (let key of keys) {
    const keyPos = helpers.getPatternKeyPosition(key, initPos, piece);
    if (key === keys[0]) {
      actions.push({action: 'press', options: {element: null, x: keyPos.x, y: keyPos.y}});
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
    actions.push({
      action: 'moveTo',
      options: {element: null, x: moveTo.x + lastPos.x, y: moveTo.y + lastPos.y}
    });
    lastPos = keyPos;
  }
  actions.push({action: 'release'});
  return actions;
};

helpers.patternUnlock = async function patternUnlock (adb, driver, capabilities) {
  const { unlockKey } = capabilities;
  logger.info(`Trying to unlock device using pattern ${unlockKey}`);
  await adb.dismissKeyguard();
  const keys = helpers.stringKeyToArr(unlockKey);
  /* We set the device pattern buttons as number of a regular phone
   *  | • • • |     | 1 2 3 |
   *  | • • • | --> | 4 5 6 |
   *  | • • • |     | 7 8 9 |

  The pattern view buttons are not seeing by the uiautomator since they are
  included inside a FrameLayout, so we are going to try clicking on the buttons
  using the parent view bounds and math.
  */
  const apiLevel = await adb.getApiLevel();
  const el = await driver.findElOrEls('id',
    `com.android.${apiLevel >= 21 ? 'systemui' : 'keyguard'}:id/lockPatternView`,
    false
  );
  const initPos = await driver.getLocation(util.unwrapElement(el));
  const size = await driver.getSize(util.unwrapElement(el));
  // Get actions to perform
  const actions = helpers.getPatternActions(keys, initPos, size.width / 3);
  // Perform gesture
  await driver.performTouch(actions);
  // Waits a bit for the device to be unlocked
  await sleep(UNLOCK_WAIT_TIME);
};

helpers.PIN_UNLOCK = PIN_UNLOCK;
helpers.PIN_UNLOCK_KEY_EVENT = PIN_UNLOCK_KEY_EVENT;
helpers.PASSWORD_UNLOCK = PASSWORD_UNLOCK;
helpers.PATTERN_UNLOCK = PATTERN_UNLOCK;
helpers.FINGERPRINT_UNLOCK = FINGERPRINT_UNLOCK;

export {
  PIN_UNLOCK, PIN_UNLOCK_KEY_EVENT, PASSWORD_UNLOCK, PATTERN_UNLOCK,
  FINGERPRINT_UNLOCK, helpers
};
export default helpers;
