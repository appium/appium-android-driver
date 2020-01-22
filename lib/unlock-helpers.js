import logger from './logger';
import { sleep } from 'asyncbox';
import _ from 'lodash';
import { util } from 'appium-support';

const PIN_UNLOCK = 'pin';
const PASSWORD_UNLOCK = 'password';
const PATTERN_UNLOCK = 'pattern';
const FINGERPRINT_UNLOCK = 'fingerprint';
const UNLOCK_TYPES = [PIN_UNLOCK, PASSWORD_UNLOCK, PATTERN_UNLOCK, FINGERPRINT_UNLOCK];
const KEYCODE_NUMPAD_ENTER = 66;
const KEYCODE_POWER = 26;
const KEYCODE_WAKEUP = 224; // Can work over API Level 20
const UNLOCK_WAIT_TIME = 100;
const HIDE_KEYBOARD_WAIT_TIME = 100;
const INPUT_KEYS_WAIT_TIME = 100;

let helpers = {};
helpers.isValidUnlockType = function isValidUnlockType (type) {
  return UNLOCK_TYPES.indexOf(type) !== -1;
};

helpers.isValidKey = function isValidKey (type, key) {
  if (_.isUndefined(key)) {
    return false;
  }
  if (type === PIN_UNLOCK || type === FINGERPRINT_UNLOCK) {
    return /^[0-9]+$/.test(key.trim());
  }
  if (type === PATTERN_UNLOCK) {
    if (!/^[1-9]{2,9}$/.test(key.trim())) {
      return false;
    }
    return !(/([1-9]).*?\1/.test(key.trim()));
  }
  // Dont trim password key, you can use blank spaces in your android password
  // ¯\_(ツ)_/¯
  if (type === PASSWORD_UNLOCK) {
    return /.{4,}/g.test(key);
  }
  throw new Error(`Invalid unlock type ${type}`);
};

helpers.dismissKeyguard = async function dismissKeyguard (driver, adb) {
  logger.info('Waking up the device to unlock it');
  // Screen off once to force pre-inputted text field clean after wake-up
  // Just screen on if the screen defaults off
  await driver.pressKeyCode(KEYCODE_POWER);
  await driver.pressKeyCode(KEYCODE_WAKEUP);
  let isKeyboardShown = await driver.isKeyboardShown();
  if (isKeyboardShown) {
    await driver.hideKeyboard();
    // Waits a bit for the keyboard to hide
    await sleep(HIDE_KEYBOARD_WAIT_TIME);
  }
  // dismiss notifications
  logger.info('Dismiss notifications from unlock view');
  await adb.shell(['service', 'call', 'notification', '1']);
  await adb.back();
  if (await adb.getApiLevel() > 21) {
    logger.info('Trying to dismiss keyguard');
    await adb.shell(['wm', 'dismiss-keyguard']);
    return;
  }
  logger.info('Swiping up to dismiss keyguard');
  await helpers.swipeUp(driver);
};

helpers.swipeUp = async function swipeUp (driver) {
  let windowSize = await driver.getWindowSize();
  let x0 = parseInt(windowSize.x / 2, 10);
  let y0 = windowSize.y - 10;
  let yP = 100;
  let actions = [
    {action: 'press', options: {element: null, x: x0, y: y0}},
    {action: 'moveTo', options: {element: null, x: x0, y: yP}},
    {action: 'release'}
  ];
  await driver.performTouch(actions);
};

helpers.encodePassword = function encodePassword (key) {
  return key.replace(/\s/ig, '%s');
};

helpers.stringKeyToArr = function stringKeyToArr (key) {
  return key.trim().replace(/\s+/g, '').split(/\s*/);
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
  await helpers.dismissKeyguard(driver, adb);
  let keys = helpers.stringKeyToArr(capabilities.unlockKey);
  if (await adb.getApiLevel() >= 21) {
    let els = await driver.findElOrEls('id', 'com.android.systemui:id/digit_text', true);
    if (_.isEmpty(els)) {
      throw new Error('Error finding unlock pin buttons!');
    }
    let pins = {};
    for (let el of els) {
      let text = await driver.getAttribute('text', util.unwrapElement(el));
      pins[text] = el;
    }
    for (let pin of keys) {
      let el = pins[pin];
      await driver.click(util.unwrapElement(el));
    }
  } else {
    for (let pin of keys) {
      let el = await driver.findElOrEls('id', `com.android.keyguard:id/key${pin}`, false);
      if (el === null) {
        throw new Error(`Error finding unlock pin '${pin}' button!`);
      }
      await driver.click(util.unwrapElement(el));
    }
  }
  // Some devices accept entering the code without pressing the Enter key
  // When I rushed commands without this wait before pressKeyCode, rarely UI2 sever crashed
  await sleep(UNLOCK_WAIT_TIME);
  if (await adb.isScreenLocked()) {
    await driver.pressKeyCode(KEYCODE_NUMPAD_ENTER);
    await sleep(UNLOCK_WAIT_TIME);
  }
};

helpers.passwordUnlock = async function passwordUnlock (adb, driver, capabilities) {
  logger.info(`Trying to unlock device using password ${capabilities.unlockKey}`);
  await helpers.dismissKeyguard(driver, adb);
  let key = capabilities.unlockKey;
  // Replace blank spaces with %s
  key = helpers.encodePassword(key);
  // Why adb ? It was less flaky
  await adb.shell(['input', 'text', key]);
  // Why sleeps ? Avoid some flakyness waiting for the input to receive the keys
  await sleep(INPUT_KEYS_WAIT_TIME);
  await adb.shell(['input', 'keyevent', KEYCODE_NUMPAD_ENTER]);
  // Waits a bit for the device to be unlocked
  await sleep(UNLOCK_WAIT_TIME);
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
  let xPos = (key, x, piece) => {
    return Math.round(x + ((key % cols) || cols) * piece - piece / 2);
  };
  let yPos = (key, y, piece) => {
    return Math.round(y + (Math.ceil(((key % pins) || pins) / cols) * piece - piece / 2));
  };
  return {x: xPos(key, initPos.x, piece), y: yPos(key, initPos.y, piece)};
};

helpers.getPatternActions = function getPatternActions (keys, initPos, piece) {
  let actions = [];
  let lastPos;
  for (let key of keys) {
    let keyPos = helpers.getPatternKeyPosition(key, initPos, piece);
    if (key === keys[0]) {
      actions.push({action: 'press', options: {element: null, x: keyPos.x, y: keyPos.y}});
      lastPos = keyPos;
      continue;
    }
    let moveTo = {x: 0, y: 0};
    let diffX = keyPos.x - lastPos.x;
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
    let diffY = keyPos.y - lastPos.y;
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
    actions.push({action: 'moveTo', options: {element: null, x: moveTo.x + lastPos.x, y: moveTo.y + lastPos.y}});
    lastPos = keyPos;
  }
  actions.push({action: 'release'});
  return actions;
};

helpers.patternUnlock = async function patternUnlock (adb, driver, capabilities) {
  logger.info(`Trying to unlock device using pattern ${capabilities.unlockKey}`);
  await helpers.dismissKeyguard(driver, adb);
  let keys = helpers.stringKeyToArr(capabilities.unlockKey);
  /* We set the device pattern buttons as number of a regular phone
   *  | • • • |     | 1 2 3 |
   *  | • • • | --> | 4 5 6 |
   *  | • • • |     | 7 8 9 |

  The pattern view buttons are not seeing by the uiautomator since they are
  included inside a FrameLayout, so we are going to try clicking on the buttons
  using the parent view bounds and math.
  */
  let apiLevel = await adb.getApiLevel();
  let el = await driver.findElOrEls('id',
    `com.android.${apiLevel >= 21 ? 'systemui' : 'keyguard'}:id/lockPatternView`,
    false
  );
  let initPos = await driver.getLocation(util.unwrapElement(el));
  let size = await driver.getSize(util.unwrapElement(el));
  // Get actions to perform
  let actions = helpers.getPatternActions(keys, initPos, size.width / 3);
  // Perform gesture
  await driver.performTouch(actions);
  // Waits a bit for the device to be unlocked
  await sleep(UNLOCK_WAIT_TIME);
};

helpers.PIN_UNLOCK = PIN_UNLOCK;
helpers.PASSWORD_UNLOCK = PASSWORD_UNLOCK;
helpers.PATTERN_UNLOCK = PATTERN_UNLOCK;
helpers.FINGERPRINT_UNLOCK = FINGERPRINT_UNLOCK;

export { PIN_UNLOCK, PASSWORD_UNLOCK, PATTERN_UNLOCK, FINGERPRINT_UNLOCK, helpers };
export default helpers;
