import {errors} from 'appium/driver.js';
import type {StringRecord} from '@appium/types';
import type {AndroidDriver} from '../driver.js';

/**
 * Performs a series of actions (gestures) on the device.
 *
 * @param actions An array of action objects to perform.
 * @returns Promise that resolves when all actions are performed.
 * @throws {errors.NotImplementedError} This method is not implemented.
 */
export async function performActions(this: AndroidDriver, actions: StringRecord[]): Promise<void> {
  void actions;
  throw new errors.NotImplementedError('Not implemented');
}
