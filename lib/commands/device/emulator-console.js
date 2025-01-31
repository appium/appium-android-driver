import {errors} from 'appium/driver';

const EMU_CONSOLE_FEATURE = 'emulator_console';

/**
 * @this {import('../../driver').AndroidDriver}
 * @returns {Promise<string>}
 * @param {string | string[]} command The actual command to execute.
 * @see {@link https://developer.android.com/studio/run/emulator-console}
 * @param {number} [execTimeout] A timeout used to wait for a server reply to the given command in
 * milliseconds. 60000ms by default
 * @param {number} [connTimeout] Console connection timeout in milliseconds.
 * 5000ms by default.
 * @param {number} [initTimeout] Telnet console initialization timeout in milliseconds (the time between the
 * connection happens and the command prompt is available)
 */
export async function mobileExecEmuConsoleCommand(command, execTimeout, connTimeout, initTimeout) {
  this.assertFeatureEnabled(EMU_CONSOLE_FEATURE);

  if (!command) {
    throw new errors.InvalidArgumentError(`The 'command' argument is mandatory`);
  }

  return await /** @type {import('appium-adb').ADB} */ (this.adb).execEmuConsoleCommand(command, {
    execTimeout,
    connTimeout,
    initTimeout,
  });
}
