import {errors} from 'appium/driver';

/**
 * @this {import('../driver').AndroidDriver}
 * @returns {Promise<boolean>}
 */
export async function isIMEActivated() {
  // eslint-disable-line require-await
  // IME is always activated on Android devices
  return true;
}

/**
 * @this {import('../driver').AndroidDriver}
 * @returns {Promise<string[]>}
 */
export async function availableIMEEngines() {
  this.log.debug('Retrieving available IMEs');
  let engines = await this.adb.availableIMEs();
  this.log.debug(`Engines: ${JSON.stringify(engines)}`);
  return engines;
}

/**
 * @this {import('../driver').AndroidDriver}
 * @returns {Promise<string>}
 */
export async function getActiveIMEEngine() {
  this.log.debug('Retrieving current default IME');
  return String(await this.adb.defaultIME());
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {string} imeId
 * @returns {Promise<void>}
 */
export async function activateIMEEngine(imeId) {
  this.log.debug(`Attempting to activate IME ${imeId}`);
  let availableEngines = await this.adb.availableIMEs();
  if (availableEngines.indexOf(imeId) === -1) {
    this.log.debug('IME not found, failing');
    throw new errors.IMENotAvailableError();
  }
  this.log.debug('Found installed IME, attempting to activate');
  await this.adb.enableIME(imeId);
  await this.adb.setIME(imeId);
}

/**
 * @this {import('../driver').AndroidDriver}
 * @returns {Promise<void>}
 */
export async function deactivateIMEEngine() {
  let currentEngine = await this.getActiveIMEEngine();
  // XXX: this allowed 'null' to be passed into `adb.shell`
  if (currentEngine) {
    this.log.debug(`Attempting to deactivate ${currentEngine}`);
    await this.adb.disableIME(currentEngine);
  }
}

/**
 * @typedef {import('appium-adb').ADB} ADB
 */
