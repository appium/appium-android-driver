import {util} from '@appium/support';
import {errors} from 'appium/driver';
import _ from 'lodash';
import {exec} from 'teen_process';
import {ADB_SHELL_FEATURE} from '../utils';

/**
 * @this {import('../driver').AndroidDriver}
 * @param {import('./types').ShellOpts} [opts={}]
 * @returns {Promise<string | {stderr: string; stdout: string}>};
 */
export async function mobileShell(opts) {
  this.assertFeatureEnabled(ADB_SHELL_FEATURE);
  const {command, args = /** @type {string[]} */ ([]), timeout = 20000, includeStderr} = opts ?? {};

  if (!_.isString(command)) {
    throw new errors.InvalidArgumentError(`The 'command' argument is mandatory`);
  }

  const adbArgs = [...this.adb.executable.defaultArgs, 'shell', command, ..._.castArray(args)];
  this.log.debug(`Running '${this.adb.executable.path} ${util.quote(adbArgs)}'`);
  try {
    const {stdout, stderr} = await exec(this.adb.executable.path, adbArgs, {timeout});
    if (includeStderr) {
      return {
        stdout,
        stderr,
      };
    }
    return stdout;
  } catch (e) {
    const err = /** @type {import('teen_process').ExecError} */ (e);
    throw this.log.errorAndThrow(
      `Cannot execute the '${command}' shell command. ` +
        `Original error: ${err.message}. ` +
        `StdOut: ${err.stdout}. StdErr: ${err.stderr}`,
    );
  }
}

/**
 * @typedef {import('appium-adb').ADB} ADB
 */
