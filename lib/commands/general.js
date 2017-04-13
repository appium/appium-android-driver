import _ from 'lodash';
import androidHelpers from '../android-helpers';
import { fs, util } from 'appium-support';
import B from 'bluebird';
import log from '../logger';

const APP_EXTENSION = '.apk';

let commands = {}, helpers = {}, extensions = {};

const logTypesSupported = {
  'logcat' : 'Logs for Android applications on real device and emulators via ADB'
};

commands.keys = async function (keys) {
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

commands.doSendKeys = async function(params) {
  return await this.bootstrap.sendAction('setText', params);
};

commands.getDeviceTime = async function() {
  log.info('Attempting to capture android device date and time');
  try {
    let out = await this.adb.shell(['date']);
    return out.trim();
  } catch (err) {
    log.errorAndThrow(`Could not capture device date and time: ${err}`);
  }
};

commands.getPageSource = function () {
  return this.bootstrap.sendAction('source');
};

commands.back = function () {
  return this.bootstrap.sendAction('pressBack');
};

commands.isKeyboardShown = async function () {
  let keyboardInfo = await this.adb.isSoftKeyboardPresent();
  return keyboardInfo.isKeyboardShown;
};

commands.hideKeyboard = async function () {
  let {isKeyboardShown, canCloseKeyboard} = await this.adb.isSoftKeyboardPresent();
  if (!isKeyboardShown) {
    throw new Error("Soft keyboard not present, cannot hide keyboard");
  }

  if (canCloseKeyboard) {
    return this.back();
  } else {
    log.info("Keyboard has no UI; no closing necessary");
  }
};

commands.openSettingsActivity = async function (setting) {
  let {appPackage, appActivity} = await this.adb.getFocusedPackageAndActivity();
  await this.adb.shell(['am', 'start', '-a', `android.settings.${setting}`]);
  await this.adb.waitForNotActivity(appPackage, appActivity, 5000);
};

commands.getWindowSize = function () {
  return this.bootstrap.sendAction('getDeviceSize');
};

commands.getCurrentActivity = async function () {
  return (await this.adb.getFocusedPackageAndActivity()).appActivity;
};

commands.getLogTypes = function () {
  return _.keys(logTypesSupported);
};

commands.getLog = function (logType) {
  if (!_.has(logTypesSupported, logType)) {
    throw new Error(`Unsupported log type ${logType}. ` +
                    `Supported types are ${JSON.stringify(logTypesSupported)}`);
  }

  if (logType === 'logcat') {
    return this.adb.getLogcatLogs();
  }
};

commands.isAppInstalled = function (appPackage) {
  return this.adb.isAppInstalled(appPackage);
};

commands.removeApp = function (appPackage) {
  return this.adb.uninstallApk(appPackage);
};

commands.installApp = async function (appPath) {
  appPath = await this.helpers.configureApp(appPath, APP_EXTENSION);
  if (!(await fs.exists(appPath))) {
    log.errorAndThrow(`Could not find app apk at ${appPath}`);
  }

  let {apkPackage} = await this.adb.packageAndLaunchActivityFromManifest(appPath);
  let opts = {
    app: appPath,
    appPackage: apkPackage,
    fastReset: this.opts.fastReset
  };
  return androidHelpers.installApkRemotely(this.adb, opts);
};

commands.background = async function (seconds) {
  if (seconds < 0) {
    // if user passes in a negative seconds value, interpret that as the instruction
    // to not bring the app back at all
    await this.adb.goToHome();
    return true;
  }
  let {appPackage, appActivity} = await this.adb.getFocusedPackageAndActivity();
  await this.adb.goToHome();
  await B.delay(seconds * 1000);
  return this.adb.startApp({
    pkg: this.opts.appPackage,
    activity: this.opts.appActivity,
    action: this.opts.intentAction,
    category: this.opts.intentCategory,
    flags: this.opts.intentFlags,
    waitPkg: appPackage,
    waitActivity: appActivity,
    optionalIntentArguments: this.opts.optionalIntentArguments,
    stopApp: false
  });
};

commands.getStrings = async function (language) {
  if (!language) {
    language = await this.adb.getDeviceLanguage();
    log.info(`No language specified, returning strings for: ${language}`);
  }

  if (this.apkStrings[language]) {
    // Return cached strings
    return this.apkStrings[language];
  }

  // TODO: This is mutating the current language, but it's how appium currently works
  this.apkStrings[language] = await androidHelpers.pushStrings(language, this.adb, this.opts);
  await this.bootstrap.sendAction('updateStrings');

  return this.apkStrings[language];
};

commands.launchApp = async function () {
  await this.initAUT();
  await this.startAUT();
};

commands.startActivity = async function (appPackage, appActivity,
                                         appWaitPackage, appWaitActivity,
                                         intentAction, intentCategory,
                                         intentFlags, optionalIntentArguments,
                                         dontStopAppOnReset) {
  log.debug(`Starting package '${appPackage}' and activity '${appActivity}'`);

  // dontStopAppOnReset is both an argument here, and a desired capability
  // if the argument is set, use it, otherwise use the cap
  if (!util.hasValue(dontStopAppOnReset)) {
    dontStopAppOnReset = !!this.opts.dontStopAppOnReset;
  }

  await this.adb.startApp({
    pkg: appPackage,
    activity: appActivity,
    waitPkg: appWaitPackage || appPackage,
    waitActivity: appWaitActivity || appActivity,
    action: intentAction,
    category: intentCategory,
    flags: intentFlags,
    optionalIntentArguments,
    stopApp: !dontStopAppOnReset
  });
};

commands.reset = async function () {
  if (this.opts.fullReset) {
    log.info("Running old fashion reset (reinstall)");
    await this.adb.stopAndClear(this.opts.appPackage);
    await this.adb.uninstallApk(this.opts.appPackage);
    await androidHelpers.installApkRemotely(this.adb, this.opts);
  } else {
    log.info("Running fast reset (stop and clear)");
    await this.adb.stopAndClear(this.opts.appPackage);
  }

  await this.grantPermissions();

  return await this.startAUT();
};

commands.startAUT = async function () {
  await this.adb.startApp({
    pkg: this.opts.appPackage,
    activity: this.opts.appActivity,
    action: this.opts.intentAction,
    category: this.opts.intentCategory,
    flags: this.opts.intentFlags,
    waitPkg: this.opts.appWaitPackage,
    waitActivity: this.opts.appWaitActivity,
    waitDuration: this.opts.appWaitDuration,
    optionalIntentArguments: this.opts.optionalIntentArguments,
    stopApp: !this.opts.dontStopAppOnReset
  });
};

// we override setUrl to take an android URI which can be used for deep-linking
// inside an app, similar to starting an intent
commands.setUrl = async function (uri) {
  await this.adb.startUri(uri, this.opts.appPackage);
};

// closing app using force stop
commands.closeApp = async function () {
  await this.adb.forceStop(this.opts.appPackage);
};

commands.getDisplayDensity = async function () {
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
  .replace(/[\(\), x]+/g, ' ')
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

commands.getSystemBars = async function () {
  let out = await this.adb.shell(['dumpsys', 'window', 'windows']);
  if (!out) {
    log.errorAndThrow('Did not get window manager output.');
  }
  return parseWindows(out);
};

Object.assign(extensions, commands, helpers);
export { commands, helpers };
export default extensions;
// for unit tests
export { parseWindows, parseSurfaceLine };
