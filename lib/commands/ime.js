// @ts-check

import {mixin} from './mixins';
import {errors} from 'appium/driver';

/**
 * @type {import('./mixins').IMEMixin & ThisType<import('../driver').AndroidDriver>}
 * @satisfies {import('@appium/types').ExternalDriver}
 */
const IMEMixin = {
  async isIMEActivated() {
    // eslint-disable-line require-await
    // IME is always activated on Android devices
    return true;
  },

  async availableIMEEngines() {
    this.log.debug('Retrieving available IMEs');
    let engines = await this.adb.availableIMEs();
    this.log.debug(`Engines: ${JSON.stringify(engines)}`);
    return engines;
  },

  async getActiveIMEEngine() {
    this.log.debug('Retrieving current default IME');
    return String(await this.adb.defaultIME());
  },

  async activateIMEEngine(imeId) {
    this.log.debug(`Attempting to activate IME ${imeId}`);
    let availableEngines = await this.adb.availableIMEs();
    if (availableEngines.indexOf(imeId) === -1) {
      this.log.debug('IME not found, failing');
      throw new errors.IMENotAvailableError();
    }
    this.log.debug('Found installed IME, attempting to activate');
    await this.adb.enableIME(imeId);
    await this.adb.setIME(imeId);
  },

  async deactivateIMEEngine() {
    let currentEngine = await this.getActiveIMEEngine();
    // XXX: this allowed 'null' to be passed into `adb.shell`
    if (currentEngine) {
      this.log.debug(`Attempting to deactivate ${currentEngine}`);
      await this.adb.disableIME(currentEngine);
    }
  },
};

export default IMEMixin;

mixin(IMEMixin);

/**
 * @typedef {import('appium-adb').ADB} ADB
 */
