import _ from 'lodash';
import { errors } from 'appium-base-driver';

const NO_VALUE_ARG_TYPE = 'sn';
const SUPPORTED_EXTRA_TYPES = [
  's', NO_VALUE_ARG_TYPE, 'z', 'i', 'l', 'f', 'u', 'cn',
  'ia', 'ial', 'la', 'lal', 'fa', 'fal', 'sa', 'sal',
];

const commands = {};

function requireOptions (opts, requiredKeys = []) {
  const missingKeys = _.difference(requiredKeys, _.keys(opts));
  if (!_.isEmpty(missingKeys)) {
    throw new errors.InvalidArgumentError(`The following options are required: ${missingKeys}`);
  }
  return opts;
}

function parseCommonIntentArguments (opts = {}) {
  const {
    action,
    uri,
    mimeType,
    identifier,
    categories,
    component,
    extras,
    flags,
  } = opts;
  const resultArgs = [];
  if (action) {
    resultArgs.push('-a', action);
  }
  if (uri) {
    resultArgs.push('-d', uri);
  }
  if (mimeType) {
    resultArgs.push('-t', mimeType);
  }
  if (!_.isNil(identifier)) {
    resultArgs.push('-i', identifier);
  }
  if (categories) {
    if (_.isArray(categories)) {
      resultArgs.push(...(_.flatMap(categories.map((cName) => ['-c', cName]))));
    } else {
      resultArgs.push('-c', categories);
    }
  }
  if (component) {
    resultArgs.push('-n', component);
  }
  if (extras) {
    if (!_.isArray(extras)) {
      throw errors.InvalidArgumentError(`'extras' must be an array`);
    }
    for (const item of extras) {
      let type;
      let value;
      if (_.isArray(item)) {
        [type, value] = item;
      } else {
        type = item;
      }
      if (!_.includes(SUPPORTED_EXTRA_TYPES, type)) {
        throw errors.InvalidArgumentError(`Intent argument type '${type}' is not known. ` +
          `Supported intent argument types are: ${SUPPORTED_EXTRA_TYPES}`);
      }
      if (type === NO_VALUE_ARG_TYPE) {
        resultArgs.push(`-e${type}`);
      } else if (_.isUndefined(value)) {
        throw errors.InvalidArgumentError(`Intent argument type '${type}' requires a ` +
          `value to be provided.`);
      } else {
        resultArgs.push(`-e${type}`, value);
      }
    }
  }
  if (flags) {
    resultArgs.push('-f', flags);
  }
  return resultArgs;
}

/**
 * @typedef {Object} StartActivityOptions
 * @property {!string} intent - The name of the activity intent to start, for example
 * `com.some.package.name/.YourServiceSubClassName`. This option is mandatory.
 * @property {?string|number} user ['current'] - The user ID for which the service is started.
 * The `current` user id is used by default
 * @property {?boolean} wait [false] - Set it to `true` if you want to block the method call
 * until the activity manager's process returns the control to the system.
 * @property {?boolean} stop [false] - Set it to `true` to force stop the target
 * app before starting the activity
 * @property {?number|string} windowingMode - The windowing mode to launch the activity into.
 * Check https://android.googlesource.com/platform/frameworks/base/+/master/core/java/android/app/WindowConfiguration.java
 * for more details on possible windowing modes (constants starting with `WINDOWING_MODE_`).
 * @property {?number|string} activityType - The activity type to launch the activity as.
 * Check https://android.googlesource.com/platform/frameworks/base/+/master/core/java/android/app/WindowConfiguration.java
 * for more details on possible activity types (constants starting with `ACTIVITY_TYPE_`).
 * @property {?number|string} display - The display identifier to launch the activity into.
 * @property {?string} action - Action name
 * @property {?string} uri - Unified resource identifier
 * @property {?string} mimeType - Mime type
 * @property {?string} identifier - Optional identifier
 * @property {?string|Array<string>} categories - One or more category names
 * @property {?string} component - Component name
 * @property {Array<string|Array<string>>} extras - Optional intent arguments. Must be represented
 * as array of arrays, where each subarray item contains two items: value type and the value itself.
 * Supported value types are:
 * - s: string. Value must be a valid string
 * - sn: null. Value is ignored for this type
 * - z: boolean. Value must be either `true` or `false`
 * - i: integer. Value must be a valid 4-byte integer number
 * - l: long. Value must be a valid 8-byte long number
 * - f: float: Value must be a valid float number
 * - u: uri. Value must be a valid uniform resource identifier string
 * - cn: component name. Value must be a valid component name string
 * - ia: Integer[]. Value must be a string of comma-separated integers
 * - ial: List<Integer>. Value must be a string of comma-separated integers
 * - la: Long[]. Value must be a string of comma-separated long numbers
 * - lal: List<Long>. Value must be a string of comma-separated long numbers
 * - fa: Float[]. Value must be a string of comma-separated float numbers
 * - fal: List<Float>. Value must be a string of comma-separated float numbers
 * - sa: String[]. Value must be comma-separated strings. To embed a comma into a string,
 * escape it using "\,"
 * - sal: List<String>. Value must be comma-separated strings. To embed a comma into a string,
 * escape it using "\,"
 * For example: [['s', 'My String1'], ['s', 'My String2'], ['ia', '1,2,3,4']]
 */

/**
 * Starts the given activity intent.
 *
 * @param {StartActivityOptions} opts
 * @returns {string} The command output
 * @throws {Error} If there was a failure while starting the activity
 * or required options are missing
 */
commands.mobileStartActivity = async function mobileStartActivity (opts = {}) {
  const {
    intent,
    user,
    wait,
    stop,
    windowingMode,
    activityType,
    display,
  } = requireOptions(opts, ['intent']);
  const cmd = [
    'am', 'start-activity',
  ];
  if (!_.isNil(user)) {
    cmd.push('--user', user);
  }
  if (wait) {
    cmd.push('-W');
  }
  if (stop) {
    cmd.push('-S');
  }
  if (!_.isNil(windowingMode)) {
    cmd.push('--windowingMode', windowingMode);
  }
  if (!_.isNil(activityType)) {
    cmd.push('--activityType', activityType);
  }
  if (!_.isNil(display)) {
    cmd.push('--display', display);
  }
  cmd.push(...(parseCommonIntentArguments(opts)));
  cmd.push(intent);
  return await this.adb.shell(cmd);
};

/**
 * @typedef {Object} StartServiceOptions
 * @property {!string} intent - The name of the service intent to start, for example
 * `com.some.package.name/.YourServiceSubClassName`. This option is mandatory.
 * @property {?string|number} user ['current'] - The user ID for which the service is started.
 * The `current` user id is used by default
 * @property {?boolean} foreground [false] - Set it to `true` if your service must be
 * started as foreground service.
 * @property {?string} action - Action name
 * @property {?string} uri - Unified resource identifier
 * @property {?string} mimeType - Mime type
 * @property {?string} identifier - Optional identifier
 * @property {?string|Array<string>} categories - One or more category names
 * @property {?string} component - Component name
 * @property {Array<string|Array<string>>} extras - Optional intent arguments. Must be represented
 * as array of arrays, where each subarray item contains two items: value type and the value itself.
 * Supported value types are:
 * - s: string. Value must be a valid string
 * - sn: null. Value is ignored for this type
 * - z: boolean. Value must be either `true` or `false`
 * - i: integer. Value must be a valid 4-byte integer number
 * - l: long. Value must be a valid 8-byte long number
 * - f: float: Value must be a valid float number
 * - u: uri. Value must be a valid uniform resource identifier string
 * - cn: component name. Value must be a valid component name string
 * - ia: Integer[]. Value must be a string of comma-separated integers
 * - ial: List<Integer>. Value must be a string of comma-separated integers
 * - la: Long[]. Value must be a string of comma-separated long numbers
 * - lal: List<Long>. Value must be a string of comma-separated long numbers
 * - fa: Float[]. Value must be a string of comma-separated float numbers
 * - fal: List<Float>. Value must be a string of comma-separated float numbers
 * - sa: String[]. Value must be comma-separated strings. To embed a comma into a string,
 * escape it using "\,"
 * - sal: List<String>. Value must be comma-separated strings. To embed a comma into a string,
 * escape it using "\,"
 * For example: [['s', 'My String1'], ['s', 'My String2'], ['ia', '1,2,3,4']]
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
  if (!_.isNil(user)) {
    cmd.push('--user', user);
  }
  cmd.push(...(parseCommonIntentArguments(opts)));
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
  if (!_.isNil(user)) {
    cmd.push('--user', user);
  }
  cmd.push(...(parseCommonIntentArguments(opts)));
  cmd.push(intent);
  return await this.adb.shell(cmd);
};


export { commands };
export default commands;
