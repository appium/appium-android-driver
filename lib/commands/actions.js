import androidHelpers from '../android-helpers';
import temp from 'temp';
import { fs, mkdirp } from 'appium-support';
import AdmZip from 'adm-zip';
import logger from '../logger';
import path from 'path';

const swipeStepsPerSec = 28,
      dragStepsPerSec = 40;

let commands = {}, helpers = {}, extensions = {};

commands.pressKeyCode = function (keycode, metastate) {
  return this.bootstrap.sendAction("pressKeyCode", {keycode, metastate});
};

commands.longPressKeyCode = function (keycode, metastate) {
  return this.bootstrap.sendAction("longPressKeyCode", {keycode, metastate});
};

commands.getOrientation = function () {
  return this.bootstrap.sendAction("orientation", {});
};

commands.setOrientation = function (orientation) {
  return this.bootstrap.sendAction("orientation", {orientation});
};

commands.fakeFlick = function (xSpeed, ySpeed) {
  return this.bootstrap.sendAction("flick", {xSpeed, ySpeed});
};

commands.fakeFlickElement = function (elementId, xoffset, yoffset, speed) {
  let param = {xoffset, yoffset, speed, elementId};
  return this.bootstrap.sendAction("element:flick", param);
};

commands.swipe = function (startX, startY, endX, endY, duration, touchCount, elId) {
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
  if (typeof elId !== "undefined" && elId !== null) {
    swipeOpts.elementId = elId;
    return this.bootstrap.sendAction("element:swipe", swipeOpts);
  } else {
    return this.bootstrap.sendAction("swipe", swipeOpts);
  }
};

commands.pinchClose = function (startX, startY, endX, endY, duration, percent, steps, elId) {
  let pinchOpts = {
    direction: 'in',
    elementId: elId,
    percent,
    steps
  };
  return this.bootstrap.sendAction("element:pinch", pinchOpts);
};

commands.pinchOpen = function (startX, startY, endX, endY, duration, percent, steps, elId) {
  let pinchOpts = {direction: 'out', elementId: elId, percent, steps};
  return this.bootstrap.sendAction("element:pinch", pinchOpts);
};

commands.flick = function (startX, startY, endX, endY, touchCount, elId) {
  if (startX === 'null') {
    startX = 0.5;
  }
  if (startY === 'null') {
    startY = 0.5;
  }
  let swipeOpts = {startX, startY, endX, endY, steps: Math.round(0.2 * swipeStepsPerSec)};
  if (elId !== null) {
    swipeOpts.elementId = elId;
    return this.bootstrap.sendAction("element:swipe", swipeOpts);
  } else {
    return this.bootstrap.sendAction("swipe", swipeOpts);
  }
};

commands.drag = function (startX, startY, endX, endY, duration, touchCount, elementId, destElId) {
  let dragOpts = {elementId, destElId, startX, startY, endX, endY,
                  steps: Math.round(duration * dragStepsPerSec)};
  if (elementId) {
    return this.bootstrap.sendAction("element:drag", dragOpts);
  } else {
    return this.bootstrap.sendAction("drag", dragOpts);
  }
};

commands.lock = function () {
  return this.adb.lock();
};

commands.isLocked = function () {
  return this.adb.isScreenLocked();
};

commands.unlock = function () {
  return androidHelpers.unlock();
};

commands.openNotifications = function () {
  return this.bootstrap.sendAction("openNotification");
};

commands.setLocation = function (latitude, longitude) {
  return this.adb.sendTelnetCommand(`geo fix ${longitude} ${latitude}`);
};

commands.pullFile = async function (remotePath) {
  let localFile = temp.path({prefix: 'appium', suffix: '.tmp'});
  await this.adb.pull(remotePath, localFile);
  let data = await fs.readFile(localFile);
  let b64data = new Buffer(data).toString('base64');
  if (await fs.exists(localFile)) {
    await fs.unlink(localFile);
  }
  return b64data;
};

commands.pushFile = async function (remotePath, base64Data) {
  let localFile = temp.path({prefix: 'appium', suffix: '.tmp'});
  await mkdirp(path.dirname(localFile));
  let content = new Buffer(base64Data, 'base64');
  let fd = await fs.open(localFile, 'w');
  await fs.write(fd, content, 0, content.length, 0);
  await fs.close(fd);

  // adb push creates folders and overwrites existing files.
  await this.adb.push(localFile, remotePath);
  if (await fs.exists(localFile)) {
    await fs.unlink(localFile);
  }
};

commands.pullFolder = async function (remotePath) {
  let localFolder = temp.path({prefix: 'appium'});
  await this.adb.pull(remotePath, localFolder);
  // TODO: find a better alternative to the AdmZip module
  let zip = new AdmZip();
  zip.addLocalFolder(localFolder);
  return new Promise((resolve, reject) => {
    zip.toBuffer((buffer) => {
      logger.debug("Converting in-memory zip file to base64 encoded string");
      resolve(buffer.toString('base64'));
    }, (err) => {
      reject(err);
    });
  });
};

commands.getScreenshot = async function () {
  let localFile = temp.path({prefix: 'appium', suffix: '.png'});
  const png = "/data/local/tmp/screenshot.png";
  let cmd =  ['/system/bin/rm', `${png};`, '/system/bin/screencap', '-p', png];
  await this.adb.shell(cmd);
  if (await fs.exists(localFile)) {
    await fs.unlink(localFile);
  }
  await this.adb.pull(png, localFile);
  let data = await fs.readFile(localFile);
  let b64data = new Buffer(data).toString('base64');
  await fs.unlink(localFile);
  return b64data;
};

Object.assign(extensions, commands, helpers);
export { commands, helpers };
export default extensions;
