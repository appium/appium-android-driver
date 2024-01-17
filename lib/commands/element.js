/* eslint-disable @typescript-eslint/no-unused-vars */

import {retryInterval} from 'asyncbox';
import {errors} from 'appium/driver';

/**
 * @this {import('../driver').AndroidDriver}
 * @param {string} attribute
 * @param {string} elementId
 * @returns {Promise<string?>}
 */
export async function getAttribute(attribute, elementId) {
  throw new errors.NotImplementedError('Not implemented');
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {string} elementId
 * @returns {Promise<string?>}
 */
export async function getName(elementId) {
  return await this.getAttribute('className', elementId);
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {string} elementId
 * @returns {Promise<boolean>}
 */
export async function elementDisplayed(elementId) {
  return (await this.getAttribute('displayed', elementId)) === 'true';
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {string} elementId
 * @returns {Promise<boolean>}
 */
export async function elementEnabled(elementId) {
  return (await this.getAttribute('enabled', elementId)) === 'true';
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {string} elementId
 * @returns {Promise<boolean>}
 */
export async function elementSelected(elementId) {
  return (await this.getAttribute('selected', elementId)) === 'true';
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {string|string[]} keys
 * @param {string} elementId
 * @param {boolean} [replace=false]
 * @returns {Promise<void>}
 */
export async function setElementValue(keys, elementId, replace = false) {
  const text = keys instanceof Array ? keys.join('') : keys;
  return await this.doSetElementValue({
    elementId,
    text: String(text),
    replace,
  });
}

/**
 * Reason for isolating doSetElementValue from setElementValue is for reusing setElementValue
 * across android-drivers (like appium-uiautomator2-driver) and to avoid code duplication.
 * Other android-drivers (like appium-uiautomator2-driver) need to override doSetElementValue
 * to facilitate setElementValue.
 *
 * @this {import('../driver').AndroidDriver}
 * @param {import('./types').DoSetElementValueOpts} params
 * @returns {Promise<void>}
 */
export async function doSetElementValue(params) {
  throw new errors.NotImplementedError('Not implemented');
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {string|string[]} keys
 * @param {string} elementId
 * @returns {Promise<void>}
 */
export async function setValue(keys, elementId) {
  return await this.setElementValue(keys, elementId, false);
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {string|string[]} keys
 * @param {string} elementId
 * @returns {Promise<void>}
 */
export async function replaceValue(keys, elementId) {
  return await this.setElementValue(keys, elementId, true);
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {string|string[]} keys
 * @param {string} elementId
 * @returns {Promise<void>}
 */
export async function setValueImmediate(keys, elementId) {
  let text = keys;
  if (keys instanceof Array) {
    text = keys.join('');
  }

  // first, make sure we are focused on the element
  await this.click(elementId);

  // then send through adb
  await this.adb.inputText(/** @type {string} */ (text));
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {string} elementId
 * @returns {Promise<void>}
 */
export async function clear(elementId) {
  let text = (await this.getText(elementId)) || '';
  let length = text.length;
  if (length === 0) {
    // if length is zero there are two possibilities:
    //   1. there is nothing in the text field
    //   2. it is a password field
    // since there is little overhead to the adb call, delete 100 elements
    // if we get zero, just in case it is #2
    length = 100;
  }
  await this.click(elementId);
  this.log.debug(`Sending up to ${length} clear characters to device`);
  await retryInterval(5, 500, async () => {
    let remainingLength = length;
    while (remainingLength > 0) {
      let lengthToSend = remainingLength < 50 ? remainingLength : 50;
      this.log.debug(`Sending ${lengthToSend} clear characters to device`);
      await this.adb.clearTextField(lengthToSend);
      remainingLength -= lengthToSend;
    }
  });
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {string} elementId
 * @returns {Promise<import('@appium/types').Position>}
 */
export async function getLocationInView(elementId) {
  return await this.getLocation(elementId);
}
