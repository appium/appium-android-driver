/* eslint-disable @typescript-eslint/no-unused-vars */

import {errors} from 'appium/driver';
import type {Position, Size} from '@appium/types';
import type {AndroidDriver} from '../driver';
import type {DoSetElementValueOpts} from './types';

/**
 * Gets an attribute value from an element.
 *
 * @param attribute The name of the attribute to retrieve.
 * @param elementId The element identifier.
 * @returns Promise that resolves to the attribute value, or `null` if not found.
 * @throws {errors.NotImplementedError} This method is not implemented.
 */
export async function getAttribute(
  this: AndroidDriver,
  attribute: string,
  elementId: string,
): Promise<string | null> {
  throw new errors.NotImplementedError('Not implemented');
}

/**
 * Clicks on an element.
 *
 * @param elementId The element identifier.
 * @returns Promise that resolves when the click is performed.
 * @throws {errors.NotImplementedError} This method is not implemented.
 */
export async function click(
  this: AndroidDriver,
  elementId: string,
): Promise<void> {
  throw new errors.NotImplementedError('Not implemented');
}

/**
 * Gets the text content of an element.
 *
 * @param elementId The element identifier.
 * @returns Promise that resolves to the element's text content.
 * @throws {errors.NotImplementedError} This method is not implemented.
 */
export async function getText(
  this: AndroidDriver,
  elementId: string,
): Promise<string> {
  throw new errors.NotImplementedError('Not implemented');
}

/**
 * Gets the location of an element on the screen.
 *
 * @param elementId The element identifier.
 * @returns Promise that resolves to the element's position (x, y coordinates).
 * @throws {errors.NotImplementedError} This method is not implemented.
 */
export async function getLocation(
  this: AndroidDriver,
  elementId: string,
): Promise<Position> {
  throw new errors.NotImplementedError('Not implemented');
}

/**
 * Gets the size of an element.
 *
 * @param elementId The element identifier.
 * @returns Promise that resolves to the element's size (width, height).
 * @throws {errors.NotImplementedError} This method is not implemented.
 */
export async function getSize(
  this: AndroidDriver,
  elementId: string,
): Promise<Size> {
  throw new errors.NotImplementedError('Not implemented');
}

/**
 * Gets the class name of an element.
 *
 * @param elementId The element identifier.
 * @returns Promise that resolves to the element's class name.
 */
export async function getName(
  this: AndroidDriver,
  elementId: string,
): Promise<string> {
  return await this.getAttribute('className', elementId) as string;
}

/**
 * Checks if an element is displayed.
 *
 * @param elementId The element identifier.
 * @returns Promise that resolves to `true` if the element is displayed, `false` otherwise.
 */
export async function elementDisplayed(
  this: AndroidDriver,
  elementId: string,
): Promise<boolean> {
  return (await this.getAttribute('displayed', elementId)) === 'true';
}

/**
 * Checks if an element is enabled.
 *
 * @param elementId The element identifier.
 * @returns Promise that resolves to `true` if the element is enabled, `false` otherwise.
 */
export async function elementEnabled(
  this: AndroidDriver,
  elementId: string,
): Promise<boolean> {
  return (await this.getAttribute('enabled', elementId)) === 'true';
}

/**
 * Checks if an element is selected.
 *
 * @param elementId The element identifier.
 * @returns Promise that resolves to `true` if the element is selected, `false` otherwise.
 */
export async function elementSelected(
  this: AndroidDriver,
  elementId: string,
): Promise<boolean> {
  return (await this.getAttribute('selected', elementId)) === 'true';
}

/**
 * Sets the value of an element.
 *
 * @param keys The text to set, either as a string or an array of strings (which will be joined).
 * @param elementId The element identifier.
 * @param replace If `true`, replaces the existing value. If `false`, appends to it. Defaults to `false`.
 * @returns Promise that resolves when the value is set.
 */
export async function setElementValue(
  this: AndroidDriver,
  keys: string | string[],
  elementId: string,
  replace = false,
): Promise<void> {
  const text = keys instanceof Array ? keys.join('') : keys;
  return await this.doSetElementValue({
    elementId,
    text: String(text),
    replace,
  });
}

/**
 * Sets the value of an element.
 *
 * Reason for isolating doSetElementValue from setElementValue is for reusing setElementValue
 * across android-drivers (like appium-uiautomator2-driver) and to avoid code duplication.
 * Other android-drivers (like appium-uiautomator2-driver) need to override doSetElementValue
 * to facilitate setElementValue.
 *
 * @param params The parameters for setting the element value.
 * @returns Promise that resolves when the value is set.
 * @throws {errors.NotImplementedError} This method is not implemented.
 */
export async function doSetElementValue(
  this: AndroidDriver,
  params: DoSetElementValueOpts,
): Promise<void> {
  throw new errors.NotImplementedError('Not implemented');
}

/**
 * Sets the value of an element (appends to existing value).
 *
 * @param keys The text to set, either as a string or an array of strings (which will be joined).
 * @param elementId The element identifier.
 * @returns Promise that resolves when the value is set.
 */
export async function setValue(
  this: AndroidDriver,
  keys: string | string[],
  elementId: string,
): Promise<void> {
  return await this.setElementValue(keys, elementId, false);
}

/**
 * Replaces the value of an element.
 *
 * @param keys The text to set, either as a string or an array of strings (which will be joined).
 * @param elementId The element identifier.
 * @returns Promise that resolves when the value is replaced.
 */
export async function replaceValue(
  this: AndroidDriver,
  keys: string | string[],
  elementId: string,
): Promise<void> {
  return await this.setElementValue(keys, elementId, true);
}

/**
 * Sets the value of an element immediately using ADB input.
 *
 * @param keys The text to set, either as a string or an array of strings (which will be joined).
 * @param elementId The element identifier.
 * @returns Promise that resolves when the value is set.
 */
export async function setValueImmediate(
  this: AndroidDriver,
  keys: string | string[],
  elementId: string,
): Promise<void> {
  const text = Array.isArray(keys) ? keys.join('') : keys;
  // first, make sure we are focused on the element
  await this.click(elementId);
  // then send through adb
  await this.adb.inputText(text);
}

/**
 * Gets the location of an element relative to the view.
 *
 * @param elementId The element identifier.
 * @returns Promise that resolves to the element's position (x, y coordinates).
 */
export async function getLocationInView(
  this: AndroidDriver,
  elementId: string,
): Promise<Position> {
  return await this.getLocation(elementId);
}

