import androidHelpers from '../android-helpers';
import { retryInterval } from 'asyncbox';
import logger from '../logger';
import { util } from 'appium-support';


let commands = {}, helpers = {}, extensions = {};

commands.getAttribute = async function getAttribute (attribute, elementId) {
  let p = {attribute, elementId};
  return await this.bootstrap.sendAction('element:getAttribute', p);
};

commands.getName = async function getName (elementId) {
  return await this.getAttribute('className', elementId);
};

commands.elementDisplayed = async function elementDisplayed (elementId) {
  return await this.getAttribute('displayed', elementId) === 'true';
};

commands.elementEnabled = async function elementEnabled (elementId) {
  return await this.getAttribute('enabled', elementId) === 'true';
};

commands.elementSelected = async function elementSelected (elementId) {
  return await this.getAttribute('selected', elementId) === 'true';
};

helpers.setElementValue = async function setElementValue (keys, elementId, replace = false) {
  let text = keys;
  if (keys instanceof Array) {
    text = keys.join('');
  }

  let params = {
    elementId,
    text,
    replace,
    unicodeKeyboard: this.opts.unicodeKeyboard
  };

  return await this.doSetElementValue(params);
};

/**
 * Reason for isolating doSetElementValue from setElementValue is for reusing setElementValue
 * across android-drivers (like appium-uiautomator2-driver) and to avoid code duplication.
 * Other android-drivers (like appium-uiautomator2-driver) need to override doSetElementValue
 * to facilitate setElementValue.
 */
helpers.doSetElementValue = async function doSetElementValue (params) {
  return await this.bootstrap.sendAction('element:setText', params);
};

commands.setValue = async function setValue (keys, elementId) {
  return await this.setElementValue(keys, elementId, false);
};

commands.replaceValue = async function replaceValue (keys, elementId) {
  return await this.setElementValue(keys, elementId, true);
};

commands.setValueImmediate = async function setValueImmediate (keys, elementId) {
  let text = keys;
  if (keys instanceof Array) {
    text = keys.join('');
  }

  // first, make sure we are focused on the element
  await this.click(elementId);

  // then send through adb
  await this.adb.inputText(text);
};

commands.getText = async function getText (elementId) {
  return await this.bootstrap.sendAction('element:getText', {elementId});
};

commands.clear = async function clear (elementId) {
  let text = (await this.getText(elementId)) || '';
  let length = text.length;
  if (length === 0) {
    // if length is zero there are two possibilities:
    //   1. there is nothing in the text field
    //   2. it is a password field
    // since there is little overhead to the adb call, delete 100 elements
    // if we get zero, just in case it is #2
    length = 100;
  }
  await this.click(elementId);
  logger.debug(`Sending up to ${length} clear characters to device`);
  return await retryInterval(5, 500, async () => {
    let remainingLength = length;
    while (remainingLength > 0) {
      let lengthToSend = remainingLength < 50 ? remainingLength : 50;
      logger.debug(`Sending ${lengthToSend} clear characters to device`);
      await this.adb.clearTextField(lengthToSend);
      remainingLength -= lengthToSend;
    }
  });
};

commands.click = async function click (elementId) {
  return await this.bootstrap.sendAction('element:click', {elementId});
};

commands.getLocation = async function getLocation (elementId) {
  return await this.bootstrap.sendAction('element:getLocation', {elementId});
};

commands.getLocationInView = async function getLocationInView (elementId) {
  return await this.getLocation(elementId);
};

commands.getSize = async function getSize (elementId) {
  return await this.bootstrap.sendAction('element:getSize', {elementId});
};

commands.getElementRect = async function getElementRect (elementId) {
  return await this.bootstrap.sendAction('element:getRect', {elementId});
};

commands.touchLongClick = async function touchLongClick (elementId, x, y, duration) {
  let params = {elementId, x, y, duration};
  androidHelpers.removeNullProperties(params);
  return await this.bootstrap.sendAction('element:touchLongClick', params);
};

commands.touchDown = async function touchDown (elementId, x, y) {
  let params = {elementId, x, y};
  androidHelpers.removeNullProperties(params);
  return await this.bootstrap.sendAction('element:touchDown', params);
};

commands.touchUp = async function touchUp (elementId, x, y) {
  let params = {elementId, x, y};
  androidHelpers.removeNullProperties(params);
  return await this.bootstrap.sendAction('element:touchUp', params);
};

commands.touchMove = async function touchMove (elementId, x, y) {
  let params = {elementId, x, y};
  androidHelpers.removeNullProperties(params);
  return await this.bootstrap.sendAction('element:touchMove', params);
};

commands.complexTap = async function complexTap (tapCount, touchCount, duration, x, y) {
  return await this.bootstrap.sendAction('click', {x, y});
};

commands.tap = async function (elementId = null, x = null, y = null, count = 1) {
  if (!util.hasValue(elementId) && !util.hasValue(x) && !util.hasValue(y)) {
    throw new Error(`Either element to tap or both absolute coordinates should be defined`);
  }
  for (let i = 0; i < count; i++) {
    if (util.hasValue(elementId)) {
      // FIXME: bootstrap ignores relative coordinates
      await this.bootstrap.sendAction('element:click', {elementId, x, y});
    } else {
      await this.bootstrap.sendAction('click', {x, y});
    }
  }
};

Object.assign(extensions, commands, helpers);
export { commands, helpers };
export default extensions;
