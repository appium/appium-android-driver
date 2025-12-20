/* eslint-disable @typescript-eslint/no-unused-vars */
import _ from 'lodash';
import {errors} from 'appium/driver';
import {UNICODE_IME, EMPTY_IME} from 'io.appium.settings';
import type {AndroidDriver} from '../driver';
import type {SendKeysOpts} from './types';

/**
 * Hides the on-screen keyboard.
 *
 * @returns Promise that resolves to `true` if the keyboard was hidden, `false` otherwise.
 */
export async function hideKeyboard(
  this: AndroidDriver,
): Promise<boolean> {
  return await this.adb.hideKeyboard();
}

/**
 * Checks if the on-screen keyboard is currently shown.
 *
 * @returns Promise that resolves to `true` if the keyboard is shown, `false` otherwise.
 */
export async function isKeyboardShown(
  this: AndroidDriver,
): Promise<boolean> {
  const {isKeyboardShown} = await this.adb.isSoftKeyboardPresent();
  return isKeyboardShown;
}

/**
 * Sends keys to the active element.
 *
 * @param keys The keys to send, either as a string or an array of strings (which will be joined).
 * @returns Promise that resolves when the keys are sent.
 */
export async function keys(
  this: AndroidDriver,
  keys: string | string[],
): Promise<void> {
  // Protocol sends an array; rethink approach
  const keysStr = _.isArray(keys) ? keys.join('') : keys;
  await this.doSendKeys({
    text: keysStr,
    replace: false,
  });
}

/**
 * Sends keys to the active element.
 *
 * @param params The parameters for sending keys.
 * @returns Promise that resolves when the keys are sent.
 * @throws {errors.NotImplementedError} This method is not implemented.
 */
export async function doSendKeys(
  this: AndroidDriver,
  params: SendKeysOpts,
): Promise<void> {
  throw new errors.NotImplementedError('Not implemented');
}

/**
 * Sends a key event to the device.
 *
 * @deprecated Use {@link pressKeyCode} instead.
 * @param keycode The key code to press.
 * @param metastate Optional meta state flags.
 * @returns Promise that resolves when the key event is sent.
 */
export async function keyevent(
  this: AndroidDriver,
  keycode: string | number,
  metastate?: number,
): Promise<void> {
  // TODO deprecate keyevent; currently wd only implements keyevent
  this.log.warn('keyevent will be deprecated use pressKeyCode');
  return await this.pressKeyCode(keycode, metastate);
}

/**
 * Presses a key code on the device.
 *
 * @param keycode The key code to press.
 * @param metastate Optional meta state flags.
 * @returns Promise that resolves when the key code is pressed.
 * @throws {errors.NotImplementedError} This method is not implemented.
 */
export async function pressKeyCode(
  this: AndroidDriver,
  keycode: string | number,
  metastate?: number,
): Promise<void> {
  throw new errors.NotImplementedError('Not implemented');
}

/**
 * Long presses a key code on the device.
 *
 * @param keycode The key code to long press.
 * @param metastate Optional meta state flags.
 * @returns Promise that resolves when the key code is long pressed.
 * @throws {errors.NotImplementedError} This method is not implemented.
 */
export async function longPressKeyCode(
  this: AndroidDriver,
  keycode: string | number,
  metastate?: number,
): Promise<void> {
  throw new errors.NotImplementedError('Not implemented');
}

/**
 * Performs an editor action on the active input field.
 *
 * @param action The editor action to perform (e.g., 'done', 'go', 'next').
 * @returns Promise that resolves when the editor action is performed.
 */
export async function mobilePerformEditorAction(
  this: AndroidDriver,
  action: string | number,
): Promise<void> {
  await this.settingsApp.performEditorAction(action);
}

// #region Internal Helpers

/**
 * Initializes Unicode keyboard support.
 *
 * @deprecated
 * @returns Promise that resolves to the default IME identifier that was active before.
 */
export async function initUnicodeKeyboard(
  this: AndroidDriver,
): Promise<string | null> {
  this.log.debug('Enabling Unicode keyboard support');

  // get the default IME so we can return back to it later if we want
  const defaultIME = await this.adb.defaultIME();

  this.log.debug(`Unsetting previous IME ${defaultIME}`);
  this.log.debug(`Setting IME to '${UNICODE_IME}'`);
  await this.adb.enableIME(UNICODE_IME);
  await this.adb.setIME(UNICODE_IME);
  return defaultIME;
}

/**
 * Hides the on-screen keyboard completely by setting IME to empty.
 *
 * @returns Promise that resolves when the keyboard is hidden.
 */
export async function hideKeyboardCompletely(
  this: AndroidDriver,
): Promise<void> {
  this.log.debug(`Hiding the on-screen keyboard by setting IME to '${EMPTY_IME}'`);
  await this.adb.enableIME(EMPTY_IME);
  await this.adb.setIME(EMPTY_IME);
}

// #endregion

