import {errors} from 'appium/driver';
import _ from 'lodash';

const SUPPORTED_ACTIONS = /** @type {const} */ ({
  ENABLE: 'enable',
  DISABLE: 'disable',
  UNPAIR_ALL: 'unpairAll',
});

/**
 * Performs the requested action on the default bluetooth adapter
 *
 * @this {AndroidDriver}
 * @param {import('./types').BluetoothOptions} opts
 * @returns {Promise<void>}
 * @throws {Error} if the device under test has no default bluetooth adapter
 * or there was a failure while performing the action.
 */
export async function mobileBluetooth(opts) {
  const {action} = opts;
  switch (action) {
    case SUPPORTED_ACTIONS.ENABLE:
      await this.settingsApp.setBluetoothState(true);
      break;
    case SUPPORTED_ACTIONS.DISABLE:
      await this.settingsApp.setBluetoothState(false);
      break;
    case SUPPORTED_ACTIONS.UNPAIR_ALL:
      await this.settingsApp.unpairAllBluetoothDevices();
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
