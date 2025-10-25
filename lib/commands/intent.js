import _ from 'lodash';
import {errors} from 'appium/driver';
import {util} from '@appium/support';

const NO_VALUE_ARG_TYPE = 'sn';
const SUPPORTED_EXTRA_TYPES = [
  's',
  NO_VALUE_ARG_TYPE,
  'z',
  'i',
  'l',
  'f',
  'u',
  'cn',
  'ia',
  'ial',
  'la',
  'lal',
  'fa',
  'fal',
  'sa',
  'sal',
];

/**
 * @deprecated
 * @this {import('../driver').AndroidDriver}
 * @param {string} appPackage
 * @param {string} appActivity
 * @param {string} [appWaitPackage]
 * @param {string} [appWaitActivity]
 * @param {string} [intentAction]
 * @param {string} [intentCategory]
 * @param {string} [intentFlags]
 * @param {string} [optionalIntentArguments]
 * @param {boolean} [dontStopAppOnReset]
 * @returns {Promise<void>}
 */
export async function startActivity(
  appPackage,
  appActivity,
  appWaitPackage,
  appWaitActivity,
  intentAction,
  intentCategory,
  intentFlags,
  optionalIntentArguments,
  dontStopAppOnReset,
) {
  this.log.debug(`Starting package '${appPackage}' and activity '${appActivity}'`);

  // dontStopAppOnReset is both an argument here, and a desired capability
  // if the argument is set, use it, otherwise use the cap
  if (!util.hasValue(dontStopAppOnReset)) {
    dontStopAppOnReset = !!this.opts.dontStopAppOnReset;
  }

  /** @type {import('appium-adb').StartAppOptions} */
  let args = {
    pkg: appPackage,
    activity: appActivity,
    waitPkg: appWaitPackage || appPackage,
    waitActivity: appWaitActivity || appActivity,
    action: intentAction,
    category: intentCategory,
    flags: intentFlags,
    optionalIntentArguments,
    stopApp: !dontStopAppOnReset,
  };
  this._cachedActivityArgs = this._cachedActivityArgs || {};
  this._cachedActivityArgs[`${args.waitPkg}/${args.waitActivity}`] = args;
  await this.adb.startApp(args);
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {boolean} [wait] Set it to `true` if you want to block the method call
 * until the activity manager's process returns the control to the system.
 * false by default.
 * @param {boolean} [stop] Set it to `true` to force stop the target
 * app before starting the activity
 * false by default.
 * @param {string | number} [windowingMode] The windowing mode to launch the activity into.
 * Check
 * https://android.googlesource.com/platform/frameworks/base/+/master/core/java/android/app/WindowConfiguration.java
 * for more details on possible windowing modes (constants starting with
 * `WINDOWING_MODE_`).
 * @param {string | number} [activityType] The activity type to launch the activity as.
 * Check https://android.googlesource.com/platform/frameworks/base/+/master/core/java/android/app/WindowConfiguration.java
 * for more details on possible activity types (constants starting with `ACTIVITY_TYPE_`).
 * @param {number | string} [display] The display identifier to launch the activity into.
 * @param {string} [user]
 * @param {string} [intent]
 * @param {string} [action]
 * @param {string} [pkg]
 * @param {string} [uri]
 * @param {string} [mimeType]
 * @param {string} [identifier]
 * @param {string} [component]
 * @param {string | string[]} [categories]
 * @param {string[][]} [extras]
 * @param {string} [flags]
 * @returns {Promise<string>}
 */
export async function mobileStartActivity(
  wait,
  stop,
  windowingMode,
  activityType,
  display,
  user,
  intent,
  action,
  pkg,
  uri,
  mimeType,
  identifier,
  component,
  categories,
  extras,
  flags,
) {
  const cmd = [
    'am',
    'start-activity',
  ];
  if (!_.isNil(user)) {
    cmd.push('--user', String(user));
  }
  if (wait) {
    cmd.push('-W');
  }
  if (stop) {
    cmd.push('-S');
  }
  if (!_.isNil(windowingMode)) {
    cmd.push('--windowingMode', String(windowingMode));
  }
  if (!_.isNil(activityType)) {
    cmd.push('--activityType', String(activityType));
  }
  if (!_.isNil(display)) {
    cmd.push('--display', String(display));
  }
  cmd.push(...parseIntentSpec({
    intent,
    action,
    package: pkg,
    uri,
    mimeType,
    identifier,
    component,
    categories,
    extras,
    flags,
  }));
  return await this.adb.shell(cmd);
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {string | number} [user] The user ID for which the broadcast is sent.
 * The `current` alias assumes the current user ID.
 * `all` by default.
 * @param {string} [receiverPermission] Require receiver to hold the given permission.
 * @param {boolean} [allowBackgroundActivityStarts] Whether the receiver may start activities even if in the background.
 * @param {string} [intent]
 * @param {string} [action]
 * @param {string} [pkg]
 * @param {string} [uri]
 * @param {string} [mimeType]
 * @param {string} [identifier]
 * @param {string} [component]
 * @param {string | string[]} [categories]
 * @param {string[][]} [extras]
 * @param {string} [flags]
 * @returns {Promise<string>}
 */
export async function mobileBroadcast(
  receiverPermission,
  allowBackgroundActivityStarts,
  user,
  intent,
  action,
  pkg,
  uri,
  mimeType,
  identifier,
  component,
  categories,
  extras,
  flags,
) {
  const cmd = ['am', 'broadcast'];
  if (!_.isNil(user)) {
    cmd.push('--user', String(user));
  }
  if (receiverPermission) {
    cmd.push('--receiver-permission', receiverPermission);
  }
  if (allowBackgroundActivityStarts) {
    cmd.push('--allow-background-activity-starts');
  }
  cmd.push(...parseIntentSpec({
    intent,
    action,
    package: pkg,
    uri,
    mimeType,
    identifier,
    component,
    categories,
    extras,
    flags,
  }));
  return await this.adb.shell(cmd);
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {boolean} [foreground] Set it to `true` if your service must be started as foreground service.
 * This option is ignored if the API level of the device under test is below
 *   26 (Android 8).
 * @param {string} [user]
 * @param {string} [intent]
 * @param {string} [action]
 * @param {string} [pkg]
 * @param {string} [uri]
 * @param {string} [mimeType]
 * @param {string} [identifier]
 * @param {string} [component]
 * @param {string | string[]} [categories]
 * @param {string[][]} [extras]
 * @param {string} [flags]
 * @returns {Promise<string>}
 */
export async function mobileStartService(
  foreground,
  user,
  intent,
  action,
  pkg,
  uri,
  mimeType,
  identifier,
  component,
  categories,
  extras,
  flags,
) {
  const cmd = ['am'];
  cmd.push(foreground ? 'start-foreground-service' : 'start-service');
  if (!_.isNil(user)) {
    cmd.push('--user', String(user));
  }
  cmd.push(...parseIntentSpec({
    intent,
    action,
    package: pkg,
    uri,
    mimeType,
    identifier,
    component,
    categories,
    extras,
    flags,
  }));
  return await this.adb.shell(cmd);
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {string} [user]
 * @param {string} [intent]
 * @param {string} [action]
 * @param {string} [pkg]
 * @param {string} [uri]
 * @param {string} [mimeType]
 * @param {string} [identifier]
 * @param {string} [component]
 * @param {string | string[]} [categories]
 * @param {string[][]} [extras]
 * @param {string} [flags]
 * @returns {Promise<string>}
 */
export async function mobileStopService(
  user,
  intent,
  action,
  pkg,
  uri,
  mimeType,
  identifier,
  component,
  categories,
  extras,
  flags,
) {
  const cmd = [
    'am',
    'stop-service',
  ];
  if (!_.isNil(user)) {
    cmd.push('--user', String(user));
  }
  cmd.push(...parseIntentSpec({
    intent,
    action,
    package: pkg,
    uri,
    mimeType,
    identifier,
    component,
    categories,
    extras,
    flags,
  }));
  try {
    return await this.adb.shell(cmd);
  } catch (e) {
    // https://github.com/appium/appium-uiautomator2-driver/issues/792
    if (e.code === 255 && e.stderr?.includes('Service stopped')) {
      return e.stderr;
    }
    throw e;
  }
}

// #region Internal helpers

/**
 *
 * @param {import('./types').IntentOpts} opts
 * @returns {string[]}
 */
function parseIntentSpec(opts = {}) {
  const {intent, action, uri, mimeType, identifier, categories, component, extras, flags} = opts;
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
      resultArgs.push(..._.flatMap(categories.map((cName) => ['-c', cName])));
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
            `Supported intent argument types are: ${SUPPORTED_EXTRA_TYPES}`,
        );
      }
      if (_.isEmpty(key) || (_.isString(key) && _.trim(key) === '')) {
        throw new errors.InvalidArgumentError(
          `Extra argument's key in '${JSON.stringify(item)}' must be a valid string identifier`,
        );
      }
      if (type === NO_VALUE_ARG_TYPE) {
        resultArgs.push(`--e${type}`, key);
      } else if (_.isUndefined(value)) {
        throw new errors.InvalidArgumentError(
          `Intent argument type '${type}' in '${JSON.stringify(item)}' requires a ` +
            `valid value to be provided`,
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

// #endregion

/**
 * @typedef {import('appium-adb').ADB} ADB
 */
