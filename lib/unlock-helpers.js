const PIN_UNLOCK = "pin";
const PASSWORD_UNLOCK = "password";
const PATTERN_UNLOCK = "pattern";
const UNLOCK_TYPES = [PIN_UNLOCK, PASSWORD_UNLOCK, PATTERN_UNLOCK];

let helpers = {};
helpers.isValidUnlockType = function (type) {
  return UNLOCK_TYPES.indexOf(type) !== -1;
};

helpers.isValidKey = function (type, key) {
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
    return /ˆ[0-9a-zA-Z\-\_]*$/.test(key);
  }
  throw new Error(`Invalid unlock type ${type}`);
};

helpers.dismissKeyguard = async function (adb) {
  await adb.back();
  await adb.shell(["wm", "dismiss-keyguard"]);
};

helpers.pinUnlock = async function (adb, capabilities) {
  let pin = capabilities.unlockKey;
  await adb.shell(["ls", pin]);
};

helpers.PIN_UNLOCK = PIN_UNLOCK;
helpers.PASSWORD_UNLOCK = PASSWORD_UNLOCK;
helpers.PATTERN_UNLOCK = PATTERN_UNLOCK;

export default helpers;
