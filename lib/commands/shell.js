import log from '../logger';
import _ from 'lodash';
import { exec } from 'teen_process';
import { util } from 'appium-support';

const ADB_SHELL_FEATURE = 'adb_shell';

let commands = {};

commands.mobileShell = async function mobileShell (opts = {}) {
  this.ensureFeatureEnabled(ADB_SHELL_FEATURE);

  const {
    command,
    args = [],
    timeout = 20000,
    includeStderr,
  } = opts;

  if (!_.isString(command)) {
    log.errorAndThrow(`The 'command' argument is mandatory`);
  }

  const adbArgs = [
    ...this.adb.executable.defaultArgs,
    'shell',
    command,
    ...(_.isArray(args) ? args : [args])
  ];
  log.debug(`Running '${this.adb.executable.path} ${util.quote(adbArgs)}'`);
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
    log.errorAndThrow(`Cannot execute the '${command}' shell command. ` +
                      `Original error: ${err.message}. ` +
                      `StdOut: ${err.stdout}. StdErr: ${err.stderr}`);
  }
};

export { commands };
export default commands;
