const PIN_UNLOCK = "pin";
const PASSWORD_UNLOCK = "password";
const PATTERN_UNLOCK = "pattern";
const UNLOCK_TYPES = [PIN_UNLOCK, PASSWORD_UNLOCK, PATTERN_UNLOCK];

let helpers = {}
helpers.isValidUnlockType = function(type) {
  return UNLOCK_TYPES.indexOf(type) !== -1;
}

helpers.dismissKeyguard = async function(adb) {
  await adb.back();
  await adb.shell(["shell", "wm", "dismiss-keyguard"]);
}

export default helpers
