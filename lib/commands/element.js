//import _ from 'lodash';
//import { errors } from 'mobile-json-wire-protocol';
//import log from '../logger';

let commands = {}, helpers = {}, extensions = {};

commands.getAttribute = function (attribute, elementId) {
  let p = {attribute, elementId};
  return this.bootstrap.sendAction("element:getAttribute", p);
};

commands.getName = async function (elementId) {
  return this.getAttribute("className", elementId);
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

  return this.bootstrap.sendAction("element:setText", p);
};

commands.getText = async function (elementId) {
  return this.bootstrap.sendAction("element:getText", {elementId});
};

commands.clear = async function (elementId) {
  return this.bootstrap.sendAction("element:clear", {elementId});
};

commands.click = async function (elementId) {
  return this.bootstrap.sendAction("element:click", {elementId});
};

commands.getLocation = function (elementId) {
  return this.bootstrap.sendAction("element:getLocation", {elementId});
};

commands.getSize = function (elementId) {
  return this.bootstrap.sendAction("element:getSize", {elementId});
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
