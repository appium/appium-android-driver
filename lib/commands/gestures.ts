import type {StringRecord} from '@appium/types';
import {errors} from 'appium/driver.js';

import type {AndroidDriverConstraints} from '../constraints.js';
import type {AndroidDriver} from '../driver.js';

declare module '../driver.js' {
  interface AndroidDriver<C extends AndroidDriverConstraints> {
    performActions(...args: Parameters<typeof performActions>): ReturnType<typeof performActions>;
  }
}

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
