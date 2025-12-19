import _ from 'lodash';
import {errors} from 'appium/driver';
import {util} from '@appium/support';
import type {AndroidDriver} from '../driver';
import type {IntentOpts} from './types';

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
] as const;

/**
 * Starts an Android activity.
 *
 * @deprecated Use {@link mobileStartActivity} instead.
 * @param appPackage The package name of the application to start.
 * @param appActivity The activity name to start.
 * @param appWaitPackage The package name to wait for. Defaults to `appPackage` if not provided.
 * @param appWaitActivity The activity name to wait for. Defaults to `appActivity` if not provided.
 * @param intentAction The intent action to use.
 * @param intentCategory The intent category to use.
 * @param intentFlags The intent flags to use.
 * @param optionalIntentArguments Optional intent arguments.
 * @param dontStopAppOnReset If `true`, does not stop the app on reset. If not provided, uses the capability value.
 * @returns Promise that resolves when the activity is started.
 */
export async function startActivity(
  this: AndroidDriver,
  appPackage: string,
  appActivity: string,
  appWaitPackage?: string,
  appWaitActivity?: string,
  intentAction?: string,
  intentCategory?: string,
  intentFlags?: string,
  optionalIntentArguments?: string,
  dontStopAppOnReset?: boolean,
): Promise<void> {
  this.log.debug(`Starting package '${appPackage}' and activity '${appActivity}'`);

  // dontStopAppOnReset is both an argument here, and a desired capability
  // if the argument is set, use it, otherwise use the cap
  if (!util.hasValue(dontStopAppOnReset)) {
    dontStopAppOnReset = !!this.opts.dontStopAppOnReset;
  }

  const args = {
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
 * Starts an Android activity using the activity manager.
 *
 * @param wait Set it to `true` if you want to block the method call
 * until the activity manager's process returns the control to the system.
 * `false` by default.
 * @param stop Set it to `true` to force stop the target
 * app before starting the activity. `false` by default.
 * @param windowingMode The windowing mode to launch the activity into.
 * Check https://android.googlesource.com/platform/frameworks/base/+/master/core/java/android/app/WindowConfiguration.java
 * for more details on possible windowing modes (constants starting with `WINDOWING_MODE_`).
 * @param activityType The activity type to launch the activity as.
 * Check https://android.googlesource.com/platform/frameworks/base/+/master/core/java/android/app/WindowConfiguration.java
 * for more details on possible activity types (constants starting with `ACTIVITY_TYPE_`).
 * @param display The display identifier to launch the activity into.
 * @param user The user ID for which the activity is started.
 * @param intent The name of the activity intent to start, for example
 * `com.some.package.name/.YourActivitySubClassName`.
 * @param action Action name.
 * @param pkg Package name.
 * @param uri Unified resource identifier.
 * @param mimeType Mime type.
 * @param identifier Optional identifier.
 * @param component Component name.
 * @param categories One or more category names.
 * @param extras Optional intent arguments. Must be represented as array of arrays,
 * where each subarray item contains two or three string items: value type, key name and the value itself.
 * See {@link IntentOpts} for supported value types.
 * @param flags Intent startup-specific flags as a hexadecimal string.
 * @returns Promise that resolves to the command output string.
 */
export async function mobileStartActivity(
  this: AndroidDriver,
  wait?: boolean,
  stop?: boolean,
  windowingMode?: string | number,
  activityType?: string | number,
  display?: number | string,
  user?: string,
  intent?: string,
  action?: string,
  pkg?: string,
  uri?: string,
  mimeType?: string,
  identifier?: string,
  component?: string,
  categories?: string | string[],
  extras?: string[][],
  flags?: string,
): Promise<string> {
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
 * Sends a broadcast intent to the Android system.
 *
 * @param receiverPermission Require receiver to hold the given permission.
 * @param allowBackgroundActivityStarts Whether the receiver may start activities even if in the background.
 * @param user The user ID for which the broadcast is sent.
 * The `current` alias assumes the current user ID. `all` by default.
 * @param intent The name of the activity intent to broadcast, for example
 * `com.some.package.name/.YourServiceSubClassName`.
 * @param action Action name.
 * @param pkg Package name.
 * @param uri Unified resource identifier.
 * @param mimeType Mime type.
 * @param identifier Optional identifier.
 * @param component Component name.
 * @param categories One or more category names.
 * @param extras Optional intent arguments. Must be represented as array of arrays,
 * where each subarray item contains two or three string items: value type, key name and the value itself.
 * See {@link IntentOpts} for supported value types.
 * @param flags Intent startup-specific flags as a hexadecimal string.
 * @returns Promise that resolves to the command output string.
 */
export async function mobileBroadcast(
  this: AndroidDriver,
  receiverPermission?: string,
  allowBackgroundActivityStarts?: boolean,
  user?: string | number,
  intent?: string,
  action?: string,
  pkg?: string,
  uri?: string,
  mimeType?: string,
  identifier?: string,
  component?: string,
  categories?: string | string[],
  extras?: string[][],
  flags?: string,
): Promise<string> {
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
 * Starts an Android service.
 *
 * @param foreground Set it to `true` if your service must be started as foreground service.
 * This option is ignored if the API level of the device under test is below 26 (Android 8).
 * @param user The user ID for which the service is started.
 * The `current` user id is used by default.
 * @param intent The name of the activity intent to start, for example
 * `com.some.package.name/.YourServiceSubClassName`.
 * @param action Action name.
 * @param pkg Package name.
 * @param uri Unified resource identifier.
 * @param mimeType Mime type.
 * @param identifier Optional identifier.
 * @param component Component name.
 * @param categories One or more category names.
 * @param extras Optional intent arguments. Must be represented as array of arrays,
 * where each subarray item contains two or three string items: value type, key name and the value itself.
 * See {@link IntentOpts} for supported value types.
 * @param flags Intent startup-specific flags as a hexadecimal string.
 * @returns Promise that resolves to the command output string.
 */
export async function mobileStartService(
  this: AndroidDriver,
  foreground?: boolean,
  user?: string,
  intent?: string,
  action?: string,
  pkg?: string,
  uri?: string,
  mimeType?: string,
  identifier?: string,
  component?: string,
  categories?: string | string[],
  extras?: string[][],
  flags?: string,
): Promise<string> {
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
 * Stops an Android service.
 *
 * @param user The user ID for which the service is stopped.
 * @param intent The name of the activity intent to stop, for example
 * `com.some.package.name/.YourServiceSubClassName`.
 * @param action Action name.
 * @param pkg Package name.
 * @param uri Unified resource identifier.
 * @param mimeType Mime type.
 * @param identifier Optional identifier.
 * @param component Component name.
 * @param categories One or more category names.
 * @param extras Optional intent arguments. Must be represented as array of arrays,
 * where each subarray item contains two or three string items: value type, key name and the value itself.
 * See {@link IntentOpts} for supported value types.
 * @param flags Intent startup-specific flags as a hexadecimal string.
 * @returns Promise that resolves to the command output string.
 * If the service was already stopped, returns the error message.
 */
export async function mobileStopService(
  this: AndroidDriver,
  user?: string,
  intent?: string,
  action?: string,
  pkg?: string,
  uri?: string,
  mimeType?: string,
  identifier?: string,
  component?: string,
  categories?: string | string[],
  extras?: string[][],
  flags?: string,
): Promise<string> {
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
    const err = e as {code?: number; stderr?: string};
    if (err.code === 255 && err.stderr?.includes('Service stopped')) {
      return err.stderr;
    }
    throw e;
  }
}

// #region Internal helpers

function parseIntentSpec(opts: IntentOpts = {}): string[] {
  const {intent, action, uri, mimeType, identifier, categories, component, extras, flags} = opts;
  const resultArgs: string[] = [];
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
      if (!SUPPORTED_EXTRA_TYPES.includes(type as any)) {
        throw new errors.InvalidArgumentError(
          `Extra argument type '${type}' is not known. ` +
            `Supported intent argument types are: ${SUPPORTED_EXTRA_TYPES.join(', ')}`,
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

