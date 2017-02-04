import logger from './logger';
import { sleep } from 'asyncbox';

const PIN_UNLOCK = "pin";
const PASSWORD_UNLOCK = "password";
const PATTERN_UNLOCK = "pattern";
const UNLOCK_TYPES = [PIN_UNLOCK, PASSWORD_UNLOCK, PATTERN_UNLOCK];
const KEYCODE_NUMPAD_ENTER = "66";

let helpers = {};
helpers.isValidUnlockType = function (type) {
  return UNLOCK_TYPES.indexOf(type) !== -1;
};

helpers.isValidKey = function (type, key) {
  if (key === undefined) {
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
    await sleep(100);
  }
  await adb.back();
  if (await adb.getApiLevel() > 21) {
    await adb.shell(["wm", "dismiss-keyguard"]);
  } else {
    logger.info("swipeUp");
    await helpers.swipeUp(driver);
  }
};

helpers.swipeUp = async function (driver) {
  let windowSize = await driver.getWindowSize();
  let x0 = parseInt(windowSize.x/2);
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
  let key = capabilities.unlockKey.split("");
  if (await adb.getApiLevel() >= 21) {
    let els = await driver.findElOrEls("id", "com.android.systemui:id/digit_text", true);
    if (els === null || els.length === 0) {
      throw new Error("Error finding unlock pin buttons!");
    }
    let pins = {};
    for (let e in els) {
      let text = await driver.getAttribute("text", els[e].ELEMENT);
      pins[text] = els[e];
    }
    for (let i in key) {
      let pin = key[i];
      let el = pins[pin];
      await driver.click(el.ELEMENT);
    }
    let el = await driver.findElOrEls("id", "com.android.systemui:id/key_enter", false);
    await driver.click(el.ELEMENT);
  } else {
    for (let i in key) {
      let pin = key[i];
      let el = await driver.findElOrEls("id", `com.android.keyguard:id/key${pin}`, false);
      if (el === null) {
        throw new Error("Error finding unlock pin button!");
      }
      await driver.click(el.ELEMENT);
    }
    let el = await driver.findElOrEls("id", "com.android.keyguard:id/key_enter", false);
    await driver.click(el.ELEMENT);
  }
  await sleep(100);
};

helpers.passwordUnlock = async function (adb, driver, capabilities) {
  logger.info(`Trying to unlock device using password ${capabilities.unlockKey}`);
  await helpers.dismissKeyguard(driver, adb);
  let key = capabilities.unlockKey;
  // Replace blank spaces with %s
  key = helpers.encodePassword(key);
  // Why adb ? It was less flaky
  await adb.shell(["input", "text", key]);
  await sleep(100);
  await adb.shell(["input", "keyevent", KEYCODE_NUMPAD_ENTER]);
  await sleep(100);
};

helpers.getPatternKeyPosition = function (key, pos0, piece) {
  let xPos = (key, x, piece) => {
    return Math.round(x + ((key % 3) || 3) * piece - piece/2);
  };
  let yPos = (key, y, piece) => {
    return Math.round(y + (Math.ceil(((key % 9) || 9)/3) * piece - piece/2));
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
  let el;
  if (await adb.getApiLevel() >= 21) {
    el = await driver.findElOrEls("id", "com.android.systemui:id/lockPatternView", false);
  } else {
    el = await driver.findElOrEls("id", "com.android.keyguard:id/lockPatternView", false);
  }
  let pos0 = await driver.getLocation(el.ELEMENT);
  let size = await driver.getSize(el.ELEMENT);
  let piece = size.width/3;
  let actions = [];
  let lastPos;
  for (let i in keys) {
    let keyPos = helpers.getPatternKeyPosition(keys[i], pos0, piece);
    if (parseInt(i) === 0) {
      actions.push({action: 'press', options: {element: null, x: keyPos.x, y: keyPos.y}});
      lastPos = keyPos;
      continue;
    }
    let moveTo = {x:0, y:0};
    if (keyPos.x > lastPos.x) moveTo.x = piece;
    else if (keyPos.x < lastPos.x) moveTo.x = -1*piece;
    if (keyPos.y > lastPos.y) moveTo.y = piece;
    else if (keyPos.y < lastPos.y) moveTo.y = -1*piece;
    actions.push({action: 'moveTo', options: {element: null, x: moveTo.x, y: moveTo.y}});
    lastPos = keyPos;
  }
  actions.push({action: 'release'});
  await driver.performTouch(actions);
  await sleep(100);
};

helpers.PIN_UNLOCK = PIN_UNLOCK;
helpers.PASSWORD_UNLOCK = PASSWORD_UNLOCK;
helpers.PATTERN_UNLOCK = PATTERN_UNLOCK;

export default helpers;
