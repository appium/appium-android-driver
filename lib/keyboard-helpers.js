import logger from './logger';
import { waitForCondition } from 'asyncbox';

const keyboardHelpers = {};

const KEYCODE_ESC = 111;
const KEYCODE_BACK = 4;

keyboardHelpers.hideKeyboard = async function hideKeyboard (adb) {
  let {isKeyboardShown, canCloseKeyboard} = await adb.isSoftKeyboardPresent();
  if (!isKeyboardShown) {
    logger.info('Keyboard has no UI; no closing necessary');
    return;
  }
  // Try ESC then BACK if the first one fails
  for (const keyCode of [KEYCODE_ESC, KEYCODE_BACK]) {
    if (canCloseKeyboard) {
      await adb.keyevent(keyCode);
    }
    try {
      return await waitForCondition(async () => {
        ({isKeyboardShown} = await adb.isSoftKeyboardPresent());
        return !isKeyboardShown;
      }, {waitMs: 1000, intervalMs: 500});
    } catch (ign) {}
  }
  throw new Error(`The software keyboard cannot be closed`);
};

export default keyboardHelpers;