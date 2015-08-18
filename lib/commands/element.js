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
  return this.getAttribute("displayed", elementId);
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

commands.setValue = async function (keys, elementId) {
  let value = keys;
  if (keys instanceof Array) {
    value = keys.join("");
  }
  let el = this.getElement(elementId);
  if (el.type !== "MockInputField") {
    throw new errors.InvalidElementStateError();
  }
  el.setAttr('value', value);
};
*/
commands.getText = async function (elementId) {
  return this.bootstrap.sendAction("element:getText", {elementId});
};
/*
commands.clear = async function (elementId) {
  await this.setValue('', elementId);
};

commands.click = async function (elementId) {
  this.assertNoAlert();
  let el = this.getElement(elementId);
  if (!el.isVisible()) {
    throw new errors.InvalidElementStateError();
  }
  el.click();
  this.focusedElId = elementId;
};

commands.getAttribute = async function (attr, elementId) {
  let el = this.getElement(elementId);
  return el.getAttr(attr);
};

commands.getLocation = function (elementId) {
  let el = this.getElement(elementId);
  return el.getLocation();
};

commands.getSize = function (elementId) {
  let el = this.getElement(elementId);
  return el.getSize();
};

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
