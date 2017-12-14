import log from '../logger';
import _ from 'lodash';

let commands = {};

commands.mobileShell = async function (opts = {}) {
  if (!this.relaxedSecurityEnabled) {
    log.errorAndThrow(`Appium server must have relaxed security flag set in order to run any shell commands`);
  }

  if (!_.isString(opts.command)) {
    log.errorAndThrow(`The 'command' argument is mandatory'`);
  }
  let args = opts.args;
  if (args) {
    if (!_.isArray(args)) {
      args = [args];
    }
  } else {
    args = [];
  }

  return await this.adb.shell([opts.command, ...opts.args]);
};

export { commands };
export default commands;
