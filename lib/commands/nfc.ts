import {errors} from 'appium/driver';
import _ from 'lodash';
import type {AndroidDriver} from '../driver';
import type {NfcAction} from './types';

const SUPPORTED_ACTIONS = {
  ENABLE: 'enable',
  DISABLE: 'disable',
} as const;

/**
 * Performs the requested action on the default NFC adapter
 *
 * @param action The action to perform: 'enable' or 'disable'.
 * @returns Promise that resolves when the action is completed.
 * @throws {Error} If the device under test has no default NFC adapter
 * or there was a failure while performing the action.
 * @throws {errors.InvalidArgumentError} If the action is not one of the supported actions.
 */
export async function mobileNfc(
  this: AndroidDriver,
  action: NfcAction,
): Promise<void> {
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

