import {errors} from 'appium/driver';
import _ from 'lodash';
import type {AndroidDriver} from '../driver';

const SUPPORTED_ACTIONS = {
  ENABLE: 'enable',
  DISABLE: 'disable',
  UNPAIR_ALL: 'unpairAll',
} as const;

/**
 * Performs the requested action on the default bluetooth adapter
 *
 * @param action The action to perform: 'enable', 'disable', or 'unpairAll'.
 * @returns Promise that resolves when the action is completed.
 * @throws {Error} If the device under test has no default bluetooth adapter
 * or there was a failure while performing the action.
 * @throws {errors.InvalidArgumentError} If the action is not one of the supported actions.
 */
export async function mobileBluetooth(
  this: AndroidDriver,
  action: BluetoothAction,
): Promise<void> {
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

type BluetoothAction = typeof SUPPORTED_ACTIONS[keyof typeof SUPPORTED_ACTIONS];

