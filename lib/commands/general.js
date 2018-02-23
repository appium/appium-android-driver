import _ from 'lodash';
import androidHelpers from '../android-helpers';
import { util } from 'appium-support';
import B from 'bluebird';
import log from '../logger';
import { NATIVE_WIN } from '../webview-helpers';


let commands = {}, helpers = {}, extensions = {};

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

commands.doSendKeys = async function (params) {
  return await this.bootstrap.sendAction('setText', params);
};

commands.getDeviceTime = async function () {
  log.info('Attempting to capture android device date and time');
  try {
    let out = await this.adb.shell(['date']);
    return out.trim();
  } catch (err) {
    log.errorAndThrow(`Could not capture device date and time: ${err}`);
  }
};

commands.getPageSource = async function () {
  return await this.bootstrap.sendAction('source');
};

commands.back = async function () {
  return await this.bootstrap.sendAction('pressBack');
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

commands.getWindowSize = async function () {
  return await this.bootstrap.sendAction('getDeviceSize');
};

// For W3C
commands.getWindowRect = async function () {
  const { width, height } = await this.getWindowSize();
  return {
    width,
    height,
    x: 0,
    y: 0
  };
};

commands.getCurrentActivity = async function () {
  return (await this.adb.getFocusedPackageAndActivity()).appActivity;
};

commands.getCurrentPackage = async function () {
  return (await this.adb.getFocusedPackageAndActivity()).appPackage;
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

  let args;
  if (this.opts.startActivityArgs && this.opts.startActivityArgs[`${appPackage}/${appActivity}`]) {
    // the activity was started with `startActivity`, so use those args to restart
    args = this.opts.startActivityArgs[`${appPackage}/${appActivity}`];
  } else if ((appPackage === this.opts.appPackage && appActivity === this.opts.appActivity) ||
    (appPackage === this.opts.appWaitPackage &&
      (this.opts.appWaitActivity || '').split(',').includes(appActivity))) {
    // the activity is the original session activity, so use the original args
    args = {
      pkg: this.opts.appPackage,
      activity: this.opts.appActivity,
      action: this.opts.intentAction,
      category: this.opts.intentCategory,
      flags: this.opts.intentFlags,
      waitPkg: this.opts.appWaitPackage,
      waitActivity: this.opts.appWaitActivity,
      optionalIntentArguments: this.opts.optionalIntentArguments,
      stopApp: false,
    };
  } else {
    // the activity was started some other way, so use defaults
    args = {
      pkg: appPackage,
      activity: appActivity,
      waitPkg: appPackage,
      waitActivity: appActivity,
      stopApp: false
    };
  }
  args = await util.filterObject(args);
  log.debug(`Bringing application back to foreground with arguments: ${JSON.stringify(args)}`);
  return await this.adb.startApp(args);
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
  this.opts.startActivityArgs = this.opts.startActivityArgs || {};
  this.opts.startActivityArgs[`${args.waitPkg}/${args.waitActivity}`] = args;
  await this.adb.startApp(args);
};

commands.reset = async function () {
  await androidHelpers.resetApp(this.adb, Object.assign({}, this.opts, {fastReset: true}));
  // reset context since we don't know what kind on context we will end up after app launch.
  this.curContext = NATIVE_WIN;

  return await this.isChromeSession ? this.startChromeSession() : this.startAUT();
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
  // reset context since we don't know what kind on context we will end up after app launch.
  this.curContext = NATIVE_WIN;
  await this.stopChromedriverProxies();
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
