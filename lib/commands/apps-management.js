import _ from 'lodash';
import waitForCondition from 'asyncbox';
import {fs, utils} from 'appium-support';
import log from '../logger';

let commands = {};
const APP_STATE_NOT_INSTALLED = 0;
const APP_STATE_NOT_RUNNING = 1;
const APP_STATE_RUNNING_IN_FOREGROUND = 2;
const APP_STATE_RUNNING_IN_BACKGROUND = 3;


function extractMandatoryOptions (opts = {}, namesList) {
  const result = {};
  for (const name of namesList) {
    if (!utils.hasValue(opts[name])) {
      throw new Error(`'${name}' option is mandatory.`);
    }
    result[name] = opts[name];
  }
  return result;
}

commands.mobileInstallApp = async function (opts = {}) {
  const {app} = extractMandatoryOptions(opts, ['app']);
  const dstPath = await this.helpers.configureApp(app, '.apk');
  log.info(`Installing '${dstPath}' to the device...`);
  if (!await fs.exists(dstPath)) {
    log.errorAndThrow(`The application at '${dstPath}' does not exist or is not accessible`);
  }
  let installArgs = [];
  if (utils.hasValue(opts.installArgs)) {
    installArgs = _.isArray(opts.installArgs) ? opts.installArgs : [opts.installArgs];
  }
  const installTimeout = _.isNumber(opts.installlTimeout) ? parseInt(opts.installlTimeout, 10) : 2 * 60 * 1000;
  try {
    await this.adbExec(['install', ...installArgs, dstPath], {timeout: installTimeout});
    log.info(`Installation of '${dstPath}' succeeded`);
  } finally {
    if (dstPath !== app) {
      await fs.rimraf(dstPath);
    }
  }
};

commands.mobileIsAppInstalled = async function (opts = {}) {
  const {appPackage} = extractMandatoryOptions(opts, ['appPackage']);
  log.info(`Cheking if '${appPackage}' is installed`);
  return await this.adb.isAppInstalled(appPackage);
};

commands.mobileUninstallApp = async function (opts = {}) {
  const {appPackage} = extractMandatoryOptions(opts, ['appPackage']);
  log.info(`Uninstalling '${appPackage}'`);
  await this.adb.uninstallApk(appPackage);
  log.info(`'${appPackage}' has been successfully uninstalled`);
};

commands.mobileQueryAppState =  async function (opts = {}) {
  const {appPackage} = extractMandatoryOptions(opts, ['appPackage']);
  log.info(`Querying the state of  '${appPackage}'`);
  if (!await this.adb.isAppInstalled(appPackage)) {
    return APP_STATE_NOT_INSTALLED;
  }
  if (!await this.adb.processExists(appPackage)) {
    return APP_STATE_NOT_RUNNING;
  }
  const output = await this.adb.shell(['dumpsys', 'window', 'windows']);
  for (const line of output.split('\n')) {
    if (line.includes(appPackage) && (line.includes('mCurrentFocus') || line.includes('mFocusedApp'))) {
      return APP_STATE_RUNNING_IN_FOREGROUND;
    }
  }
  return APP_STATE_RUNNING_IN_BACKGROUND;
};

commands.mobileTerminateApp =  async function (opts = {}) {
  const {appPackage} = extractMandatoryOptions(opts, ['appPackage']);
  log.info(`Terminating '${appPackage}'`);
  if (await this.adb.processExists(appPackage)) {
    log.info(`The app '${appPackage}' is not running`);
    return false;
  }
  await this.adb.forceStop(appPackage);
  const timeout = _.isNumber(opts.timeout) ? parseInt(opts.timeout, 10) : 500;
  await waitForCondition(async () => await this.mobileQueryAppState(opts) < APP_STATE_RUNNING_IN_FOREGROUND,
                          {waitMs: timeout, intervalMs: 100});
  log.info(`'${appPackage}' has been terminated`);
  return true;
};


export { commands };
export default commands;
