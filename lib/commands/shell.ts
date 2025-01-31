import {util} from '@appium/support';
import {errors} from 'appium/driver';
import _ from 'lodash';
import {exec} from 'teen_process';
import {ADB_SHELL_FEATURE} from '../utils';

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
    const err = /** @type {import('teen_process').ExecError} */ (e);
    throw this.log.errorWithException(
      `Cannot execute the '${command}' shell command. ` +
        `Original error: ${err.message}. ` +
        `StdOut: ${err.stdout}. StdErr: ${err.stderr}`,
    );
  }
}
