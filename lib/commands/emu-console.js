import log from '../logger';

const EMU_CONSOLE_FEATURE = 'emulator_console';

const commands = {};

/**
 * @typedef {Object} ExecOptions
 * @property {!Array<string>|string} command - The actual command to execute. See
 * https://developer.android.com/studio/run/emulator-console for more details
 * on available commands
 * @property {number} execTimeout [60000] A timeout used to wait for a server
 * reply to the given command in milliseconds
 * @property {number} connTimeout [5000] Console connection timeout in milliseconds
 * @property {number} initTimeout [5000] Telnet console initialization timeout
 * in milliseconds (the time between the connection happens and the command prompt
 * is available)
 */

/**
 * Executes a command through emulator telnet console interface and returns its output.
 * The `emulator_console` server feature must be enabled in order to use this method.
 *
 * @param {ExecOptions} opts
 * @returns {string} The command output
 * @throws {Error} If there was an error while connecting to the Telnet console
 * or if the given command returned non-OK response
 */
commands.mobileExecEmuConsoleCommand = async function mobileExecEmuConsoleCommand (opts = {}) {
  this.ensureFeatureEnabled(EMU_CONSOLE_FEATURE);

  const {
    command,
    execTimeout,
    connTimeout,
    initTimeout,
  } = opts;

  if (!command) {
    log.errorAndThrow(`The 'command' argument is mandatory`);
  }

  return await this.adb.execEmuConsoleCommand(command, {
    execTimeout,
    connTimeout,
    initTimeout,
  });
};

export { commands };
export default commands;
