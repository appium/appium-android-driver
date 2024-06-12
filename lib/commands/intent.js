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
const API_LEVEL_ANDROID_8 = 26;

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
 * @param {import('./types').StartActivityOpts} [opts={}]
 * @returns {Promise<string>}
 */
export async function mobileStartActivity(opts = {}) {
  const {user, wait, stop, windowingMode, activityType, display} = opts;
  const cmd = [
    'am',
    (await this.adb.getApiLevel()) < API_LEVEL_ANDROID_8 ? 'start' : 'start-activity',
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
  cmd.push(...parseIntentSpec(opts));
  return await this.adb.shell(cmd);
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {import('./types').BroadcastOpts} [opts={}]
 * @returns {Promise<string>}
 */
export async function mobileBroadcast(opts = {}) {
  const {user, receiverPermission, allowBackgroundActivityStarts} = opts;
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
  cmd.push(...parseIntentSpec(opts));
  return await this.adb.shell(cmd);
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {import('./types').StartServiceOpts} [opts={}]
 * @returns {Promise<string>}
 */
export async function mobileStartService(opts = {}) {
  const {user, foreground} = opts;
  const cmd = ['am'];
  if ((await this.adb.getApiLevel()) < API_LEVEL_ANDROID_8) {
    cmd.push('startservice');
  } else {
    cmd.push(foreground ? 'start-foreground-service' : 'start-service');
  }
  if (!_.isNil(user)) {
    cmd.push('--user', String(user));
  }
  cmd.push(...parseIntentSpec(opts));
  return await this.adb.shell(cmd);
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {import('./types').StopServiceOpts} [opts={}]
 * @returns {Promise<string>}
 */
export async function mobileStopService(opts = {}) {
  const {user} = opts;
  const cmd = [
    'am',
    (await this.adb.getApiLevel()) < API_LEVEL_ANDROID_8 ? 'stopservice' : 'stop-service',
  ];
  if (!_.isNil(user)) {
    cmd.push('--user', String(user));
  }
  cmd.push(...parseIntentSpec(opts));
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
