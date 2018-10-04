import { errors } from 'appium-base-driver';

let commands = {}, helpers = {}, extensions = {};

commands.getAlertText = async function () { // eslint-disable-line require-await
  throw new errors.NotYetImplementedError();
};

commands.setAlertText = async function () { // eslint-disable-line require-await
  throw new errors.NotYetImplementedError();
};

commands.postAcceptAlert = async function () { // eslint-disable-line require-await
  throw new errors.NotYetImplementedError();
};

commands.postDismissAlert = async function () { // eslint-disable-line require-await
  throw new errors.NotYetImplementedError();
};

Object.assign(extensions, commands, helpers);
export { commands, helpers };
export default extensions;
