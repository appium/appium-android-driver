import {errors} from 'appium/driver';
import type {AndroidDriver} from '../driver';
import {SET_STYLUS_HANDWRITING_FEATURE} from '../utils';

/**
 * Checks if an IME (Input Method Editor) is activated.
 *
 * @returns Promise that resolves to `true` (IME is always activated on Android devices).
 */
export async function isIMEActivated(this: AndroidDriver): Promise<boolean> {
  // IME is always activated on Android devices
  return true;
}

/**
 * Gets the list of available IME engines.
 *
 * @returns Promise that resolves to an array of IME engine identifiers.
 */
export async function availableIMEEngines(this: AndroidDriver): Promise<string[]> {
  this.log.debug('Retrieving available IMEs');
  const engines = await this.adb.availableIMEs();
  this.log.debug(`Engines: ${JSON.stringify(engines)}`);
  return engines;
}

/**
 * Gets the currently active IME engine.
 *
 * @returns Promise that resolves to the active IME engine identifier.
 */
export async function getActiveIMEEngine(this: AndroidDriver): Promise<string> {
  this.log.debug('Retrieving current default IME');
  return String(await this.adb.defaultIME());
}

/**
 * Activates an IME engine.
 *
 * @param imeId The IME engine identifier to activate.
 * @returns Promise that resolves when the IME is activated.
 * @throws {errors.IMENotAvailableError} If the IME is not available.
 */
export async function activateIMEEngine(this: AndroidDriver, imeId: string): Promise<void> {
  this.log.debug(`Attempting to activate IME ${imeId}`);
  const availableEngines = await this.adb.availableIMEs();
  if (availableEngines.indexOf(imeId) === -1) {
    this.log.debug('IME not found, failing');
    throw new errors.IMENotAvailableError();
  }
  this.log.debug('Found installed IME, attempting to activate');
  await this.adb.enableIME(imeId);
  await this.adb.setIME(imeId);
}

/**
 * Deactivates the currently active IME engine.
 *
 * @returns Promise that resolves when the IME is deactivated.
 */
export async function deactivateIMEEngine(this: AndroidDriver): Promise<void> {
  const currentEngine = await this.getActiveIMEEngine();
  // XXX: this allowed 'null' to be passed into `adb.shell`
  if (currentEngine) {
    this.log.debug(`Attempting to deactivate ${currentEngine}`);
    await this.adb.disableIME(currentEngine);
  }
}

/**
 * Enables or disables stylus handwriting input method.
 * The default value depends on the device.
 * It requires set_stylus_handwriting secure setting to be supported by the device
 * because some environments (e.g. cloud vendors) might not allow to change this setting.
 * @param enabled Whether to enable or disable stylus handwriting input method.
 */
export async function setStylusHandwriting(this: AndroidDriver, enabled: boolean): Promise<void> {
  this.assertFeatureEnabled(SET_STYLUS_HANDWRITING_FEATURE);
  await this.adb.shell([
    'settings',
    'put',
    'secure',
    'stylus_handwriting_enabled',
    enabled ? '1' : '0',
  ]);
}
