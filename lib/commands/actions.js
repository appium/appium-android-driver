// @ts-check

import {util} from '@appium/support';
import B from 'bluebird';
import {AndroidHelpers} from '../helpers';
import {requireArgs} from '../utils';
import {mixin} from './mixins';
import {errors} from 'appium/driver';

const dragStepsPerSec = 40;

/**
 * @type {import('./mixins').ActionsMixin & ThisType<import('../driver').AndroidDriver>}
 * @satisfies {import('@appium/types').ExternalDriver}
 */
const ActionsMixin = {
  async keyevent(keycode, metastate) {
    // TODO deprecate keyevent; currently wd only implements keyevent
    this.log.warn('keyevent will be deprecated use pressKeyCode');
    return await this.pressKeyCode(keycode, metastate);
  },

  async pressKeyCode(keycode, metastate) {
    throw new errors.NotImplementedError('Not implemented');
  },

  async longPressKeyCode(keycode, metastate) {
    throw new errors.NotImplementedError('Not implemented');
  },

  async getOrientation() {
    throw new errors.NotImplementedError('Not implemented');
  },

  async setOrientation(orientation) {
    throw new errors.NotImplementedError('Not implemented');
  },

  async fakeFlick(xSpeed, ySpeed) {
    throw new errors.NotImplementedError('Not implemented');
  },

  async fakeFlickElement(elementId, xoffset, yoffset, speed) {
    throw new errors.NotImplementedError('Not implemented');
  },

  async swipe(startX, startY, endX, endY, duration, touchCount, elId) {
    throw new errors.NotImplementedError('Not implemented');
  },

  async doSwipe(swipeOpts) {
    throw new errors.NotImplementedError('Not implemented');
  },

  async pinchClose(startX, startY, endX, endY, duration, percent, steps, elId) {
    throw new errors.NotImplementedError('Not implemented');
  },

  async pinchOpen(startX, startY, endX, endY, duration, percent, steps, elId) {
    throw new errors.NotImplementedError('Not implemented');
  },

  async flick(element, xSpeed, ySpeed, xOffset, yOffset, speed) {
    if (element) {
      await this.fakeFlickElement(element, xOffset, yOffset, speed);
    } else {
      await this.fakeFlick(xSpeed, ySpeed);
    }
  },

  async drag(startX, startY, endX, endY, duration, touchCount, elementId, destElId) {
    let dragOpts = {
      elementId,
      destElId,
      startX,
      startY,
      endX,
      endY,
      steps: Math.round(duration * dragStepsPerSec),
    };
    return await this.doDrag(dragOpts);
  },

  async doDrag(dragOpts) {
    throw new errors.NotImplementedError('Not implemented');
  },

  async mobileLock(opts = {}) {
    const {seconds} = opts;
    return await this.lock(seconds);
  },

  async lock(seconds) {
    await this.adb.lock();
    if (Number.isNaN(seconds)) {
      return;
    }

    const floatSeconds = parseFloat(String(seconds));
    if (floatSeconds <= 0) {
      return;
    }
    await B.delay(1000 * floatSeconds);
    await this.unlock();
  },

  async isLocked() {
    return await this.adb.isScreenLocked();
  },

  async unlock() {
    return await AndroidHelpers.unlock(this, this.adb, this.caps);
  },

  async openNotifications() {
    throw new errors.NotImplementedError('Not implemented');
  },

  async setLocation(latitude, longitude) {
    await this.adb.sendTelnetCommand(`geo fix ${longitude} ${latitude}`);
  },

  async fingerprint(fingerprintId) {
    if (!this.isEmulator()) {
      this.log.errorAndThrow('fingerprint method is only available for emulators');
    }
    await this.adb.fingerprint(String(fingerprintId));
  },

  async mobileFingerprint(opts) {
    const {fingerprintId} = requireArgs('fingerprintId', opts);
    await this.fingerprint(fingerprintId);
  },

  async sendSMS(phoneNumber, message) {
    if (!this.isEmulator()) {
      this.log.errorAndThrow('sendSMS method is only available for emulators');
    }
    await this.adb.sendSMS(phoneNumber, message);
  },

  async mobileSendSms(opts) {
    const {phoneNumber, message} = requireArgs(['phoneNumber', 'message'], opts);
    await this.sendSMS(phoneNumber, message);
  },

  async gsmCall(phoneNumber, action) {
    if (!this.isEmulator()) {
      this.log.errorAndThrow('gsmCall method is only available for emulators');
    }
    await this.adb.gsmCall(phoneNumber, /** @type {any} */(action));
  },

  async mobileGsmCall(opts) {
    const {phoneNumber, action} = requireArgs(['phoneNumber', 'action'], opts);
    await this.gsmCall(phoneNumber, action);
  },

  async gsmSignal(signalStrengh) {
    if (!this.isEmulator()) {
      this.log.errorAndThrow('gsmSignal method is only available for emulators');
    }
    await this.adb.gsmSignal(signalStrengh);
  },

  async mobileGsmSignal(opts) {
    const {strength} = requireArgs('strength', opts);
    await this.gsmSignal(strength);
  },

  async gsmVoice(state) {
    if (!this.isEmulator()) {
      this.log.errorAndThrow('gsmVoice method is only available for emulators');
    }
    await this.adb.gsmVoice(state);
  },

  async mobileGsmVoice(opts) {
    const {state} = requireArgs('state', opts);
    await this.gsmVoice(state);
  },

  async powerAC(state) {
    if (!this.isEmulator()) {
      this.log.errorAndThrow('powerAC method is only available for emulators');
    }
    await this.adb.powerAC(state);
  },

  async mobilePowerAc(opts) {
    const {state} = requireArgs('state', opts);
    await this.powerAC(state);
  },

  async powerCapacity(batteryPercent) {
    if (!this.isEmulator()) {
      this.log.errorAndThrow('powerCapacity method is only available for emulators');
    }
    await this.adb.powerCapacity(batteryPercent);
  },

  async mobilePowerCapacity(opts) {
    const {percent} = requireArgs('percent', opts);
    await this.powerCapacity(percent);
  },

  async networkSpeed(networkSpeed) {
    if (!this.isEmulator()) {
      this.log.errorAndThrow('networkSpeed method is only available for emulators');
    }
    await this.adb.networkSpeed(networkSpeed);
  },

  async mobileNetworkSpeed(opts) {
    const {speed} = requireArgs('speed', opts);
    await this.networkSpeed(speed);
  },

  async sensorSet(opts) {
    const {sensorType, value} = opts;
    if (!util.hasValue(sensorType)) {
      this.log.errorAndThrow(`'sensorType' argument is required`);
    }
    if (!util.hasValue(value)) {
      this.log.errorAndThrow(`'value' argument is required`);
    }
    if (!this.isEmulator()) {
      this.log.errorAndThrow('sensorSet method is only available for emulators');
    }
    await this.adb.sensorSet(sensorType, /** @type {any} */(value));
  },

  async getScreenshot() {
    throw new errors.NotImplementedError('Not implemented');
  },
};

mixin(ActionsMixin);

export default ActionsMixin;

/**
 * @typedef {import('appium-adb').ADB} ADB
 */
