import {errors} from 'appium/driver';

const EMU_CONSOLE_FEATURE = 'emulator_console';

/**
 * @this {import('../../driver').AndroidDriver}
 * @param {import('../types').ExecOptions} opts
 * @returns {Promise<string>}
 */
export async function mobileExecEmuConsoleCommand(opts) {
  this.assertFeatureEnabled(EMU_CONSOLE_FEATURE);

  const {command, execTimeout, connTimeout, initTimeout} = opts;

  if (!command) {
    throw new errors.InvalidArgumentError(`The 'command' argument is mandatory`);
  }

  return await /** @type {import('appium-adb').ADB} */ (this.adb).execEmuConsoleCommand(command, {
    execTimeout,
    connTimeout,
    initTimeout,
  });
}
