import log from '../logger';
import _ from 'lodash';
import { exec } from 'teen_process';
import { quote } from 'shell-quote';

let commands = {};

commands.mobileShell = async function (opts = {}) {
  if (!this.relaxedSecurityEnabled) {
    log.errorAndThrow(`Appium server must have relaxed security flag set in order to run any shell commands`);
  }

  if (!_.isString(opts.command)) {
    log.errorAndThrow(`The 'command' argument is mandatory'`);
  }
  let {
    command,
    args = [],
    timeout = 20000,
    includeStderr,
  } = opts;
  if (!_.isArray(args)) {
    args = [args];
  }

  const adbArgs = [...this.adb.executable.defaultArgs, 'shell', command, ...args];
  log.debug(`Running '${this.adb.executable.path} ${quote(adbArgs)}'`);
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
