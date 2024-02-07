/* eslint-disable @typescript-eslint/no-unused-vars */
import {errors} from 'appium/driver';

/**
 * @this {AndroidDriver}
 * @param {import('@appium/types').StringRecord[]} actions
 * @returns {Promise<void>}
 */
export async function performActions(actions) {
  throw new errors.NotImplementedError('Not implemented');
}

/**
 * @typedef {import('../driver').AndroidDriver} AndroidDriver
 */
