import _ from 'lodash';

const commands = {};

function requireOptions (opts, requiredKeys = []) {
  const missingKeys = _.difference(requiredKeys, _.keys(opts));
  if (!_.isEmpty(missingKeys)) {
    throw new Error(`The following options are required: ${missingKeys}`);
  }
  return opts;
}

/**
 * @typedef {Object} StartServiceOptions
 * @property {!string} intent - The name of the service intent to start, for example
 * `com.some.package.name/.YourServiceSubClassName`. This option is mandatory.
 * @property {string|number} user ['current'] - The user ID for which the service is started.
 * The `current` user id is used by default
 * @property {boolean} foreground [false] - Set it to `true` if your service must be
 * started as foreground service.
 */

/**
 * Starts the given service intent.
 *
 * @param {StartServiceOptions} opts
 * @returns {string} The command output
 * @throws {Error} If there was a failure while starting the service
 * or required options are missing
 */
commands.mobileStartService = async function mobileStartService (opts = {}) {
  const {
    intent,
    user,
    foreground,
  } = requireOptions(opts, ['intent']);
  const cmd = [
    'am', foreground ? 'start-foreground-service' : 'start-service',
  ];
  if (user) {
    cmd.push('--user', user);
  }
  cmd.push(intent);
  return await this.adb.shell(cmd);
};

/**
 * @typedef {Object} StopServiceOptions
 * @property {!string} intent - The name of the service intent to stop, for example
 * `com.some.package.name/.YourServiceSubClassName`. This option is mandatory.
 * @property {string|number} user ['current'] - The user ID for which the service is running.
 * The `current` user id is used by default
 */

/**
 * Stops the given service intent.
 *
 * @param {StopServiceOptions} opts
 * @returns {string} The command output
 * @throws {Error} If there was a failure while stopping the service
 * or required options are missing
 */
commands.mobileStopService = async function mobileStopService (opts = {}) {
  const {
    intent,
    user,
  } = requireOptions(opts, ['intent']);
  const cmd = [
    'am', 'stop-service',
  ];
  if (user) {
    cmd.push('--user', user);
  }
  cmd.push(intent);
  return await this.adb.shell(cmd);
};


export { commands };
export default commands;
