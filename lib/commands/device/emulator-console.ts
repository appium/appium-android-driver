import {errors} from 'appium/driver';
import type {AndroidDriver} from '../../driver';

const EMU_CONSOLE_FEATURE = 'emulator_console';

/**
 * Executes an emulator console command.
 *
 * @param command - The actual command to execute.
 * @param execTimeout - A timeout used to wait for a server reply to the given command in
 *                      milliseconds. 60000ms by default
 * @param connTimeout - Console connection timeout in milliseconds. 5000ms by default.
 * @param initTimeout - Telnet console initialization timeout in milliseconds (the time between the
 *                     connection happens and the command prompt is available)
 * @returns The command output
 * @throws {errors.InvalidArgumentError} If command is not provided
 * @see {@link https://developer.android.com/studio/run/emulator-console}
 */
export async function mobileExecEmuConsoleCommand(
  this: AndroidDriver,
  command: string | string[],
  execTimeout?: number,
  connTimeout?: number,
  initTimeout?: number,
): Promise<string> {
  this.assertFeatureEnabled(EMU_CONSOLE_FEATURE);

  if (!command) {
    throw new errors.InvalidArgumentError(`The 'command' argument is mandatory`);
  }

  return await this.adb.execEmuConsoleCommand(command, {
    execTimeout,
    connTimeout,
    initTimeout,
  });
}

