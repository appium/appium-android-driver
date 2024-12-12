/* eslint-disable @typescript-eslint/no-unused-vars */
import _ from 'lodash';
import {errors} from 'appium/driver';

/**
 * @this {import('../driver').AndroidDriver}
 * @returns {Promise<import('@appium/types').Size>}
 */
export async function getWindowSize() {
  throw new errors.NotImplementedError('Not implemented');
}

/**
 * @this {import('../driver').AndroidDriver}
 * @returns {Promise<import('@appium/types').Rect>}
 */
export async function getWindowRect() {
  const {width, height} = await this.getWindowSize();
  return {
    width,
    height,
    x: 0,
    y: 0,
  };
}

/**
 * we override setUrl to take an android URI which can be used for deep-linking
 * inside an app, similar to starting an intent
 *
 * @this {import('../driver').AndroidDriver}
 * @param {string} uri
 * @returns {Promise<void>}
 */
export async function setUrl(uri) {
  await this.adb.startUri(uri, /** @type {string} */ (this.opts.appPackage));
}

/**
 * @this {import('../driver').AndroidDriver}
 * @returns {Promise<number>}
 */
export async function getDisplayDensity() {
  // first try the property for devices
  let out = await this.adb.shell(['getprop', 'ro.sf.lcd_density']);
  if (out) {
    let val = parseInt(out, 10);
    // if the value is NaN, try getting the emulator property
    if (!isNaN(val)) {
      return val;
    }
    this.log.debug(`Parsed density value was NaN: "${out}"`);
  }
  // fallback to trying property for emulators
  out = await this.adb.shell(['getprop', 'qemu.sf.lcd_density']);
  if (out) {
    let val = parseInt(out, 10);
    if (!isNaN(val)) {
      return val;
    }
    this.log.debug(`Parsed density value was NaN: "${out}"`);
  }
  // couldn't get anything, so error out
  throw this.log.errorWithException('Failed to get display density property.');
}

/**
 * @this {import('../driver').AndroidDriver}
 * @returns {Promise<StringRecord>}
 */
export async function mobileGetNotifications() {
  return await this.settingsApp.getNotifications();
}

/**
 * @this {import('../driver').AndroidDriver}
 * @returns {Promise<import('./types').SmsListResult>}
 */
export async function mobileListSms(opts) {
  return await this.settingsApp.getSmsList(opts);
}

/**
 * @this {import('../driver').AndroidDriver}
 * @returns {Promise<void>}
 */
export async function openNotifications() {
  throw new errors.NotImplementedError('Not implemented');
}

/**
 * @typedef {import('appium-adb').ADB} ADB
 * @typedef {import('@appium/types').StringRecord} StringRecord
 */
