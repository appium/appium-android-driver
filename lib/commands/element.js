/* eslint-disable @typescript-eslint/no-unused-vars */

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
 * @returns {Promise<void>}
 */
export async function click(elementId) {
  throw new errors.NotImplementedError('Not implemented');
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {string} elementId
 * @returns {Promise<string>}
 */
export async function getText(elementId) {
  throw new errors.NotImplementedError('Not implemented');
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {string} elementId
 * @returns {Promise<import('@appium/types').Position>}
 */
export async function getLocation(elementId) {
  throw new errors.NotImplementedError('Not implemented');
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {string} elementId
 * @returns {Promise<import('@appium/types').Size>}
 */
export async function getSize(elementId) {
  throw new errors.NotImplementedError('Not implemented');
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {string} elementId
 * @returns {Promise<string>}
 */
export async function getName(elementId) {
  return /** @type {string} */ (await this.getAttribute('className', elementId));
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
  const text = Array.isArray(keys) ? keys.join('') : keys;
  // first, make sure we are focused on the element
  await this.click(elementId);
  // then send through adb
  await this.adb.inputText(/** @type {string} */ (text));
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {string} elementId
 * @returns {Promise<import('@appium/types').Position>}
 */
export async function getLocationInView(elementId) {
  return await this.getLocation(elementId);
}
