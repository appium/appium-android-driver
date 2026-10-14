import {util} from '@appium/support';
import {errors} from 'appium/driver.js';

import type {AndroidDriverConstraints} from '../../constraints.js';
import type {AndroidDriver} from '../../driver.js';
import type {GsmAction, GsmSignalStrength, GsmVoiceState, PowerACState, NetworkSpeed} from '../types.js';
import {requireEmulator} from './utils.js';

declare module '../../driver.js' {
  interface AndroidDriver<C extends AndroidDriverConstraints> {
    fingerprint(...args: Parameters<typeof fingerprint>): ReturnType<typeof fingerprint>;
    mobileFingerprint(...args: Parameters<typeof mobileFingerprint>): ReturnType<typeof mobileFingerprint>;
    sendSMS(...args: Parameters<typeof sendSMS>): ReturnType<typeof sendSMS>;
    mobileSendSms(...args: Parameters<typeof mobileSendSms>): ReturnType<typeof mobileSendSms>;
    gsmCall(...args: Parameters<typeof gsmCall>): ReturnType<typeof gsmCall>;
    mobileGsmCall(...args: Parameters<typeof mobileGsmCall>): ReturnType<typeof mobileGsmCall>;
    gsmSignal(...args: Parameters<typeof gsmSignal>): ReturnType<typeof gsmSignal>;
    mobileGsmSignal(...args: Parameters<typeof mobileGsmSignal>): ReturnType<typeof mobileGsmSignal>;
    gsmVoice(...args: Parameters<typeof gsmVoice>): ReturnType<typeof gsmVoice>;
    mobileGsmVoice(...args: Parameters<typeof mobileGsmVoice>): ReturnType<typeof mobileGsmVoice>;
    powerAC(...args: Parameters<typeof powerAC>): ReturnType<typeof powerAC>;
    mobilePowerAc(...args: Parameters<typeof mobilePowerAc>): ReturnType<typeof mobilePowerAc>;
    powerCapacity(...args: Parameters<typeof powerCapacity>): ReturnType<typeof powerCapacity>;
    mobilePowerCapacity(...args: Parameters<typeof mobilePowerCapacity>): ReturnType<typeof mobilePowerCapacity>;
    networkSpeed(...args: Parameters<typeof networkSpeed>): ReturnType<typeof networkSpeed>;
    mobileNetworkSpeed(...args: Parameters<typeof mobileNetworkSpeed>): ReturnType<typeof mobileNetworkSpeed>;
    sensorSet(...args: Parameters<typeof sensorSet>): ReturnType<typeof sensorSet>;
  }
}

/**
 * @deprecated Use mobile: extension
 */
export async function fingerprint(this: AndroidDriver, fingerprintId: string | number): Promise<void> {
  requireEmulator.bind(this)('fingerprint is only available for emulators');
  await this.adb.fingerprint(String(fingerprintId));
}

/**
 * Simulates a fingerprint scan on the emulator.
 *
 * @param fingerprintId - The value is the `finger_id` for the finger that was "scanned". It is a
 * unique integer that you assign for each virtual fingerprint. When the app
 * is running you can run this same command each time the emulator prompts you
 * for a fingerprint, you can run the adb command and pass it the `finger_id`
 * to simulate the fingerprint scan.
 */
export async function mobileFingerprint(this: AndroidDriver, fingerprintId: string | number): Promise<void> {
  await this.fingerprint(fingerprintId);
}

/**
 * @deprecated Use mobile: extension
 */
export async function sendSMS(this: AndroidDriver, phoneNumber: string, message: string): Promise<void> {
  requireEmulator.bind(this)('sendSMS is only available for emulators');
  await this.adb.sendSMS(phoneNumber, message);
}

/**
 * Sends an SMS message to the emulator.
 *
 * @param phoneNumber - The phone number to send SMS to
 * @param message - The message payload
 */
export async function mobileSendSms(this: AndroidDriver, phoneNumber: string, message: string): Promise<void> {
  await this.sendSMS(phoneNumber, message);
}

/**
 * @deprecated Use mobile: extension
 */
export async function gsmCall(this: AndroidDriver, phoneNumber: string, action: GsmAction): Promise<void> {
  requireEmulator.bind(this)('gsmCall is only available for emulators');
  await this.adb.gsmCall(phoneNumber, action);
}

/**
 * Simulates a GSM call on the emulator.
 *
 * @param phoneNumber - The phone number to call to
 * @param action - Action to take
 */
export async function mobileGsmCall(this: AndroidDriver, phoneNumber: string, action: GsmAction): Promise<void> {
  await this.gsmCall(phoneNumber, action);
}

/**
 * @deprecated Use mobile: extension
 */
export async function gsmSignal(this: AndroidDriver, signalStrength: GsmSignalStrength): Promise<void> {
  requireEmulator.bind(this)('gsmSignal is only available for emulators');
  await this.adb.gsmSignal(signalStrength);
}

/**
 * Sets the GSM signal strength on the emulator.
 *
 * @param strength - The signal strength value
 */
export async function mobileGsmSignal(this: AndroidDriver, strength: GsmSignalStrength): Promise<void> {
  await this.gsmSignal(strength);
}

/**
 * @deprecated Use mobile: extension
 */
export async function gsmVoice(this: AndroidDriver, state: GsmVoiceState): Promise<void> {
  requireEmulator.bind(this)('gsmVoice is only available for emulators');
  await this.adb.gsmVoice(state);
}

/**
 * Sets the GSM voice state on the emulator.
 *
 * @param state - The voice state
 */
export async function mobileGsmVoice(this: AndroidDriver, state: GsmVoiceState): Promise<void> {
  await this.gsmVoice(state);
}

/**
 * @deprecated Use mobile: extension
 */
export async function powerAC(this: AndroidDriver, state: PowerACState): Promise<void> {
  requireEmulator.bind(this)('powerAC is only available for emulators');
  await this.adb.powerAC(state);
}

/**
 * Sets the power AC state on the emulator.
 *
 * @param state - The AC power state
 */
export async function mobilePowerAc(this: AndroidDriver, state: PowerACState): Promise<void> {
  await this.powerAC(state);
}

/**
 * @deprecated Use mobile: extension
 */
export async function powerCapacity(this: AndroidDriver, batteryPercent: number): Promise<void> {
  requireEmulator.bind(this)('powerCapacity is only available for emulators');
  await this.adb.powerCapacity(batteryPercent);
}

/**
 * Sets the battery capacity on the emulator.
 *
 * @param percent - Percentage value in range `[0, 100]`
 */
export async function mobilePowerCapacity(this: AndroidDriver, percent: number): Promise<void> {
  await this.powerCapacity(percent);
}

/**
 * @deprecated Use mobile: extension
 */
export async function networkSpeed(this: AndroidDriver, networkSpeed: NetworkSpeed): Promise<void> {
  requireEmulator.bind(this)('networkSpeed is only available for emulators');
  await this.adb.networkSpeed(networkSpeed);
}

/**
 * Sets the network speed on the emulator.
 *
 * @param speed - The network speed value
 */
export async function mobileNetworkSpeed(this: AndroidDriver, speed: NetworkSpeed): Promise<void> {
  await this.networkSpeed(speed);
}

/**
 * Sets a sensor value on the emulator.
 *
 * @param sensorType - Sensor type as declared in `adb.SENSORS`
 * @param value - Value to set to the sensor
 * @throws {errors.InvalidArgumentError} If sensorType or value is not provided
 */
export async function sensorSet(this: AndroidDriver, sensorType: string, value: string | number): Promise<void> {
  requireEmulator.bind(this)('sensorSet is only available for emulators');
  if (!util.hasValue(sensorType)) {
    throw new errors.InvalidArgumentError(`'sensorType' argument is required`);
  }
  if (!util.hasValue(value)) {
    throw new errors.InvalidArgumentError(`'value' argument is required`);
  }
  await this.adb.sensorSet(sensorType, value as any);
}
