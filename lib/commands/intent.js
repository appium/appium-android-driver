import _ from 'lodash';
import { errors } from 'appium-base-driver';

const NO_VALUE_ARG_TYPE = 'sn';
const SUPPORTED_EXTRA_TYPES = [
  's', NO_VALUE_ARG_TYPE, 'z', 'i', 'l', 'f', 'u', 'cn',
  'ia', 'ial', 'la', 'lal', 'fa', 'fal', 'sa', 'sal',
];
const API_LEVEL_ANDROID_8 = 26;

const commands = {};

function parseIntentSpec (opts = {}) {
  const {
    intent,
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
  if (intent) {
    resultArgs.push(intent);
  }
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
  if (opts.package) {
    resultArgs.push('-p', opts.package);
  }
  if (extras) {
    if (!_.isArray(extras)) {
      throw new errors.InvalidArgumentError(`'extras' must be an array`);
    }
    for (const item of extras) {
      if (!_.isArray(item)) {
        throw new errors.InvalidArgumentError(`Extra argument '${item}' must be an array`);
      }
      const [type, key, value] = item;
      if (!_.includes(SUPPORTED_EXTRA_TYPES, type)) {
        throw new errors.InvalidArgumentError(
          `Extra argument type '${type}' is not known. ` +
          `Supported intent argument types are: ${SUPPORTED_EXTRA_TYPES}`
        );
      }
      if (_.isEmpty(key) || (_.isString(key) && _.trim(key) === '')) {
        throw new errors.InvalidArgumentError(
          `Extra argument's key in '${JSON.stringify(item)}' must be a valid string identifier`
        );
      }
      if (type === NO_VALUE_ARG_TYPE) {
        resultArgs.push(`--e${type}`, key);
      } else if (_.isUndefined(value)) {
        throw new errors.InvalidArgumentError(
          `Intent argument type '${type}' in '${JSON.stringify(item)}' requires a ` +
          `valid value to be provided`
        );
      } else {
        resultArgs.push(`--e${type}`, key, value);
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
 * @property {?string} intent - The name of the activity intent to start, for example
 * `com.some.package.name/.YourServiceSubClassName`
 * @property {?string} action - Action name
 * @property {?string} package - Package name
 * @property {?string} uri - Unified resource identifier
 * @property {?string} mimeType - Mime type
 * @property {?string} identifier - Optional identifier
 * @property {?string|Array<string>} categories - One or more category names
 * @property {?string} component - Component name
 * @property {Array<string|Array<string>>} extras - Optional intent arguments. Must be represented
 * as array of arrays, where each subarray item contains two or three string items:
 * value type, key name and the value itself.
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
 * For example: [['s', 'varName1', 'My String1'], ['s', 'varName2', 'My String2'], ['ia', 'arrName', '1,2,3,4']]
 * @property {?string} flags - Intent startup-specific flags as a hexadecimal string.
 * See https://developer.android.com/reference/android/content/Intent.html
 * for the list of available flag values (constants starting with FLAG_ACTIVITY_).
 * Flag values could be merged using the logical 'or' operation.
 * For example, 0x10200000 is the combination of two flags:
 * 0x10000000 `FLAG_ACTIVITY_NEW_TASK` | 0x00200000 `FLAG_ACTIVITY_RESET_TASK_IF_NEEDED`
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
    user,
    wait,
    stop,
    windowingMode,
    activityType,
    display,
  } = opts;
  const cmd = [
    'am', (await this.adb.getApiLevel() < API_LEVEL_ANDROID_8) ? 'start' : 'start-activity',
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
  cmd.push(...(parseIntentSpec(opts)));
  return await this.adb.shell(cmd);
};

/**
 * @typedef {Object} BroadcastOptions
 * @property {?string|number} user ['all'] - The user ID for which the broadcast is sent.
 * The `current` alias assumes the current user ID.
 * @property {?string} receiverPermission - Require receiver to hold the given permission.
 * @property {?boolean} allowBackgroundActivityStarts [false] - Whether the receiver may
 * start activities even if in the background.
 * @property {?string} intent - The name of the intent to broadcast to, for example
 * `com.some.package.name/.YourServiceSubClassName`.
 * @property {?string} action - Action name
 * @property {?string} uri - Unified resource identifier
 * @property {?string} mimeType - Mime type
 * @property {?string} identifier - Optional identifier
 * @property {?string|Array<string>} categories - One or more category names
 * @property {?string} component - Component name
 * @property {?string} package - Package name
 * @property {Array<Array<string>>} extras - Optional intent arguments.
 * See above for the detailed description.
 * @property {?string} flags - Intent startup-specific flags as a hexadecimal string.
 * See above for the detailed description.
 */


/**
 * Send a broadcast intent.
 *
 * @param {BroadcastOptions} opts
 * @returns {string} The command output
 * @throws {Error} If there was a failure while starting the activity
 * or required options are missing
 */
commands.mobileBroadcast = async function mobileBroadcast (opts = {}) {
  const {
    user,
    receiverPermission,
    allowBackgroundActivityStarts,
  } = opts;
  const cmd = ['am', 'broadcast'];
  if (!_.isNil(user)) {
    cmd.push('--user', user);
  }
  if (receiverPermission) {
    cmd.push('--receiver-permission', receiverPermission);
  }
  if (allowBackgroundActivityStarts) {
    cmd.push('--allow-background-activity-starts');
  }
  cmd.push(...(parseIntentSpec(opts)));
  return await this.adb.shell(cmd);
};

/**
 * @typedef {Object} StartServiceOptions
 * @property {?string|number} user ['current'] - The user ID for which the service is started.
 * The `current` user id is used by default
 * @property {?boolean} foreground [false] - Set it to `true` if your service must be
 * started as foreground service. This option is ignored if the API level of the
 * device under test is below 26 (Android 8).
 * @property {?string} intent - The name of the service intent to start, for example
 * `com.some.package.name/.YourServiceSubClassName`.
 * @property {?string} action - Action name
 * @property {?string} uri - Unified resource identifier
 * @property {?string} mimeType - Mime type
 * @property {?string} identifier - Optional identifier
 * @property {?string|Array<string>} categories - One or more category names
 * @property {?string} component - Component name
 * @property {?string} package - Package name
 * @property {Array<Array<string>>} extras - Optional intent arguments.
 * See above for the detailed description.
 * @property {?string} flags - Intent startup-specific flags as a hexadecimal string.
 * See above for the detailed description.
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
    user,
    foreground,
  } = opts;
  const cmd = ['am'];
  if (await this.adb.getApiLevel() < API_LEVEL_ANDROID_8) {
    cmd.push('startservice');
  } else {
    cmd.push(foreground ? 'start-foreground-service' : 'start-service');
  }
  if (!_.isNil(user)) {
    cmd.push('--user', user);
  }
  cmd.push(...(parseIntentSpec(opts)));
  return await this.adb.shell(cmd);
};

/**
 * @typedef {Object} StopServiceOptions
 * @property {string|number} user ['current'] - The user ID for which the service is running.
 * The `current` user id is used by default
 * @property {?string} intent - The name of the service intent to stop, for example
 * `com.some.package.name/.YourServiceSubClassName`.
 * @property {?string} action - Action name
 * @property {?string} uri - Unified resource identifier
 * @property {?string} mimeType - Mime type
 * @property {?string} identifier - Optional identifier
 * @property {?string|Array<string>} categories - One or more category names
 * @property {?string} component - Component name
 * @property {?string} package - Package name
 * @property {Array<Array<string>>} extras - Optional intent arguments.
 * See above for the detailed description.
 * @property {?string} flags - See above for the detailed description.
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
    user,
  } = opts;
  const cmd = [
    'am',
    (await this.adb.getApiLevel() < API_LEVEL_ANDROID_8) ? 'stopservice' : 'stop-service'
  ];
  if (!_.isNil(user)) {
    cmd.push('--user', user);
  }
  cmd.push(...(parseIntentSpec(opts)));
  return await this.adb.shell(cmd);
};


export { commands };
export default commands;
