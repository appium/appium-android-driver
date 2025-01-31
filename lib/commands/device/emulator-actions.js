import {util} from '@appium/support';
import {requireEmulator} from './utils';
import { errors } from 'appium/driver';

/**
 * @deprecated Use mobile: extension
 * @this {import('../../driver').AndroidDriver}
 * @param {string|number} fingerprintId
 * @returns {Promise<void>}
 */
export async function fingerprint(fingerprintId) {
  requireEmulator.bind(this)('fingerprint is only available for emulators');
  await this.adb.fingerprint(String(fingerprintId));
}

/**
 * @this {import('../../driver').AndroidDriver}
 * @param {string | number} fingerprintId The value is the `finger_id` for the finger that was "scanned". It is a
 * unique integer that you assign for each virtual fingerprint. When the app
 * is running you can run this same command each time the emulator prompts you
 * for a fingerprint, you can run the adb command and pass it the `finger_id`
 * to simulate the fingerprint scan.
 * @returns {Promise<void>}
 */
export async function mobileFingerprint(fingerprintId) {
  await this.fingerprint(fingerprintId);
}

/**
 * @deprecated Use mobile: extension
 * @this {import('../../driver').AndroidDriver}
 * @param {string} phoneNumber
 * @param {string} message
 * @returns {Promise<void>}
 */
export async function sendSMS(phoneNumber, message) {
  requireEmulator.bind(this)('sendSMS is only available for emulators');
  await this.adb.sendSMS(phoneNumber, message);
}

/**
 * @this {import('../../driver').AndroidDriver}
 * @param {string} phoneNumber The phone number to send SMS to
 * @param {string} message The message payload
 * @returns {Promise<void>}
 */
export async function mobileSendSms(phoneNumber, message) {
  await this.sendSMS(phoneNumber, message);
}

/**
 * @deprecated Use mobile: extension
 * @this {import('../../driver').AndroidDriver}
 * @param {string} phoneNumber
 * @param {string} action
 * @returns {Promise<void>}
 */
export async function gsmCall(phoneNumber, action) {
  requireEmulator.bind(this)('gsmCall is only available for emulators');
  await this.adb.gsmCall(phoneNumber, /** @type {any} */ (action));
}

/**
 * @this {import('../../driver').AndroidDriver}
 * @param {string} phoneNumber The phone number to call to
 * @param {import('../types').GsmAction} action  Action to take
 * @returns {Promise<void>}
 */
export async function mobileGsmCall(phoneNumber, action) {
  await this.gsmCall(phoneNumber, action);
}

/**
 * @deprecated Use mobile: extension
 * @this {import('../../driver').AndroidDriver}
 * @param {import('../types').GsmSignalStrength} signalStrengh
 * @returns {Promise<void>}
 */
export async function gsmSignal(signalStrengh) {
  requireEmulator.bind(this)('gsmSignal is only available for emulators');
  await this.adb.gsmSignal(signalStrengh);
}

/**
 * @this {import('../../driver').AndroidDriver}
 * @param {import('../types').GsmSignalStrength} strength The signal strength value
 * @returns {Promise<void>}
 */
export async function mobileGsmSignal(strength) {
  await this.gsmSignal(strength);
}

/**
 * @deprecated Use mobile: extension
 * @this {import('../../driver').AndroidDriver}
 * @param {import('../types').GsmVoiceState} state
 * @returns {Promise<void>}
 */
export async function gsmVoice(state) {
  requireEmulator.bind(this)('gsmVoice is only available for emulators');
  await this.adb.gsmVoice(state);
}

/**
 * @this {import('../../driver').AndroidDriver}
 * @param {import('../types').GsmVoiceState} state
 * @returns {Promise<void>}
 */
export async function mobileGsmVoice(state) {
  await this.gsmVoice(state);
}

/**
 * @deprecated Use mobile: extension
 * @this {import('../../driver').AndroidDriver}
 * @param {import('../types').PowerACState} state
 * @returns {Promise<void>}
 */
export async function powerAC(state) {
  requireEmulator.bind(this)('powerAC is only available for emulators');
  await this.adb.powerAC(state);
}

/**
 * @this {import('../../driver').AndroidDriver}
 * @param {import('../types').PowerACState} state
 * @returns {Promise<void>}
 */
export async function mobilePowerAc(state) {
  await this.powerAC(state);
}

/**
 * @deprecated Use mobile: extension
 * @this {import('../../driver').AndroidDriver}
 * @param {number} batteryPercent
 * @returns {Promise<void>}
 */
export async function powerCapacity(batteryPercent) {
  requireEmulator.bind(this)('powerCapacity is only available for emulators');
  await this.adb.powerCapacity(batteryPercent);
}

/**
 * @this {import('../../driver').AndroidDriver}
 * @param {number} percent Percentage value in range `[0, 100]`
 * @return {Promise<void>}
 */
export async function mobilePowerCapacity(percent) {
  await this.powerCapacity(percent);
}

/**
 * @deprecated Use mobile: extension
 * @this {import('../../driver').AndroidDriver}
 * @param {import('../types').NetworkSpeed} networkSpeed
 * @returns {Promise<void>}
 */
export async function networkSpeed(networkSpeed) {
  requireEmulator.bind(this)('networkSpeed is only available for emulators');
  await this.adb.networkSpeed(networkSpeed);
}

/**
 * @this {import('../../driver').AndroidDriver}
 * @param {import('../types').NetworkSpeed} speed
 * @returns {Promise<void>}
 */
export async function mobileNetworkSpeed(speed) {
  await this.networkSpeed(speed);
}

/**
 * @this {import('../../driver').AndroidDriver}
 * @param {string} sensorType Sensor type as declared in `adb.SENSORS`
 * @param {string} value Value to set to the sensor
 * @returns {Promise<void>}
 */
export async function sensorSet(sensorType, value) {
  requireEmulator.bind(this)('sensorSet is only available for emulators');
  if (!util.hasValue(sensorType)) {
    throw new errors.InvalidArgumentError(`'sensorType' argument is required`);
  }
  if (!util.hasValue(value)) {
    throw new errors.InvalidArgumentError(`'value' argument is required`);
  }
  await this.adb.sensorSet(sensorType, /** @type {any} */ (value));
}

/**
 * @typedef {import('appium-adb').ADB} ADB
 */
