// @ts-check

import {fs, tempDir, util, imageUtil} from '@appium/support';
import B from 'bluebird';
import path from 'path';
import {exec} from 'teen_process';
import {AndroidHelpers} from '../helpers';
import {requireArgs} from '../utils';
import {mixin} from './mixins';

const swipeStepsPerSec = 28;
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
    return await /** @type {AndroidBootstrap} */ (this.bootstrap).sendAction('pressKeyCode', {
      keycode,
      metastate: metastate ?? null,
    });
  },
  async longPressKeyCode(keycode, metastate) {
    return await /** @type {AndroidBootstrap} */ (this.bootstrap).sendAction('longPressKeyCode', {
      keycode,
      metastate: metastate ?? null,
    });
  },
  async getOrientation() {
    let params = {
      naturalOrientation: !!this.opts.androidNaturalOrientation,
    };
    let orientation = await /** @type {AndroidBootstrap} */ (this.bootstrap).sendAction(
      'orientation',
      params
    );
    return orientation.toUpperCase();
  },
  async setOrientation(orientation) {
    let params = {
      orientation: orientation.toUpperCase(),
      naturalOrientation: !!this.opts.androidNaturalOrientation,
    };
    return await /** @type {AndroidBootstrap} */ (this.bootstrap).sendAction('orientation', params);
  },
  async fakeFlick(xSpeed, ySpeed) {
    return await /** @type {AndroidBootstrap} */ (this.bootstrap).sendAction('flick', {
      xSpeed,
      ySpeed,
    });
  },
  async fakeFlickElement(elementId, xoffset, yoffset, speed) {
    let params = {xoffset, yoffset, speed, elementId};
    return await /** @type {AndroidBootstrap} */ (this.bootstrap).sendAction(
      'element:flick',
      params
    );
  },
  async swipe(startX, startY, endX, endY, duration, touchCount, elId) {
    if (startX === 'null') {
      startX = 0.5;
    }
    if (startY === 'null') {
      startY = 0.5;
    }
    /** @type {import('./types').SwipeOpts} */
    const swipeOpts = {
      startX,
      startY,
      endX,
      endY,
      steps: Math.round(duration * swipeStepsPerSec),
    };
    // going the long way and checking for undefined and null since
    // we can't be assured `elId` is a string and not an int
    if (util.hasValue(elId)) {
      swipeOpts.elementId = elId;
    }
    return await this.doSwipe(swipeOpts);
  },
  async doSwipe(swipeOpts) {
    if (util.hasValue(swipeOpts.elementId)) {
      return await /** @type {AndroidBootstrap} */ (this.bootstrap).sendAction(
        'element:swipe',
        swipeOpts
      );
    } else {
      return await /** @type {AndroidBootstrap} */ (this.bootstrap).sendAction('swipe', swipeOpts);
    }
  },
  async pinchClose(startX, startY, endX, endY, duration, percent, steps, elId) {
    let pinchOpts = {
      direction: 'in',
      elementId: elId,
      percent,
      steps,
    };
    return await /** @type {AndroidBootstrap} */ (this.bootstrap).sendAction(
      'element:pinch',
      pinchOpts
    );
  },
  async pinchOpen(startX, startY, endX, endY, duration, percent, steps, elId) {
    let pinchOpts = {direction: 'out', elementId: elId, percent, steps};
    return await /** @type {AndroidBootstrap} */ (this.bootstrap).sendAction(
      'element:pinch',
      pinchOpts
    );
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
    if (util.hasValue(dragOpts.elementId)) {
      return await /** @type {AndroidBootstrap} */ (this.bootstrap).sendAction(
        'element:drag',
        dragOpts
      );
    } else {
      return await /** @type {AndroidBootstrap} */ (this.bootstrap).sendAction('drag', dragOpts);
    }
  },
  async lock(seconds) {
    await /** @type {ADB} */ (this.adb).lock();
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
    return await /** @type {ADB} */ (this.adb).isScreenLocked();
  },
  async unlock() {
    return await AndroidHelpers.unlock(this, /** @type {ADB} */ (this.adb), this.caps);
  },
  async openNotifications() {
    return await /** @type {AndroidBootstrap} */ (this.bootstrap).sendAction('openNotification');
  },
  async setLocation(latitude, longitude) {
    await /** @type {ADB} */ (this.adb).sendTelnetCommand(`geo fix ${longitude} ${latitude}`);
  },
  async fingerprint(fingerprintId) {
    if (!this.isEmulator()) {
      this.log.errorAndThrow('fingerprint method is only available for emulators');
    }
    await /** @type {ADB} */ (this.adb).fingerprint(String(fingerprintId));
  },
  async mobileFingerprint(opts) {
    const {fingerprintId} = requireArgs('fingerprintId', opts);
    await this.fingerprint(fingerprintId);
  },
  async sendSMS(phoneNumber, message) {
    if (!this.isEmulator()) {
      this.log.errorAndThrow('sendSMS method is only available for emulators');
    }
    await /** @type {ADB} */ (this.adb).sendSMS(phoneNumber, message);
  },
  async mobileSendSms(opts) {
    const {phoneNumber, message} = requireArgs(['phoneNumber', 'message'], opts);
    await this.sendSMS(phoneNumber, message);
  },
  async gsmCall(phoneNumber, action) {
    if (!this.isEmulator()) {
      this.log.errorAndThrow('gsmCall method is only available for emulators');
    }
    await /** @type {ADB} */ (this.adb).gsmCall(phoneNumber, action);
  },
  async mobileGsmCall(opts) {
    const {phoneNumber, action} = requireArgs(['phoneNumber', 'action'], opts);
    await this.gsmCall(phoneNumber, action);
  },
  async gsmSignal(signalStrengh) {
    if (!this.isEmulator()) {
      this.log.errorAndThrow('gsmSignal method is only available for emulators');
    }
    await /** @type {ADB} */ (this.adb).gsmSignal(signalStrengh);
  },
  async mobileGsmSignal(opts) {
    const {strength} = requireArgs('strength', opts);
    await this.gsmSignal(strength);
  },
  async gsmVoice(state) {
    if (!this.isEmulator()) {
      this.log.errorAndThrow('gsmVoice method is only available for emulators');
    }
    await /** @type {ADB} */ (this.adb).gsmVoice(state);
  },
  async mobileGsmVoice(opts) {
    const {state} = requireArgs('state', opts);
    await this.gsmVoice(state);
  },
  async powerAC(state) {
    if (!this.isEmulator()) {
      this.log.errorAndThrow('powerAC method is only available for emulators');
    }
    await /** @type {ADB} */ (this.adb).powerAC(state);
  },
  async mobilePowerAc(opts) {
    const {state} = requireArgs('state', opts);
    await this.powerAC(state);
  },
  async powerCapacity(batteryPercent) {
    if (!this.isEmulator()) {
      this.log.errorAndThrow('powerCapacity method is only available for emulators');
    }
    await /** @type {ADB} */ (this.adb).powerCapacity(batteryPercent);
  },
  async mobilePowerCapacity(opts) {
    const {percent} = requireArgs('percent', opts);
    await this.powerCapacity(percent);
  },
  async networkSpeed(networkSpeed) {
    if (!this.isEmulator()) {
      this.log.errorAndThrow('networkSpeed method is only available for emulators');
    }
    await /** @type {ADB} */ (this.adb).networkSpeed(networkSpeed);
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
    await /** @type {ADB} */ (this.adb).sensorSet(sensorType, value);
  },
  async getScreenshotDataWithAdbShell(adb, opts) {
    const localFile = await tempDir.path({prefix: 'appium', suffix: '.png'});
    if (await fs.exists(localFile)) {
      await fs.unlink(localFile);
    }
    try {
      const pngDir = opts.androidScreenshotPath || '/data/local/tmp/';
      const png = path.posix.resolve(pngDir, 'screenshot.png');
      await adb.shell(['/system/bin/rm', `${png};`, '/system/bin/screencap', '-p', png]);
      if (!(await adb.fileSize(png))) {
        throw new Error('The size of the taken screenshot equals to zero.');
      }
      await adb.pull(png, localFile);
      return await fs.readFile(localFile);
    } finally {
      if (await fs.exists(localFile)) {
        await fs.unlink(localFile);
      }
    }
  },
  async getScreenshotDataWithAdbExecOut(adb) {
    const {stdout, stderr, code} = await exec(
      adb.executable.path,
      [...adb.executable.defaultArgs, 'exec-out', '/system/bin/screencap', '-p'],
      {encoding: 'binary', isBuffer: true}
    );
    // if there is an error, throw
    if (code || stderr.length) {
      throw new Error(`Screenshot returned error, code: '${code}', stderr: '${stderr.toString()}'`);
    }
    // if we don't get anything at all, throw
    if (!stdout.length) {
      throw new Error('Screenshot returned no data');
    }

    return stdout;
  },
  async getScreenshot() {
    const apiLevel = await /** @type {ADB} */ (this.adb).getApiLevel();
    let image = null;
    if (apiLevel > 20) {
      try {
        // This screenshoting approach is way faster, since it requires less external commands
        // to be executed. Unfortunately, exec-out option is only supported by newer Android/SDK versions (5.0 and later)
        image = await this.getScreenshotDataWithAdbExecOut(/** @type {ADB} */ (this.adb));
      } catch (e) {
        this.log.info(
          `Cannot get screenshot data with 'adb exec-out' because of '${
            /** @type {Error} */ (e).message
          }'. ` + `Defaulting to 'adb shell' call`
        );
      }
    }
    if (!image) {
      try {
        image = await this.getScreenshotDataWithAdbShell(/** @type {ADB} */ (this.adb), this.opts);
      } catch (e) {
        const err =
          `Cannot get screenshot data because of '${/** @type {Error} */ (e).message}'. ` +
          `Make sure the 'LayoutParams.FLAG_SECURE' is not set for ` +
          `the current view`;
        this.log.error(err);
        throw new Error(err);
      }
    }
    if (apiLevel < 23) {
      // Android bug 8433742 - rotate screenshot if screen is rotated
      let screenOrientation = await /** @type {ADB} */ (this.adb).getScreenOrientation();
      try {
        image = await imageUtil.requireSharp()(image).rotate(-90 * screenOrientation).toBuffer();
      } catch (err) {
        this.log.warn(`Could not rotate screenshot due to error: ${err}`);
      }
    }
    return image.toString('base64');
  },
};

mixin(ActionsMixin);

/**
 * @typedef {import('../bootstrap').AndroidBootstrap} AndroidBootstrap
 * @typedef {import('appium-adb').ADB} ADB
 */
