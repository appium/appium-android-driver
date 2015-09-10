import _ from 'lodash';
import androidHelpers from '../android-helpers';
import { fs } from 'appium-support';
import B from 'bluebird';
//import { errors } from 'mobile-json-wire-protocol';
import log from '../logger';

let commands = {}, helpers = {}, extensions = {};

const logTypesSupported = {
  'logcat' : 'Logs for Android applications on real device and emulators ' +
             'via ADB'
};

commands.keys = async function (keys) {
  // Protocol sends an array; rethink approach
  keys = keys.join('');
  let params = {
    text: keys,
    replace: false
  };
  if (this.opts.unicodeKeyboard) {
    params.unicodeKeyboard = true;
  }
  return await this.bootstrap.sendAction('setText', params);
};

commands.getPageSource = function () {
  return this.bootstrap.sendAction('source');
};

commands.back = function () {
  return this.bootstrap.sendAction('pressBack');
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
      throw new Error(`Unsupported log type ${logType}.` +
                      `supported types are ${JSON.stringify(logTypesSupported)}`);
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
  if (!(await fs.exists(appPath))) {
    log.errorAndThrow(`Could not find app apk at ${appPath}`);
  }

  let {apkPackage} = await this.adb.packageAndLaunchActivityFromManifest(appPath);
  return androidHelpers.installApkRemotely(this.adb, appPath, apkPackage, this.opts.fastReset);
};

commands.background = async function (seconds) {
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
    stopApp: this.opts.stopAppOnReset || !this.opts.dontStopAppOnReset,
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
  await this.pushStrings(language);
  await this.bootstrap.sendAction('updateStrings');

  return this.apkStrings[language];
};

commands.startActivity = async function (appPackage, appActivity) {
  await this.adb.startApp({
    pkg: appPackage,
    activity: appActivity,
    action: this.opts.intentAction,
    category: this.opts.intentCategory,
    flags: this.opts.intentFlags,
    optionalIntentArguments: this.opts.optionalIntentArguments,
    stopApp: this.opts.stopAppOnReset || !this.opts.dontStopAppOnReset,
  });
};

commands.reset = async function () {
  if (this.opts.fastReset) {
    log.info("Running fast reset (stop and clear)");
    await this.adb.stopAndClear(this.opts.appPackage);
  } else {
    log.info("Running old fashion reset (reinstall)");
    await this.adb.stopAndClear(this.opts.appPackage);
    await this.adb.uninstallApk(this.opts.appPackage);
    await androidHelpers.installApkRemotely(this.adb, this.opts.app, this.opts.appPackage, this.opts.fastReset);
  }

  return await this.startAUT();
};

Object.assign(extensions, commands, helpers);
export { commands, helpers };
export default extensions;
