import {util} from '@appium/support';
import {requireArgs} from '../../utils';
import {requireEmulator} from './utils';

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
 * @param {import('../types').FingerprintOpts} opts
 * @returns {Promise<void>}
 */
export async function mobileFingerprint(opts) {
  const {fingerprintId} = requireArgs('fingerprintId', opts);
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
 * @param {import('../types').SendSMSOpts} opts
 * @returns {Promise<void>}
 */
export async function mobileSendSms(opts) {
  const {phoneNumber, message} = requireArgs(['phoneNumber', 'message'], opts);
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
 * @param {import('../types').GsmCallOpts} opts
 * @returns {Promise<void>}
 */
export async function mobileGsmCall(opts) {
  const {phoneNumber, action} = requireArgs(['phoneNumber', 'action'], opts);
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
 * @param {import('../types').GsmSignalStrengthOpts} opts
 * @returns {Promise<void>}
 */
export async function mobileGsmSignal(opts) {
  const {strength} = requireArgs('strength', opts);
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
 * @param {import('../types').GsmVoiceOpts} opts
 * @returns {Promise<void>}
 */
export async function mobileGsmVoice(opts) {
  const {state} = requireArgs('state', opts);
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
 * @param {import('../types').PowerACOpts} opts
 * @returns {Promise<void>}
 */
export async function mobilePowerAc(opts) {
  const {state} = requireArgs('state', opts);
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
 * @param {import('../types').PowerCapacityOpts} opts
 * @return {Promise<void>}
 */
export async function mobilePowerCapacity(opts) {
  const {percent} = requireArgs('percent', opts);
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
 * @param {import('../types').NetworkSpeedOpts} opts
 * @returns {Promise<void>}
 */
export async function mobileNetworkSpeed(opts) {
  const {speed} = requireArgs('speed', opts);
  await this.networkSpeed(speed);
}

/**
 * @this {import('../../driver').AndroidDriver}
 * @param {import('../types').SensorSetOpts} opts
 * @returns {Promise<void>}
 */
export async function sensorSet(opts) {
  requireEmulator.bind(this)('sensorSet is only available for emulators');
  const {sensorType, value} = opts;
  if (!util.hasValue(sensorType)) {
    this.log.errorAndThrow(`'sensorType' argument is required`);
  }
  if (!util.hasValue(value)) {
    this.log.errorAndThrow(`'value' argument is required`);
  }
  await this.adb.sensorSet(sensorType, /** @type {any} */ (value));
}

/**
 * @typedef {import('appium-adb').ADB} ADB
 */
