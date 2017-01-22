import logger from './logger';
import { sleep } from 'asyncbox';

const PIN_UNLOCK = "pin";
const PASSWORD_UNLOCK = "password";
const PATTERN_UNLOCK = "pattern";
const UNLOCK_TYPES = [PIN_UNLOCK, PASSWORD_UNLOCK, PATTERN_UNLOCK];

let helpers = {};
helpers.isValidUnlockType = function (type) {
  return UNLOCK_TYPES.indexOf(type) !== -1;
};

helpers.isValidKey = function (type, key) {
  if (key === undefined || key.trim() === "") {
    return false;
  }
  if (type === PIN_UNLOCK) {
    return /^[0-9]+$/.test(key);
  }
  if (type === PATTERN_UNLOCK) {
    if (!/^[0-9]+$/.test(key)) {
      return false;
    }
    return !(/([0-9]).*?\1/.test(key));
  }
  if (type === PASSWORD_UNLOCK) {
    return /^[0-9a-zA-Z\-\_]*$/g.test(key);
  }
  throw new Error(`Invalid unlock type ${type}`);
};

helpers.dismissKeyguard = async function (adb) {
  await adb.back();
  await adb.shell(["wm", "dismiss-keyguard"]);
};

helpers.pinUnlock = async function (driver, capabilities) {
  logger.info(`Trying to unlock device using pin ${capabilities.unlockKey}`);
  let key = capabilities.unlockKey.split("");
  let els = await driver.findElOrEls("id", "com.android.systemui:id/digit_text", true);
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

helpers.passwordUnlock = async function (driver, capabilities) {
  logger.info(`Trying to unlock device using password ${capabilities.unlockKey}`);
  // let key = capabilities.unlockKey.split("");
};

helpers.patternUnlock = async function (driver, capabilities) {
  logger.info(`Trying to unlock device using pattern ${capabilities.unlockKey}`);
  // let key = capabilities.unlockKey.split("");
};

helpers.PIN_UNLOCK = PIN_UNLOCK;
helpers.PASSWORD_UNLOCK = PASSWORD_UNLOCK;
helpers.PATTERN_UNLOCK = PATTERN_UNLOCK;

export default helpers;
