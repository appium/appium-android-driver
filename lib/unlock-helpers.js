import logger from './logger';
import { sleep } from 'asyncbox';

const PIN_UNLOCK = "pin";
const PASSWORD_UNLOCK = "password";
const PATTERN_UNLOCK = "pattern";
const UNLOCK_TYPES = [PIN_UNLOCK, PASSWORD_UNLOCK, PATTERN_UNLOCK];
const KEYCODE_NUMPAD_ENTER = "66";
const UNLOCK_WAIT_TIME = 100;
const HIDE_KEYBOARD_WAIT_TIME = 100;
const INPUT_KEYS_WAIT_TIME = 100;

let helpers = {};
helpers.isValidUnlockType = function (type) {
  return UNLOCK_TYPES.indexOf(type) !== -1;
};

helpers.isValidKey = function (type, key) {
  if (typeof key === 'undefined') {
    return false;
  }
  if (type === PIN_UNLOCK) {
    return /^[0-9]+$/.test(key.trim());
  }
  if (type === PATTERN_UNLOCK) {
    if (!/^[0-9]+$/.test(key.trim())) {
      return false;
    }
    return !(/([0-9]).*?\1/.test(key.trim()));
  }
  // Dont trim password key, you can use blank spaces in your android password
  // ¯\_(ツ)_/¯
  if (type === PASSWORD_UNLOCK) {
    return /.{4,}/g.test(key);
  }
  throw new Error(`Invalid unlock type ${type}`);
};

helpers.dismissKeyguard = async function (driver, adb) {
  let isKeyboardShown = await driver.isKeyboardShown();
  if (isKeyboardShown) {
    await driver.hideKeyboard();
    // Waits a bit for the keyboard to hide
    await sleep(HIDE_KEYBOARD_WAIT_TIME);
  }
  // dismiss notifications
  logger.info("Dismiss notifications from unlock view");
  await adb.shell(["service", "call", "notification", "1"]);
  await adb.back();
  if (await adb.getApiLevel() > 21) {
    logger.info("Trying to dismiss keyguard");
    await adb.shell(["wm", "dismiss-keyguard"]);
    return;
  }
  logger.info("Swiping up to dismiss keyguard");
  await helpers.swipeUp(driver);
};

helpers.swipeUp = async function (driver) {
  let windowSize = await driver.getWindowSize();
  let x0 = parseInt(windowSize.x / 2);
  let y0 = windowSize.y - 10;
  let yP = 100;
  let actions = [
    {action: 'press', options: {element: null, x: x0, y: y0}},
    {action: 'moveTo', options: {element: null, x: x0, y: yP}},
    {action: 'release'}
  ];
  await driver.performTouch(actions);
};

helpers.encodePassword = function (key) {
  return key.replace(/\s+/ig, "%s");
};

helpers.pinUnlock = async function (adb, driver, capabilities) {
  logger.info(`Trying to unlock device using pin ${capabilities.unlockKey}`);
  await helpers.dismissKeyguard(driver, adb);
  let keys = capabilities.unlockKey.split("");
  if (await adb.getApiLevel() >= 21) {
    let els = await driver.findElOrEls("id", "com.android.systemui:id/digit_text", true);
    if (els === null || els.length === 0) {
      throw new Error("Error finding unlock pin buttons!");
    }
    let pins = {};
    for (let e of els) {
      let text = await driver.getAttribute("text", e.ELEMENT);
      pins[text] = e;
    }
    for (let pin of keys) {
      let el = pins[pin];
      await driver.click(el.ELEMENT);
    }
    let el = await driver.findElOrEls("id", "com.android.systemui:id/key_enter", false);
    await driver.click(el.ELEMENT);
  } else {
    for (let pin of keys) {
      let el = await driver.findElOrEls("id", `com.android.keyguard:id/key${pin}`, false);
      if (el === null) {
        throw new Error(`Error finding unlock pin '${pin}' button!`);
      }
      await driver.click(el.ELEMENT);
    }
    let el = await driver.findElOrEls("id", "com.android.keyguard:id/key_enter", false);
    await driver.click(el.ELEMENT);
  }
  // Waits a bit for the device to be unlocked
  await sleep(UNLOCK_WAIT_TIME);
};

helpers.passwordUnlock = async function (adb, driver, capabilities) {
  logger.info(`Trying to unlock device using password ${capabilities.unlockKey}`);
  await helpers.dismissKeyguard(driver, adb);
  let key = capabilities.unlockKey;
  // Replace blank spaces with %s
  key = helpers.encodePassword(key);
  // Why adb ? It was less flaky
  await adb.shell(["input", "text", key]);
  // Why sleeps ? Avoid some flakyness waiting for the input to receive the keys
  await sleep(INPUT_KEYS_WAIT_TIME);
  await adb.shell(["input", "keyevent", KEYCODE_NUMPAD_ENTER]);
  // Waits a bit for the device to be unlocked
  await sleep(UNLOCK_WAIT_TIME);
};

helpers.getPatternKeyPosition = function (key, pos0, piece) {
  const cols = 3;
  const pins = 9;
  let xPos = (key, x, piece) => {
    return Math.round(x + ((key % cols) || cols) * piece - piece / 2);
  };
  let yPos = (key, y, piece) => {
    return Math.round(y + (Math.ceil(((key % pins) || pins) / cols) * piece - piece / 2));
  };
  return {x: xPos(key, pos0.x, piece), y: yPos(key, pos0.y, piece)};
};

helpers.patternUnlock = async function (adb, driver, capabilities) {
  logger.info(`Trying to unlock device using pattern ${capabilities.unlockKey}`);
  await helpers.dismissKeyguard(driver, adb);
  let keys = capabilities.unlockKey.split("");
  /* We set the device pattern buttons as number of a regular phone
   *  | • • • |     | 1 2 3 |
   *  | • • • | --> | 4 5 6 |
   *  | • • • |     | 7 8 9 |
  */
  // The pattern view buttons is not seeing by the uiautomator, so we are going to
  // try clicking on the buttons using the parent view bounds and math.
  let apiLevel = await adb.getApiLevel();
  let el = await driver.findElOrEls("id", `com.android.${apiLevel >= 21 ? 'systemui' : 'keyguard'}:id/lockPatternView`, false);
  let pos0 = await driver.getLocation(el.ELEMENT);
  let size = await driver.getSize(el.ELEMENT);
  let piece = size.width/3;
  let actions = [];
  let lastPos;
  for (let key of keys) {
    let keyPos = helpers.getPatternKeyPosition(key, pos0, piece);
    if (parseInt(key) === 0) {
      actions.push({action: 'press', options: {element: null, x: keyPos.x, y: keyPos.y}});
      lastPos = keyPos;
      continue;
    }
    let moveTo = {x:0, y:0};
    if (keyPos.x > lastPos.x) {
      moveTo.x = piece;
    } else if (keyPos.x < lastPos.x) {
      moveTo.x = -1 * piece;
    }
    if (keyPos.y > lastPos.y) {
      moveTo.y = piece;
    } else if (keyPos.y < lastPos.y) {
      moveTo.y = -1 * piece;
    }
    actions.push({action: 'moveTo', options: {element: null, x: moveTo.x, y: moveTo.y}});
    lastPos = keyPos;
  }
  actions.push({action: 'release'});
  await driver.performTouch(actions);
  // Waits a bit for the device to be unlocked
  await sleep(UNLOCK_WAIT_TIME);
};

helpers.PIN_UNLOCK = PIN_UNLOCK;
helpers.PASSWORD_UNLOCK = PASSWORD_UNLOCK;
helpers.PATTERN_UNLOCK = PATTERN_UNLOCK;

export default helpers;
