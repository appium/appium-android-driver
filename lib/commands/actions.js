import androidHelpers from '../android-helpers';
import temp from 'temp';
import { fs, mkdirp, util } from 'appium-support';
import AdmZip from 'adm-zip';
import path from 'path';
import log from '../logger';
import B from 'bluebird';
import jimp from 'jimp';

const swipeStepsPerSec = 28;
const dragStepsPerSec = 40;

let commands = {}, helpers = {}, extensions = {};

commands.keyevent = async function (keycode, metastate = null) {
  // TODO deprecate keyevent; currently wd only implements keyevent
  log.warn("keyevent will be deprecated use pressKeyCode");
  return await this.pressKeyCode(keycode, metastate);
};

commands.pressKeyCode = async function (keycode, metastate = null) {
  return await this.bootstrap.sendAction("pressKeyCode", {keycode, metastate});
};

commands.longPressKeyCode = async function (keycode, metastate = null) {
  return await this.bootstrap.sendAction("longPressKeyCode", {keycode, metastate});
};

commands.getOrientation = async function () {
  let orientation = await this.bootstrap.sendAction("orientation", {});
  return orientation.toUpperCase();
};

commands.setOrientation = async function (orientation) {
  orientation = orientation.toUpperCase();
  return await this.bootstrap.sendAction("orientation", {orientation});
};

commands.fakeFlick = async function (xSpeed, ySpeed) {
  return await this.bootstrap.sendAction('flick', {xSpeed, ySpeed});
};

commands.fakeFlickElement = async function (elementId, xoffset, yoffset, speed) {
  let params = {xoffset, yoffset, speed, elementId};
  return await this.bootstrap.sendAction('element:flick', params);
};

commands.swipe = async function (startX, startY, endX, endY, duration, touchCount, elId) {
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

commands.doSwipe = async function(swipeOpts) {
  if (util.hasValue(swipeOpts.elementId)) {
    return await this.bootstrap.sendAction("element:swipe", swipeOpts);
  } else {
    return await this.bootstrap.sendAction("swipe", swipeOpts);
  }
};

commands.pinchClose = async function (startX, startY, endX, endY, duration, percent, steps, elId) {
  let pinchOpts = {
    direction: 'in',
    elementId: elId,
    percent,
    steps
  };
  return await this.bootstrap.sendAction("element:pinch", pinchOpts);
};

commands.pinchOpen = async function (startX, startY, endX, endY, duration, percent, steps, elId) {
  let pinchOpts = {direction: 'out', elementId: elId, percent, steps};
  return await this.bootstrap.sendAction("element:pinch", pinchOpts);
};

commands.flick = async function (element, xSpeed, ySpeed, xOffset, yOffset, speed) {
  if (element) {
    await this.fakeFlickElement(element, xOffset, yOffset, speed);
  } else {
    await this.fakeFlick(xSpeed, ySpeed);
  }
};

commands.drag = async function (startX, startY, endX, endY, duration, touchCount, elementId, destElId) {
  let dragOpts = {
    elementId, destElId, startX, startY, endX, endY,
    steps: Math.round(duration * dragStepsPerSec)
  };
  return await this.doDrag(dragOpts);

};

commands.doDrag = async function (dragOpts) {
  if (util.hasValue(dragOpts.elementId)) {
    return await this.bootstrap.sendAction("element:drag", dragOpts);
  } else {
    return await this.bootstrap.sendAction("drag", dragOpts);
  }
};

commands.lock = async function () {
  return await this.adb.lock();
};

commands.isLocked = async function () {
  return await this.adb.isScreenLocked();
};

commands.unlock = async function (unlockCapabilities) {
  return await androidHelpers.unlock(this, this.adb, unlockCapabilities);
};

commands.openNotifications = async function () {
  return await this.bootstrap.sendAction("openNotification");
};

commands.setLocation = async function (latitude, longitude) {
  return await this.adb.sendTelnetCommand(`geo fix ${longitude} ${latitude}`);
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
      log.debug('Converting in-memory zip file to base64 encoded string');
      resolve(buffer.toString('base64'));
    }, (err) => {
      reject(err);
    });
  });
};

commands.fingerprint = async function (fingerprintId) {
  await this.adb.fingerprint(fingerprintId);
};

commands.getScreenshot = async function () {
  let localFile = temp.path({prefix: 'appium', suffix: '.png'});
  let pngDir = this.opts.androidScreenshotPath || '/data/local/tmp/';
  const png = path.posix.resolve(pngDir, 'screenshot.png');
  let cmd =  ['/system/bin/rm', `${png};`, '/system/bin/screencap', '-p', png];
  await this.adb.shell(cmd);
  if (await fs.exists(localFile)) {
    await fs.unlink(localFile);
  }
  await this.adb.pull(png, localFile);
  let image = await jimp.read(localFile);
  if (await this.adb.getApiLevel() < 23) {
    // Android bug 8433742 - rotate screenshot if screen is rotated
    let screenOrientation = await this.adb.getScreenOrientation();
    try {
      image = await image.rotate(-90 * screenOrientation);
    } catch (err) {
      log.warn(`Could not rotate screenshot due to error: ${err}`);
    }
  }
  let b64data = (await B.promisify(image.getBuffer).call(image, jimp.MIME_PNG))
                .toString('base64');
  await fs.unlink(localFile);
  return b64data;
};


Object.assign(extensions, commands, helpers);
export { commands, helpers };
export default extensions;
