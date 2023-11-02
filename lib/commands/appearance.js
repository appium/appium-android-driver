import {mixin} from './mixins';
import {requireArgs} from '../utils';

const RESPONSE_PATTERN = /:\s+(\w+)/;

/**
 * @type {import('./mixins').AppearanceMixin & ThisType<import('../driver').AndroidDriver>}
 * @satisfies {import('@appium/types').ExternalDriver}
 */
const AppearanceMixin = {
  /**
   * Set the Ui appearance.
   *
   * @since Android 10
   */
  async mobileSetUiMode(opts) {
    const {mode, value} = requireArgs(['mode', 'value'], opts);
    await this.adb.shell(['cmd', 'uimode', mode, value]);
  },

  /**
   * Get the Ui appearance.
   *
   * @since Android 10
   * @returns {Promise<string>} The actual state for the queried UI mode,
   * for example 'yes' or 'no'
   */
  async mobileGetUiMode(opts) {
    const {mode} = requireArgs(['mode'], opts);
    const response = await this.adb.shell(['cmd', 'uimode', mode]);
    // response looks like 'Night mode: no'
    const match = RESPONSE_PATTERN.exec(response);
    if (!match) {
      throw new Error(`Cannot parse the command response: ${response}`);
    }
    return match[1];
  },

};

export default AppearanceMixin;

mixin(AppearanceMixin);
