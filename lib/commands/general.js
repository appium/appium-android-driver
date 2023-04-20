import _ from 'lodash';
import androidHelpers from '../android-helpers';
import { util } from '@appium/support';
import moment from 'moment';
import { longSleep } from 'asyncbox';
import { errors } from 'appium/driver';

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
  this.log.debug('Attempting to capture android device date and time. ' +
    `The format specifier is '${format}'`);
  const deviceTimestamp = (await this.adb.shell(['date', '+%Y-%m-%dT%T%z'])).trim();
  this.log.debug(`Got device timestamp: ${deviceTimestamp}`);
  const parsedTimestamp = moment.utc(deviceTimestamp, 'YYYY-MM-DDTHH:mm:ssZZ');
  if (!parsedTimestamp.isValid()) {
    this.log.warn('Cannot parse the returned timestamp. Returning as is');
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
    this.log.debug(`Waited ${waitSecs}s so far (${progressPct}%)`);
  };
  await longSleep(sleepMs, {thresholdMs, intervalMs, progressCb});

  let args;
  if (this._cachedActivityArgs && this._cachedActivityArgs[`${appPackage}/${appActivity}`]) {
    // the activity was started with `startActivity`, so use those args to restart
    args = this._cachedActivityArgs[`${appPackage}/${appActivity}`];
  } else {
    try {
      this.log.debug(`Activating app '${appPackage}' in order to restore it`);
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
  this.log.debug(`Bringing application back to foreground with arguments: ${JSON.stringify(args)}`);
  return await this.adb.startApp(args);
};

commands.getStrings = async function getStrings (language) {
  if (!language) {
    language = await this.adb.getDeviceLanguage();
    this.log.info(`No language specified, returning strings for: ${language}`);
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
  this.log.debug(`Starting package '${appPackage}' and activity '${appActivity}'`);

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
    this.log.debug(`Parsed density value was NaN: "${out}"`);
  }
  // fallback to trying property for emulators
  out = await this.adb.shell(['getprop', 'qemu.sf.lcd_density']);
  if (out) {
    let val = parseInt(out, 10);
    if (!isNaN(val)) {
      return val;
    }
    this.log.debug(`Parsed density value was NaN: "${out}"`);
  }
  // couldn't get anything, so error out
  this.log.errorAndThrow('Failed to get display density property.');
};

commands.mobilePerformEditorAction = async function mobilePerformEditorAction (opts = {}) {
  const {action} = opts;
  if (!util.hasValue(action)) {
    throw new errors.InvalidArgumentError(`'action' argument is required`);
  }

  await this.adb.performEditorAction(action);
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
 * @property {string?} key The unlock key. The value of this key depends
 * on the actual unlock type and could be a pin/password/pattern value or
 * a biometric finger id.
 * If not provided then the corresponding value from session capabilities is used.
 * @property {string?} type The unlock type. The following unlock types
 * are supported: `pin`, `pinWithKeyEvent`, `password`, `pattern` and `fingerprint`.
 * If not provided then the corresponding value from session capabilities is used.
 * @property {string?} strategy Either 'locksettings' (default) or 'uiautomator'.
 * Setting it to 'uiautomator' will enforce the driver to avoid using special
 * ADB shortcuts in order to speed up the unlock procedure.
 * @property {number?} timeoutMs [2000] The maximum time in milliseconds
 * to wait until the screen gets unlocked
 */

/**
 * Unlocks the device if it is locked. Noop if the device's screen is not locked.
 *
 * @param {UnlockOptions} opts
 * @throws {Error} if unlock operation fails or the provided
 * arguments are not valid
 */
commands.mobileUnlock = async function mobileUnlock (opts = {}) {
  const { key, type, strategy, timeoutMs } = opts;
  if (!key && !type) {
    await this.unlock();
  } else {
    await androidHelpers.unlock(this, this.adb, {
      unlockKey: key,
      unlockType: type,
      unlockStrategy: strategy,
      unlockSuccessTimeout: timeoutMs,
    });
  }
};

Object.assign(extensions, commands, helpers);
export { commands, helpers };
export default extensions;
