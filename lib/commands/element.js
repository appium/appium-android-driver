import androidHelpers from '../android-helpers';
//import _ from 'lodash';
//import { errors } from 'mobile-json-wire-protocol';
//import log from '../logger';

let commands = {}, helpers = {}, extensions = {};

commands.getAttribute = async function (attribute, elementId) {
  let p = {attribute, elementId};
  return await this.bootstrap.sendAction("element:getAttribute", p);
};

commands.getName = async function (elementId) {
  return await this.getAttribute("className", elementId);
};

commands.elementDisplayed = async function (elementId) {
  return await this.getAttribute("displayed", elementId) === 'true';
};

commands.elementEnabled = async function (elementId) {
  return await this.getAttribute("enabled", elementId) === 'true';
};

commands.elementSelected = async function (elementId) {
  return await this.getAttribute("selected", elementId) === 'true';
};

helpers.setElementValue = async function (keys, elementId, replace = false) {
  let text = keys;
  if (keys instanceof Array) {
    text = keys.join("");
  }

  let params = {
    elementId,
    text,
    replace,
    unicodeKeyboard: this.opts.unicodeKeyboard
  };

  return await this.bootstrap.sendAction("element:setText", params);
};

commands.setValue = async function (keys, elementId) {
  return await this.setElementValue(keys, elementId, false);
};

commands.replaceValue = async function (keys, elementId) {
  return await this.setElementValue(keys, elementId, true);
};

commands.setValueImmediate = async function (keys, elementId) {
  let text = keys;
  if (keys instanceof Array) {
    text = keys.join("");
  }

  // first, make sure we are focused on the element
  await this.click(elementId);

  // then send through adb
  await this.adb.inputText(text);
};

commands.getText = async function (elementId) {
  return await this.bootstrap.sendAction("element:getText", {elementId});
};

commands.clear = async function (elementId) {
  return await this.bootstrap.sendAction("element:clear", {elementId});
};

commands.click = async function (elementId) {
  return await this.bootstrap.sendAction("element:click", {elementId});
};

commands.getLocation = async function (elementId) {
  return await this.bootstrap.sendAction("element:getLocation", {elementId});
};

commands.getLocationInView = async function (elementId) {
  return await this.getLocation(elementId);
};

commands.getSize = async function (elementId) {
  return await this.bootstrap.sendAction("element:getSize", {elementId});
};

commands.touchLongClick = async function (elementId, x, y, duration) {
  let params = {elementId, x, y, duration};
  androidHelpers.removeNullProperties(params);
  return await this.bootstrap.sendAction("element:touchLongClick", params);
};

commands.touchDown = async function (elementId, x, y) {
  let params = {elementId, x, y};
  androidHelpers.removeNullProperties(params);
  return await this.bootstrap.sendAction("element:touchDown", params);
};

commands.touchUp = async function (elementId, x, y) {
  let params = {elementId, x, y};
  androidHelpers.removeNullProperties(params);
  return await this.bootstrap.sendAction("element:touchUp", params);
};

commands.touchMove = async function (elementId, x, y) {
  let params = {elementId, x, y};
  androidHelpers.removeNullProperties(params);
  return await this.bootstrap.sendAction("element:touchMove", params);
};

commands.complexTap = async function (tapCount, touchCount, duration, x, y) {
  return await this.bootstrap.sendAction("click", {x, y});
};

commands.tap = async function (elementId, x = 0, y = 0, count = 1) {
  for (let i = 0; i < count; i++) {
    if (elementId) {
      // we are either tapping on the default location of the element
      // or an offset from the top left corner
      if (x !== 0 || y !== 0) {
        await this.bootstrap.sendAction("element:click", {elementId, x, y});
      } else {
        await this.bootstrap.sendAction("element:click", {elementId});
      }
    } else {
      await this.bootstrap.sendAction("click", {x, y});
    }
  }
};

Object.assign(extensions, commands, helpers);
export { commands, helpers };
export default extensions;
