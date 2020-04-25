import androidHelpers from '../android-helpers';
import { fs, util, tempDir} from 'appium-support';
import path from 'path';
import log from '../logger';
import B from 'bluebird';
import jimp from 'jimp';
import { exec } from 'teen_process';

const swipeStepsPerSec = 28;
const dragStepsPerSec = 40;

let commands = {}, helpers = {}, extensions = {};

commands.keyevent = async function keyevent (keycode, metastate = null) {
  // TODO deprecate keyevent; currently wd only implements keyevent
  log.warn('keyevent will be deprecated use pressKeyCode');
  return await this.pressKeyCode(keycode, metastate);
};

commands.pressKeyCode = async function pressKeyCode (keycode, metastate = null) {
  return await this.bootstrap.sendAction('pressKeyCode', {keycode, metastate});
};

commands.longPressKeyCode = async function longPressKeyCode (keycode, metastate = null) {
  return await this.bootstrap.sendAction('longPressKeyCode', {keycode, metastate});
};

commands.getOrientation = async function getOrientation () {
  let params = {
    naturalOrientation: !!this.opts.androidNaturalOrientation,
  };
  let orientation = await this.bootstrap.sendAction('orientation', params);
  return orientation.toUpperCase();
};

commands.setOrientation = async function setOrientation (orientation) {
  orientation = orientation.toUpperCase();
  let params = {
    orientation,
    naturalOrientation: !!this.opts.androidNaturalOrientation,
  };
  return await this.bootstrap.sendAction('orientation', params);
};

commands.fakeFlick = async function fakeFlick (xSpeed, ySpeed) {
  return await this.bootstrap.sendAction('flick', {xSpeed, ySpeed});
};

commands.fakeFlickElement = async function fakeFlickElement (elementId, xoffset, yoffset, speed) {
  let params = {xoffset, yoffset, speed, elementId};
  return await this.bootstrap.sendAction('element:flick', params);
};

commands.swipe = async function swipe (startX, startY, endX, endY, duration, touchCount, elId) {
  if (startX === 'null') {
    startX = 0.5;
  }
  if (startY === 'null') {
    startY = 0.5;
  }
  let swipeOpts = {startX, startY, endX, endY,
                   steps: Math.round(duration * swipeStepsPerSec)};
  // going the long way and checking for undefined and null since
  // we can't be assured `elId` is a string and not an int
  if (util.hasValue(elId)) {
    swipeOpts.elementId = elId;
  }
  return await this.doSwipe(swipeOpts);
};

commands.doSwipe = async function doSwipe (swipeOpts) {
  if (util.hasValue(swipeOpts.elementId)) {
    return await this.bootstrap.sendAction('element:swipe', swipeOpts);
  } else {
    return await this.bootstrap.sendAction('swipe', swipeOpts);
  }
};

commands.pinchClose = async function pinchClose (startX, startY, endX, endY, duration, percent, steps, elId) {
  let pinchOpts = {
    direction: 'in',
    elementId: elId,
    percent,
    steps
  };
  return await this.bootstrap.sendAction('element:pinch', pinchOpts);
};

commands.pinchOpen = async function pinchOpen (startX, startY, endX, endY, duration, percent, steps, elId) {
  let pinchOpts = {direction: 'out', elementId: elId, percent, steps};
  return await this.bootstrap.sendAction('element:pinch', pinchOpts);
};

commands.flick = async function flick (element, xSpeed, ySpeed, xOffset, yOffset, speed) {
  if (element) {
    await this.fakeFlickElement(element, xOffset, yOffset, speed);
  } else {
    await this.fakeFlick(xSpeed, ySpeed);
  }
};

commands.drag = async function drag (startX, startY, endX, endY, duration, touchCount, elementId, destElId) {
  let dragOpts = {
    elementId, destElId, startX, startY, endX, endY,
    steps: Math.round(duration * dragStepsPerSec)
  };
  return await this.doDrag(dragOpts);

};

commands.doDrag = async function doDrag (dragOpts) {
  if (util.hasValue(dragOpts.elementId)) {
    return await this.bootstrap.sendAction('element:drag', dragOpts);
  } else {
    return await this.bootstrap.sendAction('drag', dragOpts);
  }
};

commands.lock = async function lock (seconds) {
  await this.adb.lock();
  if (isNaN(seconds)) {
    return;
  }

  const floatSeconds = parseFloat(seconds);
  if (floatSeconds <= 0) {
    return;
  }
  await B.delay(1000 * floatSeconds);
  await this.unlock();
};

commands.isLocked = async function isLocked () {
  return await this.adb.isScreenLocked();
};

commands.unlock = async function unlock () {
  return await androidHelpers.unlock(this, this.adb, this.caps);
};

commands.openNotifications = async function openNotifications () {
  return await this.bootstrap.sendAction('openNotification');
};

commands.setLocation = async function setLocation (latitude, longitude) {
  return await this.adb.sendTelnetCommand(`geo fix ${longitude} ${latitude}`);
};

commands.fingerprint = async function fingerprint (fingerprintId) {
  if (!this.isEmulator()) {
    log.errorAndThrow('fingerprint method is only available for emulators');
  }
  await this.adb.fingerprint(fingerprintId);
};

commands.sendSMS = async function sendSMS (phoneNumber, message) {
  if (!this.isEmulator()) {
    log.errorAndThrow('sendSMS method is only available for emulators');
  }
  await this.adb.sendSMS(phoneNumber, message);
};

commands.gsmCall = async function gsmCall (phoneNumber, action) {
  if (!this.isEmulator()) {
    log.errorAndThrow('gsmCall method is only available for emulators');
  }
  await this.adb.gsmCall(phoneNumber, action);
};

commands.gsmSignal = async function gsmSignal (signalStrengh) {
  if (!this.isEmulator()) {
    log.errorAndThrow('gsmSignal method is only available for emulators');
  }
  await this.adb.gsmSignal(signalStrengh);
};

commands.gsmVoice = async function gsmVoice (state) {
  if (!this.isEmulator()) {
    log.errorAndThrow('gsmVoice method is only available for emulators');
  }
  await this.adb.gsmVoice(state);
};

commands.powerAC = async function powerAC (state) {
  if (!this.isEmulator()) {
    log.errorAndThrow('powerAC method is only available for emulators');
  }
  await this.adb.powerAC(state);
};

commands.powerCapacity = async function powerCapacity (batteryPercent) {
  if (!this.isEmulator()) {
    log.errorAndThrow('powerCapacity method is only available for emulators');
  }
  await this.adb.powerCapacity(batteryPercent);
};

commands.networkSpeed = async function networkSpeed (networkSpeed) {
  if (!this.isEmulator()) {
    log.errorAndThrow('networkSpeed method is only available for emulators');
  }
  await this.adb.networkSpeed(networkSpeed);
};

/**
 * Emulate sensors values on the connected emulator.
 *
 * @typedef {Object} Sensor
 * @property {string} sensorType - sensor type declared in adb.SENSORS
 * @property {string} value - value to set to the sensor
 *
 * @param {Object} Sensor
 * @throws {Error} - If sensorType is not defined
 * @throws {Error} - If value for the se sor is not defined
 * @throws {Error} - If deviceType is not an emulator
 */
commands.sensorSet = async function sensorSet (sensor = {}) {
  const {sensorType, value} = sensor;
  if (!util.hasValue(sensorType)) {
    log.errorAndThrow(`'sensorType' argument is required`);
  }
  if (!util.hasValue(value)) {
    log.errorAndThrow(`'value' argument is required`);
  }
  if (!this.isEmulator()) {
    log.errorAndThrow('sensorSet method is only available for emulators');
  }
  await this.adb.sensorSet(sensorType, value);
};

helpers.getScreenshotDataWithAdbShell = async function getScreenshotDataWithAdbShell (adb, opts) {
  const localFile = await tempDir.path({prefix: 'appium', suffix: '.png'});
  if (await fs.exists(localFile)) {
    await fs.unlink(localFile);
  }
  try {
    const pngDir = opts.androidScreenshotPath || '/data/local/tmp/';
    const png = path.posix.resolve(pngDir, 'screenshot.png');
    const cmd = ['/system/bin/rm', `${png};`, '/system/bin/screencap', '-p', png];
    await adb.shell(cmd);
    if (!await adb.fileSize(png)) {
      throw new Error('The size of the taken screenshot equals to zero.');
    }
    await adb.pull(png, localFile);
    return await jimp.read(localFile);
  } finally {
    if (await fs.exists(localFile)) {
      await fs.unlink(localFile);
    }
  }
};

helpers.getScreenshotDataWithAdbExecOut = async function getScreenshotDataWithAdbExecOut (adb) {
  let {stdout, stderr, code} = await exec(adb.executable.path,
                                    adb.executable.defaultArgs
                                      .concat(['exec-out', '/system/bin/screencap', '-p']),
                                    {encoding: 'binary', isBuffer: true});
  // if there is an error, throw
  if (code || stderr.length) {
    throw new Error(`Screenshot returned error, code: '${code}', stderr: '${stderr.toString()}'`);
  }
  // if we don't get anything at all, throw
  if (!stdout.length) {
    throw new Error('Screenshot returned no data');
  }

  return await jimp.read(stdout);
};

commands.getScreenshot = async function getScreenshot () {
  const apiLevel = await this.adb.getApiLevel();
  let image = null;
  if (apiLevel > 20) {
    try {
      // This screenshoting approach is way faster, since it requires less external commands
      // to be executed. Unfortunately, exec-out option is only supported by newer Android/SDK versions (5.0 and later)
      image = await this.getScreenshotDataWithAdbExecOut(this.adb);
    } catch (e) {
      log.info(`Cannot get screenshot data with 'adb exec-out' because of '${e.message}'. ` +
               `Defaulting to 'adb shell' call`);
    }
  }
  if (!image) {
    try {
      image = await this.getScreenshotDataWithAdbShell(this.adb, this.opts);
    } catch (e) {
      const err = `Cannot get screenshot data because of '${e.message}'. ` +
                  `Make sure the 'LayoutParams.FLAG_SECURE' is not set for ` +
                  `the current view`;
      log.errorAndThrow(err);
    }
  }
  if (apiLevel < 23) {
    // Android bug 8433742 - rotate screenshot if screen is rotated
    let screenOrientation = await this.adb.getScreenOrientation();
    try {
      image = await image.rotate(-90 * screenOrientation);
    } catch (err) {
      log.warn(`Could not rotate screenshot due to error: ${err}`);
    }
  }
  const getBuffer = B.promisify(image.getBuffer, {context: image});
  const imgBuffer = await getBuffer(jimp.MIME_PNG);
  return imgBuffer.toString('base64');
};

Object.assign(extensions, commands, helpers);
export { commands, helpers };
export default extensions;
