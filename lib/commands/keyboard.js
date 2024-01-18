/* eslint-disable @typescript-eslint/no-unused-vars */
import _ from 'lodash';
import {errors} from 'appium/driver';
import {requireArgs} from '../utils';
import {UNICODE_IME, EMPTY_IME} from 'io.appium.settings';

/**
 * @this {import('../driver').AndroidDriver}
 * @returns {Promise<boolean>}
 */
export async function hideKeyboard() {
  return await /** @type {import('appium-adb').ADB} */ (this.adb).hideKeyboard();
}

/**
 * @this {import('../driver').AndroidDriver}
 * @returns {Promise<boolean>}
 */
export async function isKeyboardShown() {
  const {isKeyboardShown} = await /** @type {import('appium-adb').ADB} */ (
    this.adb
  ).isSoftKeyboardPresent();
  return isKeyboardShown;
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {string|string[]} keys
 * @returns {Promise<void>}
 */
export async function keys(keys) {
  // Protocol sends an array; rethink approach
  keys = _.isArray(keys) ? keys.join('') : keys;
  await this.doSendKeys({
    text: keys,
    replace: false,
  });
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {import('./types').SendKeysOpts} params
 * @returns {Promise<void>}
 */
export async function doSendKeys(params) {
  throw new errors.NotImplementedError('Not implemented');
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {string|number} keycode
 * @param {number} [metastate]
 * @returns {Promise<void>}
 */
export async function keyevent(keycode, metastate) {
  // TODO deprecate keyevent; currently wd only implements keyevent
  this.log.warn('keyevent will be deprecated use pressKeyCode');
  return await this.pressKeyCode(keycode, metastate);
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {string|number} keycode
 * @param {number} [metastate]
 * @returns {Promise<void>}
 */
export async function pressKeyCode(keycode, metastate) {
  throw new errors.NotImplementedError('Not implemented');
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {string|number} keycode
 * @param {number} [metastate]
 * @returns {Promise<void>}
 */
export async function longPressKeyCode(keycode, metastate) {
  throw new errors.NotImplementedError('Not implemented');
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {import('./types').PerformEditorActionOpts} opts
 * @returns {Promise<void>}
 */
export async function mobilePerformEditorAction(opts) {
  const {action} = requireArgs('action', opts);
  await this.settingsApp.performEditorAction(action);
}

// #region Internal Helpers

/**
 * @deprecated
 * @this {import('../driver').AndroidDriver}
 * @returns {Promise<string?>}
 */
export async function initUnicodeKeyboard() {
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
 * @this {import('../driver').AndroidDriver}
 * @returns {Promise<void>}
 */
export async function hideKeyboardCompletely() {
  this.log.debug(`Hiding the on-screen keyboard by setting IME to '${EMPTY_IME}'`);
  await this.adb.enableIME(EMPTY_IME);
  await this.adb.setIME(EMPTY_IME);
}

// #endregion
