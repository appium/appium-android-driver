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
  // Dont trim key, you can use blank spaces as password in your android
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
  await adb.shell(["wm", "dismiss-keyguard"]);
};

helpers.encodePassword = function (key) {
  return key.replace(/\s+/ig, "%s");
};

helpers.pinUnlock = async function (adb, driver, capabilities) {
  logger.info(`Trying to unlock device using pin ${capabilities.unlockKey}`);
  let key = capabilities.unlockKey.split("");
  let els = await driver.findElOrEls("id", "com.android.systemui:id/digit_text", true);
  if (els === null || els.length === 0) {
    throw new Error("Error finding pin buttons");
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
  await sleep(100);
};

helpers.passwordUnlock = async function (adb, driver, capabilities) {
  logger.info(`Trying to unlock device using password ${capabilities.unlockKey}`);
  let key = capabilities.unlockKey;
  // Replace blank spaces with %s
  key = helpers.encodePassword(key);
  // Why adb ? It was less flaky
  await adb.shell(["input", "text", key]);
  await sleep(100);
  await adb.shell(["input", "keyevent", KEYCODE_NUMPAD_ENTER]);
  await sleep(100);
};

helpers.patternUnlock = async function (adb, driver, capabilities) {
  logger.info(`Trying to unlock device using pattern ${capabilities.unlockKey}`);
  /* We set the device pattern buttons as number of a regular phone
   *  | • • • |     | 1 2 3 |
   *  | • • • | --> | 4 5 6 |
   *  | • • • |     | 7 8 9 |
   */
   // let key = capabilities.unlockKey.split("");
   // The pattern view is now seeing by the uiautomator, so we are going to
   // try clicking on the buttons using the parent view bounds and math.
  let el = await driver.findElOrEls("id", "com.android.systemui:id/lockPatternView", false);
  let pos = await driver.getLocation(el.ELEMENT);
  let size = await driver.getSize(el.ELEMENT);
  let windowSize = await driver.getWindowSize();
  logger.info("Pos ---->" + JSON.stringify(pos));
  logger.info("Size ---->" + JSON.stringify(size));
  logger.info("Window Size ---->" + JSON.stringify(windowSize));
  for (let i = 0; i<10; i++) {
    
  }
};

helpers.PIN_UNLOCK = PIN_UNLOCK;
helpers.PASSWORD_UNLOCK = PASSWORD_UNLOCK;
helpers.PATTERN_UNLOCK = PATTERN_UNLOCK;

export default helpers;
