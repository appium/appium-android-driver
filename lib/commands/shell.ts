import {util} from '@appium/support';
import {errors} from 'appium/driver';
import _ from 'lodash';
import {exec} from 'teen_process';
import type {ExecError} from 'teen_process';
import {ADB_SHELL_FEATURE} from '../utils';

/**
 * Executes a shell command on the device via ADB.
 *
 * This method runs an arbitrary shell command on the Android device and returns
 * the output. The command is executed using `adb shell` with the specified
 * command and arguments.
 *
 * Requirements:
 * - The adb_shell feature must be enabled
 *
 * @param command The shell command to execute (e.g., 'pm', 'dumpsys', 'getprop').
 * @param args Optional array of command arguments.
 * @param timeout The maximum time in milliseconds to wait for command execution.
 * Defaults to 20000ms (20 seconds).
 * @param includeStderr If `true`, returns both stdout and stderr in an object.
 * If `false` or undefined, returns only stdout as a string.
 * @returns If `includeStderr` is `true`, returns `{ stdout: string, stderr: string }`.
 * Otherwise, returns the command output as a string.
 * @throws {errors.InvalidArgumentError} If `command` is not a string.
 * @throws {Error} If the command execution fails or times out.
 */
export async function mobileShell<T extends boolean>(
  command: string,
  args: string[] = [],
  timeout: number = 20000,
  includeStderr?: T,
): Promise<T extends true ? { stdout: string; stderr: string; } : string> {
  this.assertFeatureEnabled(ADB_SHELL_FEATURE);

  if (!_.isString(command)) {
    throw new errors.InvalidArgumentError(`The 'command' argument is mandatory`);
  }

  const adbArgs = [...this.adb.executable.defaultArgs, 'shell', command, ..._.castArray(args)];
  this.log.debug(`Running '${this.adb.executable.path} ${util.quote(adbArgs)}'`);
  try {
    const {stdout, stderr} = await exec(this.adb.executable.path, adbArgs, {timeout});
    if (includeStderr) {
      // @ts-ignore We know what we are doing here
      return {
        stdout,
        stderr,
      };
    }
    // @ts-ignore We know what we are doing here
    return stdout;
  } catch (e) {
    const err = e as ExecError;
    throw this.log.errorWithException(
      `Cannot execute the '${command}' shell command. ` +
        `Original error: ${err.message}. ` +
        `StdOut: ${err.stdout}. StdErr: ${err.stderr}`,
    );
  }
}
