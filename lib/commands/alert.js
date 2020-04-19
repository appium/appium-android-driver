/* eslint-disable require-await */
import { errors } from 'appium-base-driver';

let commands = {}, helpers = {}, extensions = {};

commands.getAlertText = async function getAlertText () {
  throw new errors.NotYetImplementedError();
};

commands.setAlertText = async function setAlertText () {
  throw new errors.NotYetImplementedError();
};

commands.postAcceptAlert = async function postAcceptAlert () {
  throw new errors.NotYetImplementedError();
};

commands.postDismissAlert = async function postDismissAlert () {
  throw new errors.NotYetImplementedError();
};

Object.assign(extensions, commands, helpers);
export { commands, helpers };
export default extensions;
