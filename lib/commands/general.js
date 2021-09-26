import _ from 'lodash';
import androidHelpers from '../android-helpers';
import { util } from 'appium-support';
import log from '../logger';
import moment from 'moment';
import { longSleep } from 'asyncbox';

const MOMENT_FORMAT_ISO8601 = 'YYYY-MM-DDTHH:mm:ssZ';

let commands = {}, helpers = {}, extensions = {};

commands.keys = async function keys (keys) {
  // Protocol sends an array; rethink approach
  keys = _.isArray(keys) ? keys.join('') : keys;
  let params = {
    text: keys,
    replace: false
  };
  if (this.opts.unicodeKeyboard) {
    params.unicodeKeyboard = true;
  }
  await this.doSendKeys(params);
};

commands.doSendKeys = async function doSendKeys (params) {
  return await this.bootstrap.sendAction('setText', params);
};

/**
 * Retrieves the current device's timestamp.
 *
 * @param {string} format - The set of format specifiers. Read
 *                          https://momentjs.com/docs/ to get the full list of supported
 *                          datetime format specifiers. The default format is
 *                          `YYYY-MM-DDTHH:mm:ssZ`, which complies to ISO-8601
 * @return {string} Formatted datetime string or the raw command output if formatting fails
 */
commands.getDeviceTime = async function getDeviceTime (format = MOMENT_FORMAT_ISO8601) {
  log.debug('Attempting to capture android device date and time. ' +
    `The format specifier is '${format}'`);
  const deviceTimestamp = (await this.adb.shell(['date', '+%Y-%m-%dT%T%z'])).trim();
  log.debug(`Got device timestamp: ${deviceTimestamp}`);
  const parsedTimestamp = moment.utc(deviceTimestamp, 'YYYY-MM-DDTHH:mm:ssZZ');
  if (!parsedTimestamp.isValid()) {
    log.warn('Cannot parse the returned timestamp. Returning as is');
    return deviceTimestamp;
  }
  return parsedTimestamp.utcOffset(parsedTimestamp._tzm || 0).format(format);
};

/**
 * @typedef {Object} DeviceTimeOptions
 * @property {string} format [YYYY-MM-DDTHH:mm:ssZ] - See getDeviceTime#format
 */

/**
 * Retrieves the current device time
 *
 * @param {DeviceTimeOptions} opts
 * @return {string} Formatted datetime string or the raw command output if formatting fails
 */
commands.mobileGetDeviceTime = async function mobileGetDeviceTime (opts = {}) {
  return await this.getDeviceTime(opts.format);
};

commands.getPageSource = async function getPageSource () {
  return await this.bootstrap.sendAction('source');
};

commands.back = async function back () {
  return await this.bootstrap.sendAction('pressBack');
};

commands.isKeyboardShown = async function isKeyboardShown () {
  const {isKeyboardShown} = await this.adb.isSoftKeyboardPresent();
  return isKeyboardShown;
};

commands.hideKeyboard = async function hideKeyboard () {
  return await this.adb.hideKeyboard();
};

commands.openSettingsActivity = async function openSettingsActivity (setting) {
  let {appPackage, appActivity} = await this.adb.getFocusedPackageAndActivity();
  await this.adb.shell(['am', 'start', '-a', `android.settings.${setting}`]);
  await this.adb.waitForNotActivity(appPackage, appActivity, 5000);
};

commands.getWindowSize = async function getWindowSize () {
  return await this.bootstrap.sendAction('getDeviceSize');
};

// For W3C
commands.getWindowRect = async function getWindowRect () {
  const { width, height } = await this.getWindowSize();
  return {
    width,
    height,
    x: 0,
    y: 0
  };
};

commands.getCurrentActivity = async function getCurrentActivity () {
  return (await this.adb.getFocusedPackageAndActivity()).appActivity;
};

commands.getCurrentPackage = async function getCurrentPackage () {
  return (await this.adb.getFocusedPackageAndActivity()).appPackage;
};

commands.background = async function background (seconds) {
  if (seconds < 0) {
    // if user passes in a negative seconds value, interpret that as the instruction
    // to not bring the app back at all
    await this.adb.goToHome();
    return true;
  }
  let {appPackage, appActivity} = await this.adb.getFocusedPackageAndActivity();
  await this.adb.goToHome();

  // people can wait for a long time, so to be safe let's use the longSleep function and log
  // progress periodically.
  const sleepMs = seconds * 1000;
  const thresholdMs = 30 * 1000; // use the spin-wait for anything over this threshold
  // for our spin interval, use 1% of the total wait time, but nothing bigger than 30s
  const intervalMs = _.min([30 * 1000, parseInt(sleepMs / 100, 10)]);
  const progressCb = ({elapsedMs, progress}) => {
    const waitSecs = (elapsedMs / 1000).toFixed(0);
    const progressPct = (progress * 100).toFixed(2);
    log.debug(`Waited ${waitSecs}s so far (${progressPct}%)`);
  };
  await longSleep(sleepMs, {thresholdMs, intervalMs, progressCb});

  let args;
  if (this._cachedActivityArgs && this._cachedActivityArgs[`${appPackage}/${appActivity}`]) {
    // the activity was started with `startActivity`, so use those args to restart
    args = this._cachedActivityArgs[`${appPackage}/${appActivity}`];
  } else {
    try {
      log.debug(`Activating app '${appPackage}' in order to restore it`);
      await this.activateApp(appPackage);
      return true;
    } catch (ign) {}
    args = ((appPackage === this.opts.appPackage && appActivity === this.opts.appActivity) ||
            (appPackage === this.opts.appWaitPackage && (this.opts.appWaitActivity || '').split(',').includes(appActivity)))
      ? {// the activity is the original session activity, so use the original args
        pkg: this.opts.appPackage,
        activity: this.opts.appActivity,
        action: this.opts.intentAction,
        category: this.opts.intentCategory,
        flags: this.opts.intentFlags,
        waitPkg: this.opts.appWaitPackage,
        waitActivity: this.opts.appWaitActivity,
        waitForLaunch: this.opts.appWaitForLaunch,
        waitDuration: this.opts.appWaitDuration,
        optionalIntentArguments: this.opts.optionalIntentArguments,
        stopApp: false,
        user: this.opts.userProfile}
      : {// the activity was started some other way, so use defaults
        pkg: appPackage,
        activity: appActivity,
        waitPkg: appPackage,
        waitActivity: appActivity,
        stopApp: false};
  }
  args = await util.filterObject(args);
  log.debug(`Bringing application back to foreground with arguments: ${JSON.stringify(args)}`);
  return await this.adb.startApp(args);
};

commands.getStrings = async function getStrings (language) {
  if (!language) {
    language = await this.adb.getDeviceLanguage();
    log.info(`No language specified, returning strings for: ${language}`);
  }

  // Clients require the resulting mapping to have both keys
  // and values of type string
  const preprocessStringsMap = (mapping) => {
    const result = {};
    for (const [key, value] of _.toPairs(mapping)) {
      result[key] = _.isString(value) ? value : JSON.stringify(value);
    }
    return result;
  };

  if (this.apkStrings[language]) {
    // Return cached strings
    return preprocessStringsMap(this.apkStrings[language]);
  }

  this.apkStrings[language] = await androidHelpers.pushStrings(language, this.adb, this.opts);
  if (this.bootstrap) {
    // TODO: This is mutating the current language, but it's how appium currently works
    await this.bootstrap.sendAction('updateStrings');
  }

  return preprocessStringsMap(this.apkStrings[language]);
};

commands.launchApp = async function launchApp () {
  await this.initAUT();
  await this.startAUT();
};

commands.startActivity = async function startActivity (appPackage, appActivity,
  appWaitPackage, appWaitActivity, intentAction, intentCategory, intentFlags,
  optionalIntentArguments, dontStopAppOnReset) {
  log.debug(`Starting package '${appPackage}' and activity '${appActivity}'`);

  // dontStopAppOnReset is both an argument here, and a desired capability
  // if the argument is set, use it, otherwise use the cap
  if (!util.hasValue(dontStopAppOnReset)) {
    dontStopAppOnReset = !!this.opts.dontStopAppOnReset;
  }

  let args = {
    pkg: appPackage,
    activity: appActivity,
    waitPkg: appWaitPackage || appPackage,
    waitActivity: appWaitActivity || appActivity,
    action: intentAction,
    category: intentCategory,
    flags: intentFlags,
    optionalIntentArguments,
    stopApp: !dontStopAppOnReset
  };
  this._cachedActivityArgs = this._cachedActivityArgs || {};
  this._cachedActivityArgs[`${args.waitPkg}/${args.waitActivity}`] = args;
  await this.adb.startApp(args);
};

commands.reset = async function reset () {
  await androidHelpers.resetApp(this.adb, Object.assign({}, this.opts, {fastReset: true}));
  // reset context since we don't know what kind on context we will end up after app launch.
  await this.setContext();
  return await this.isChromeSession ? this.startChromeSession() : this.startAUT();
};

commands.startAUT = async function startAUT () {
  await this.adb.startApp({
    pkg: this.opts.appPackage,
    activity: this.opts.appActivity,
    action: this.opts.intentAction,
    category: this.opts.intentCategory,
    flags: this.opts.intentFlags,
    waitPkg: this.opts.appWaitPackage,
    waitActivity: this.opts.appWaitActivity,
    waitForLaunch: this.opts.appWaitForLaunch,
    waitDuration: this.opts.appWaitDuration,
    optionalIntentArguments: this.opts.optionalIntentArguments,
    stopApp: !this.opts.dontStopAppOnReset,
    user: this.opts.userProfile,
  });
};

// we override setUrl to take an android URI which can be used for deep-linking
// inside an app, similar to starting an intent
commands.setUrl = async function setUrl (uri) {
  await this.adb.startUri(uri, this.opts.appPackage);
};

// closing app using force stop
commands.closeApp = async function closeApp () {
  await this.adb.forceStop(this.opts.appPackage);
  // reset context since we don't know what kind on context we will end up after app launch.
  await this.setContext();
};

commands.getDisplayDensity = async function getDisplayDensity () {
  // first try the property for devices
  let out = await this.adb.shell(['getprop', 'ro.sf.lcd_density']);
  if (out) {
    let val = parseInt(out, 10);
    // if the value is NaN, try getting the emulator property
    if (!isNaN(val)) {
      return val;
    }
    log.debug(`Parsed density value was NaN: "${out}"`);
  }
  // fallback to trying property for emulators
  out = await this.adb.shell(['getprop', 'qemu.sf.lcd_density']);
  if (out) {
    let val = parseInt(out, 10);
    if (!isNaN(val)) {
      return val;
    }
    log.debug(`Parsed density value was NaN: "${out}"`);
  }
  // couldn't get anything, so error out
  log.errorAndThrow('Failed to get display density property.');
};

/**
 * Parses the given window manager Surface string to get info.
 * @param line: To parse. This is assumed to be valid.
 * @return: Visibility and bounds of the Surface.
 */
function parseSurfaceLine (line) {
  // the surface bounds are in the format:
  // "rect=(0.0,1184.0) 768.0 x 96.0"
  //       ^ location   ^ size
  // cut out the stuff before the 'rect' and then split the numbers apart
  let bounds = line.split('rect=')[1]
  .replace(/[(), x]+/g, ' ')
  .trim()
  .split(' ');

  return {
    visible: (line.indexOf('shown=true') !== -1),
    x: parseFloat(bounds[0]),
    y: parseFloat(bounds[1]),
    width: parseFloat(bounds[2]),
    height: parseFloat(bounds[3])
  };
}

/**
 * Extracts status and navigation bar information from the window manager output.
 * @param lines: Output from dumpsys command
 * @return: Visibility and bounds info of status and navigation bar
 */
function parseWindows (lines) {
  let atStatusBar = false;
  let atNavBar = false;
  let statusBar;
  let navigationBar;
  // the window manager output looks like:
  // Window #1 ... WindowID
  //   A bunch of properties
  // Window #2 ... WindowID
  //   A bunch of properties
  lines.split('\n').forEach((line) => {
    // the start of a new window section
    if (line.indexOf('  Window #') !== -1) {
      // determine which section we're in
      // only one will be true
      atStatusBar = (line.indexOf('StatusBar') !== -1);
      atNavBar = (line.indexOf('NavigationBar') !== -1);
      // don't need anything else. move to next line
      return;
    }
    // once we're in a window section, look for the surface data line
    if (line.indexOf('      Surface:') === -1) {
      return;
    }
    if (atStatusBar) {
      statusBar = parseSurfaceLine(line);
      atStatusBar = false;
    } else if (atNavBar) {
      navigationBar = parseSurfaceLine(line);
      atNavBar = false;
    }
  });

  if (!statusBar) {
    log.errorAndThrow('Failed to parse status bar information.');
  }
  if (!navigationBar) {
    log.errorAndThrow('Failed to parse navigation bar information.');
  }

  return {statusBar, navigationBar};
}

commands.getSystemBars = async function getSystemBars () {
  let out = await this.adb.shell(['dumpsys', 'window', 'windows']);
  if (!out) {
    log.errorAndThrow('Did not get window manager output.');
  }
  return parseWindows(out);
};

commands.mobilePerformEditorAction = async function mobilePerformEditorAction (opts = {}) {
  const {action} = opts;
  if (!util.hasValue(action)) {
    log.errorAndThrow(`'action' argument is required`);
  }

  await this.adb.performEditorAction(action);
};

const PERMISSION_ACTION = {
  GRANT: 'grant',
  REVOKE: 'revoke',
};

/**
 * @typedef {Object} ChangePermissionsOptions
 * @property {!string|Array<string>} permissions - The full name of the permission to be changed
 * or a list of permissions. Mandatory argument.
 * @property {string} appPackage [this.opts.appPackage] - The application package to set change
 * permissions on. Defaults to the package name under test.
 * @property {string} action [grant] - One of `PERMISSION_ACTION` values
 */

/**
 * Changes package permissions in runtime.
 *
 * @param {?ChangePermissionsOptions} opts - Available options mapping.
 * @throws {Error} if there was a failure while changing permissions
 */
commands.mobileChangePermissions = async function mobileChangePermissions (opts = {}) {
  const {
    permissions,
    appPackage = this.opts.appPackage,
    action = PERMISSION_ACTION.GRANT,
  } = opts;
  if (!util.hasValue(permissions)) {
    log.errorAndThrow(`'permissions' argument is required`);
  }

  let actionFunc;
  switch (_.toLower(action)) {
    case PERMISSION_ACTION.GRANT:
      actionFunc = (appPackage, permission) => this.adb.grantPermission(appPackage, permission);
      break;
    case PERMISSION_ACTION.REVOKE:
      actionFunc = (appPackage, permission) => this.adb.revokePermission(appPackage, permission);
      break;
    default:
      log.errorAndThrow(`Unknown action '${action}'. ` +
        `Only ${JSON.stringify(_.values(PERMISSION_ACTION))} actions are supported`);
      break;
  }
  for (const permission of (_.isArray(permissions) ? permissions : [permissions])) {
    await actionFunc(appPackage, permission);
  }
};

const PERMISSIONS_TYPE = {
  DENIED: 'denied',
  GRANTED: 'granted',
  REQUESTED: 'requested',
};

/**
 * @typedef {Object} GetPermissionsOptions
 * @property {string} type [requested] - One of possible permission types to get.
 * Can be any of `PERMISSIONS_TYPE` values.
 * @property {string} appPackage [this.opts.appPackage] - The application package to set change
 * permissions on. Defaults to the package name under test.
 */

/**
 * Gets runtime permissions list for the given application package.
 *
 * @param {GetPermissionsOptions} opts - Available options mapping.
 * @returns {Array<string>} The list of retrieved permissions for the given type
 * (can also be empty).
 * @throws {Error} if there was an error while getting permissions.
 */
commands.mobileGetPermissions = async function mobileGetPermissions (opts = {}) {
  const {
    type = PERMISSIONS_TYPE.REQUESTED,
    appPackage = this.opts.appPackage,
  } = opts;

  let actionFunc;
  switch (_.toLower(type)) {
    case PERMISSIONS_TYPE.REQUESTED:
      actionFunc = (appPackage) => this.adb.getReqPermissions(appPackage);
      break;
    case PERMISSIONS_TYPE.GRANTED:
      actionFunc = (appPackage) => this.adb.getGrantedPermissions(appPackage);
      break;
    case PERMISSIONS_TYPE.DENIED:
      actionFunc = (appPackage) => this.adb.getDeniedPermissions(appPackage);
      break;
    default:
      log.errorAndThrow(`Unknown permissions type '${type}'. ` +
        `Only ${JSON.stringify(_.values(PERMISSIONS_TYPE))} types are supported`);
      break;
  }
  return await actionFunc(appPackage);
};

/**
 * Retrieves the list of recent system notifications.
 *
 * @returns {Object} See the documentation on `adb.getNotifications` for
 * more details
 */
commands.mobileGetNotifications = async function mobileGetNotifications () {
  return await this.adb.getNotifications();
};

/**
 * @typedef {Object} SmsListOptions
 * @property {number} max [100] - The maximum count of recent SMS messages
 * to retrieve
 */

/**
 * Retrieves the list of recent SMS messages with their properties.
 *
 * @param {SmsListOptions} opts
 * @returns {Object} See the documentation on `adb.getSmsList` for
 * more details
 */
commands.mobileListSms = async function mobileListSms (opts = {}) {
  return await this.adb.getSmsList(opts);
};

/**
 * @typedef {Object} UnlockOptions
 * @property {string} key The unlock key. The value of this key depends
 * on the actual unlock type and could be a pin/password/pattern value or
 * a biometric finger id.
 * @property {string} type The unlock type. The following unlock types
 * are supported: `pin`, `pinWithKeyEvent`, `password`, `pattern` and `fingerprint`.
 * @property {?string} strategy Either 'locksettings' (default) or 'uiautomator'.
 * Setting it to 'uiautomator' will enforce the driver to avoid using special
 * ADB shortcuts in order to speed up the unlock procedure.
 * @property {?number} timeoutMs [2000] The maximum time in milliseconds
 * to wait until the screen gets unlocked
 */

/**
 * Unlocks the device if it is locked. Noop if the device's screen is not locked.
 *
 * @param {?UnlockOptions} opts
 * @throws {Error} if unlock operation fails or the provided
 * arguments are not valid
 */
commands.mobileUnlock = async function mobileUnlock (opts = {}) {
  const { key, type, strategy, timeoutMs } = opts;
  await androidHelpers.unlock(this, this.adb, {
    unlockKey: key,
    unlockType: type,
    unlockStrategy: strategy,
    unlockSuccessTimeout: timeoutMs,
  });
};

Object.assign(extensions, commands, helpers);
export { commands, helpers };
export default extensions;
// for unit tests
export { parseWindows, parseSurfaceLine };
