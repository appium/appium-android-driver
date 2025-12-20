import {errors} from 'appium/driver';
import type {Size, Rect, StringRecord} from '@appium/types';
import type {AndroidDriver} from '../driver';
import type {SmsListResult, ListSmsOpts} from './types';

/**
 * Gets the window size.
 *
 * @returns Promise that resolves to the window size (width, height).
 * @throws {errors.NotImplementedError} This method is not implemented.
 */
export async function getWindowSize(
  this: AndroidDriver,
): Promise<Size> {
  throw new errors.NotImplementedError('Not implemented');
}

/**
 * Gets the window rectangle (position and size).
 *
 * @returns Promise that resolves to the window rectangle.
 */
export async function getWindowRect(
  this: AndroidDriver,
): Promise<Rect> {
  const {width, height} = await this.getWindowSize();
  return {
    width,
    height,
    x: 0,
    y: 0,
  };
}

/**
 * Sets the URL for deep-linking inside an app.
 *
 * We override setUrl to take an android URI which can be used for deep-linking
 * inside an app, similar to starting an intent.
 *
 * @param uri The Android URI to navigate to.
 * @returns Promise that resolves when the URI is opened.
 */
export async function setUrl(
  this: AndroidDriver,
  uri: string,
): Promise<void> {
  await this.adb.startUri(uri, this.opts.appPackage as string);
}

/**
 * Gets the display density of the device.
 *
 * @returns Promise that resolves to the display density value.
 * @throws {Error} If the display density cannot be retrieved.
 */
export async function getDisplayDensity(
  this: AndroidDriver,
): Promise<number> {
  // first try the property for devices
  let out = await this.adb.shell(['getprop', 'ro.sf.lcd_density']);
  if (out) {
    const val = parseInt(out, 10);
    // if the value is NaN, try getting the emulator property
    if (!isNaN(val)) {
      return val;
    }
    this.log.debug(`Parsed density value was NaN: "${out}"`);
  }
  // fallback to trying property for emulators
  out = await this.adb.shell(['getprop', 'qemu.sf.lcd_density']);
  if (out) {
    const val = parseInt(out, 10);
    if (!isNaN(val)) {
      return val;
    }
    this.log.debug(`Parsed density value was NaN: "${out}"`);
  }
  // couldn't get anything, so error out
  throw this.log.errorWithException('Failed to get display density property.');
}

/**
 * Gets the list of notifications from the device.
 *
 * @returns Promise that resolves to an object containing notification information.
 */
export async function mobileGetNotifications(
  this: AndroidDriver,
): Promise<StringRecord> {
  return await this.settingsApp.getNotifications();
}

/**
 * Lists SMS messages from the device.
 *
 * @param opts Optional parameters for listing SMS messages.
 * @returns Promise that resolves to the SMS list result.
 */
export async function mobileListSms(
  this: AndroidDriver,
  opts?: ListSmsOpts,
): Promise<SmsListResult> {
  return await this.settingsApp.getSmsList(opts);
}

/**
 * Opens the notifications panel.
 *
 * @returns Promise that resolves when the notifications panel is opened.
 * @throws {errors.NotImplementedError} This method is not implemented.
 */
export async function openNotifications(
  this: AndroidDriver,
): Promise<void> {
  throw new errors.NotImplementedError('Not implemented');
}

