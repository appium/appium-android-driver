// @ts-check

import {mixin} from './mixins';

/**
 * @type {import('./mixins').KeyboardMixin & ThisType<import('../driver').AndroidDriver>}
 * @satisfies {import('@appium/types').ExternalDriver}
 */
const KeyboardMixin = {
  async hideKeyboard() {
    return await /** @type {import('appium-adb').ADB} */ (this.adb).hideKeyboard();
  },

  async isKeyboardShown() {
    const {isKeyboardShown} = await /** @type {import('appium-adb').ADB} */ (
      this.adb
    ).isSoftKeyboardPresent();
    return isKeyboardShown;
  },
};

mixin(KeyboardMixin);

export default KeyboardMixin;
