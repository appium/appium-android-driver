//import { errors } from 'mobile-json-wire-protocol';

let commands = {}, helpers = {}, extensions = {};

/*
helpers.assertNoAlert = function () {
  if (this.appModel.hasAlert()) {
    throw new errors.UnexpectedAlertOpenError();
  }
};

helpers.assertAlert = function () {
  if (!this.appModel.hasAlert()) {
    throw new errors.NoAlertOpenError();
  }
};

commands.getAlertText = async function () {
  this.assertAlert();
  return this.appModel.alertText();
};

commands.setAlertText = async function (text) {
  this.assertAlert();
  try {
    this.appModel.setAlertText(text);
  } catch (e) {
    throw new errors.InvalidElementStateError();
  }
};

commands.postAcceptAlert = async function () {
  this.assertAlert();
  this.appModel.handleAlert();
};

commands.postDismissAlert = commands.postAcceptAlert;
*/

Object.assign(extensions, commands, helpers);
export { commands, helpers };
export default extensions;
