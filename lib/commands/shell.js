import _ from 'lodash';
import { exec } from 'teen_process';
import { util } from '@appium/support';
import { errors } from 'appium/driver';
import { ADB_SHELL_FEATURE } from '../utils';

const commands = {};

commands.mobileShell = async function mobileShell (opts = {}) {
  this.ensureFeatureEnabled(ADB_SHELL_FEATURE);

  const {
    command,
    args = [],
    timeout = 20000,
    includeStderr,
  } = opts;

  if (!_.isString(command)) {
    throw new errors.InvalidArgumentError(`The 'command' argument is mandatory`);
  }

  const adbArgs = [
    ...this.adb.executable.defaultArgs,
    'shell',
    command,
    ...(_.isArray(args) ? args : [args])
  ];
  this.log.debug(`Running '${this.adb.executable.path} ${util.quote(adbArgs)}'`);
  try {
    const {stdout, stderr} = await exec(this.adb.executable.path, adbArgs, {timeout});
    if (includeStderr) {
      return {
        stdout,
        stderr
      };
    }
    return stdout;
  } catch (err) {
    this.log.errorAndThrow(`Cannot execute the '${command}' shell command. ` +
      `Original error: ${err.message}. ` +
      `StdOut: ${err.stdout}. StdErr: ${err.stderr}`);
  }
};

export { commands };
export default commands;
