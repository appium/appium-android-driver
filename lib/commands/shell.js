// @ts-check

import {util} from '@appium/support';
import {errors} from 'appium/driver';
import _ from 'lodash';
import {exec} from 'teen_process';
import {ADB_SHELL_FEATURE} from '../utils';
import {mixin} from './mixins';

/**
 * @type {import('./mixins').ShellMixin & ThisType<import('../driver').AndroidDriver>}
 * @satisfies {import('@appium/types').ExternalDriver}
 */
const ShellMixin = {
  async mobileShell(opts) {
    this.ensureFeatureEnabled(ADB_SHELL_FEATURE);
    const {
      command,
      args = /** @type {string[]} */ ([]),
      timeout = 20000,
      includeStderr,
    } = opts ?? {};

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
      this.log.errorAndThrow(
        `Cannot execute the '${command}' shell command. ` +
          `Original error: ${err.message}. ` +
          `StdOut: ${err.stdout}. StdErr: ${err.stderr}`
      );
      throw new Error(); // unreachable; for TS
    }
  },
};

mixin(ShellMixin);

export default ShellMixin;

/**
 * @typedef {import('appium-adb').ADB} ADB
 */
