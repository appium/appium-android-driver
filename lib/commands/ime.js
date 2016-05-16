import log from '../logger';
import { errors } from 'appium-base-driver';

let commands = {}, helpers = {}, extensions = {};

commands.isIMEActivated = async function () {
  // IME is always activated on Android devices
  return true;
};

commands.availableIMEEngines = async function () {
  log.debug("Retrieving available IMEs");
  let engines = await this.adb.availableIMEs();
  log.debug(`Engines: ${JSON.stringify(engines)}`);
  return engines;
};

commands.getActiveIMEEngine = async function () {
  log.debug("Retrieving current default IME");
  return await this.adb.defaultIME();
};

commands.activateIMEEngine = async function (imeId) {
  log.debug(`Attempting to activate IME ${imeId}`);
  let availableEngines = await this.adb.availableIMEs();
  if (availableEngines.indexOf(imeId) === -1) {
    log.debug("IME not found, failing");
    throw new errors.IMENotAvailableError();
  }
  log.debug("Found installed IME, attempting to activate");
  await this.adb.enableIME(imeId);
  await this.adb.setIME(imeId);
};

commands.deactivateIMEEngine = async function () {
  let currentEngine = await this.getActiveIMEEngine();
  log.debug(`Attempting to deactivate ${currentEngine}`);
  await this.adb.disableIME(currentEngine);
};

Object.assign(extensions, commands, helpers);
export { commands, helpers };
export default extensions;
