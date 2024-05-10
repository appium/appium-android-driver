import {errors} from 'appium/driver';
import _ from 'lodash';

const SUPPORTED_ACTIONS = /** @type {const} */ ({
  ENABLE: 'enable',
  DISABLE: 'disable',
});

/**
 * Performs the requested action on the default NFC adapter
 *
 * @this {AndroidDriver}
 * @param {import('./types').NfcOptions} opts
 * @returns {Promise<void>}
 * @throws {Error} if the device under test has no default NFC adapter
 * or there was a failure while performing the action.
 */
export async function mobileNfc(opts) {
  const {action} = opts;
  switch (action) {
    case SUPPORTED_ACTIONS.ENABLE:
      await this.adb.setNfcOn(true);
      break;
    case SUPPORTED_ACTIONS.DISABLE:
      await this.adb.setNfcOn(false);
      break;
    default:
      throw new errors.InvalidArgumentError(
        `You must provide a valid 'action' argument. Supported actions are: ${_.values(SUPPORTED_ACTIONS)}`
      );
  }
}

/**
 * @typedef {import('appium-adb').ADB} ADB
 * @typedef {import('../driver').AndroidDriver} AndroidDriver
 */
