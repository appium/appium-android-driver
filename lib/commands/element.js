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
/*
commands.elementEnabled = async function (elementId) {
  let el = this.getElement(elementId);
  return el.isEnabled();
};

commands.elementSelected = async function (elementId) {
  let el = this.getElement(elementId);
  return el.isSelected();
};
*/
commands.setValue = async function (keys, elementId) {
  let text = keys;
  if (keys instanceof Array) {
    text = keys.join("");
  }

  let p = {
    elementId: elementId,
    text: text,
    replace: false,
    unicodeKeyboard: this.opts.unicodeKeyboard
  };

  return await this.bootstrap.sendAction("element:setText", p);
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
  return await this.bootstrap.sendAction("click", {x: x, y: y});
};

/*
commands.equalsElement = function (el1Id, el2Id) {
  let el1 = this.getElement(el1Id);
  let el2 = this.getElement(el2Id);
  return el1.equals(el2);
};

commands.getLocationInView = commands.getLocation;

commands.getCssProperty = async function (prop, elementId) {
  this.assertWebviewContext();
  let el = this.getElement(elementId);
  return el.getCss(prop);
};
*/

Object.assign(extensions, commands, helpers);
export { commands, helpers };
export default extensions;
