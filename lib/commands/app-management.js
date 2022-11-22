import _ from 'lodash';
import { waitForCondition } from 'asyncbox';
import { util } from '@appium/support';
import { APP_STATE } from '../android-helpers';
import { errors } from 'appium/driver';
import { requireArgs } from '../utils';

const APP_EXTENSIONS = ['.apk', '.apks'];
const RESOLVER_ACTIVITY_NAME = 'android/com.android.internal.app.ResolverActivity';

const commands = {};

/**
 * Verify whether an application is installed or not
 *
 * @param {string} appId - Application package identifier
 * @returns {boolean} true if the app is installed
 */
commands.isAppInstalled = async function isAppInstalled (appId) {
  return await this.adb.isAppInstalled(appId);
};

/**
 * @typedef {Object} MobileAppInstalledOptions
 * @property {string} appId - Application package identifier. Must be always provided.
 */

/**
 * Verify whether an application is installed or not
 *
 * @param {MobileAppInstalledOptions} opts
 * @returns {boolean} Same as in `isAppInstalled`
 */
commands.mobileIsAppInstalled = async function mobileIsAppInstalled (opts = {}) {
  const { appId } = requireArgs('appId', opts);
  return await this.isAppInstalled(appId);
};

/**
 * Queries the current state of the app.
 *
 * @param {string} appId - Application package identifier
 * @returns {number} The corresponding constant, which describes
 *                   the current application state:
 * 0 - is the app is not installed
 * 1 - if the app is installed, but is not running
 * 3 - if the app is running in the background
 * 4 - if the app is running in the foreground
 */
commands.queryAppState = async function queryAppState (appId) {
  this.log.info(`Querying the state of '${appId}'`);
  if (!await this.adb.isAppInstalled(appId)) {
    return APP_STATE.NOT_INSTALLED;
  }
  if (!await this.adb.processExists(appId)) {
    return APP_STATE.NOT_RUNNING;
  }
  const appIdRe = new RegExp(`\\b${_.escapeRegExp(appId)}/`);
  for (const line of (await this.adb.dumpWindows()).split('\n')) {
    if (appIdRe.test(line) && ['mCurrentFocus', 'mFocusedApp'].some((x) => line.includes(x))) {
      return APP_STATE.RUNNING_IN_FOREGROUND;
    }
  }
  return APP_STATE.RUNNING_IN_BACKGROUND;
};

/**
 * @typedef {Object} MobileQueryAppStateOptions
 * @property {string} appId - Application package identifier. Must be always provided.
 */

/**
 * Queries the current state of the app.
 *
 * @param {MobileQueryAppStateOptions} opts
 * @returns {number} Same as in `queryAppState`
 */
commands.mobileQueryAppState = async function mobileQueryAppState (opts = {}) {
  const { appId } = requireArgs('appId', opts);
  return await this.queryAppState(appId);
};

/**
 * Activates the given application or launches it if necessary.
 * The action literally simulates
 * clicking the corresponding application icon on the dashboard.
 *
 * @param {string} appId - Application package identifier
 * @throws {Error} If the app cannot be activated
 */
commands.activateApp = async function activateApp (appId) {
  this.log.debug(`Activating '${appId}'`);
  const apiLevel = await this.adb.getApiLevel();
  // Fallback to Monkey in older APIs
  if (apiLevel < 24) {
    // The monkey command could raise an issue as https://stackoverflow.com/questions/44860475/how-to-use-the-monkey-command-with-an-android-system-that-doesnt-have-physical
    // but '--pct-syskeys 0' could cause another background process issue. https://github.com/appium/appium/issues/16941#issuecomment-1129837285
    const cmd = ['monkey',
      '-p', appId,
      '-c', 'android.intent.category.LAUNCHER',
      '1'];
    let output = '';
    try {
      output = await this.adb.shell(cmd);
      this.log.debug(`Command stdout: ${output}`);
    } catch (e) {
      this.log.errorAndThrow(`Cannot activate '${appId}'. Original error: ${e.message}`);
    }
    if (output.includes('monkey aborted')) {
      this.log.errorAndThrow(`Cannot activate '${appId}'. Are you sure it is installed?`);
    }
    return;
  }

  let activityName = await this.adb.resolveLaunchableActivity(appId);
  if (activityName === RESOLVER_ACTIVITY_NAME) {
    // https://github.com/appium/appium/issues/17128
    this.log.debug(
      `The launchable activity name of '${appId}' was resolved to '${activityName}'. ` +
      `Switching the resolver to not use cmd`
    );
    activityName = await this.adb.resolveLaunchableActivity(appId, {preferCmd: false});
  }

  const stdout = await this.adb.shell([
    'am', (apiLevel < 26) ? 'start' : 'start-activity',
    '-a', 'android.intent.action.MAIN',
    '-c', 'android.intent.category.LAUNCHER',
    // FLAG_ACTIVITY_NEW_TASK | FLAG_ACTIVITY_RESET_TASK_IF_NEEDED
    // https://developer.android.com/reference/android/content/Intent#FLAG_ACTIVITY_NEW_TASK
    // https://developer.android.com/reference/android/content/Intent#FLAG_ACTIVITY_RESET_TASK_IF_NEEDED
    '-f', '0x10200000',
    '-n', activityName,
  ]);
  this.log.debug(stdout);
  if (/^error:/mi.test(stdout)) {
    throw new Error(`Cannot activate '${appId}'. Original error: ${stdout}`);
  }
};

/**
 * @typedef {Object} MobileActivateAppOptions
 * @property {string} appId - Application package identifier. Must be always provided.
 */

/**
 * Activates the given application or launches it if necessary.
 * The action literally simulates
 * clicking the corresponding application icon on the dashboard.
 *
 * @param {MobileActivateAppOptions} opts
 * @throws {Error} If the app cannot be activated
 */
commands.mobileActivateApp = async function mobileActivateApp (opts = {}) {
  const { appId } = requireArgs('appId', opts);
  return await this.activateApp(appId);
};

/**
 * @typedef {Object} UninstallOptions
 * @property {number} timeout [20000] - The count of milliseconds to wait until the
 *                                      app is uninstalled.
 * @property {boolean} keepData [false] - Set to true in order to keep the
 *                                        application data and cache folders after uninstall.
 */

/**
 * Remove the corresponding application if is installed.
 * The call is ignored if the app is not installed.
 *
 * @param {string} appId - Application package identifier
 * @param {?UninstallOptions} options - The set of removal options
 * @returns {boolean} True if the package was found on the device and
 *                    successfully uninstalled.
 */
commands.removeApp = async function removeApp (appId, options = {}) {
  return await this.adb.uninstallApk(appId, options);
};

/**
 * @typedef {Object} MobileRemoveAppOptions
 * @property {string} appId - Application package identifier. Must be always provided.
 */

/**
 * Remove the corresponding application if is installed.
 * The call is ignored if the app is not installed.
 *
 * @param {MobileRemoveAppOptions} opts
 * @returns {boolean} Same as in `removeApp`
 */
commands.mobileRemoveApp = async function mobileRemoveApp (opts = {}) {
  const { appId } = requireArgs('appId', opts);
  return await this.removeApp(appId, opts);
};

/**
 * @typedef {Object} TerminateOptions
 * @property {number|string} timeout [500] - The count of milliseconds to wait until the
 *                                           app is terminated. The method will skip
 *                                           checking the app state check if the timeout
 *                                           was lower or equal to zero. Then, the return
 *                                           value will be true.
 */

/**
 * Terminates the app if it is running. If the given timeout was lower or equal to zero,
 * it returns true after terminating the app without checking the app state.
 *
 * @param {string} appId - Application package identifier
 * @param {?TerminateOptions} options - The set of application termination options
 * @returns {boolean} True if the app has been successfully terminated.
 * @throws {Error} if the app has not been terminated within the given timeout.
 */
commands.terminateApp = async function terminateApp (appId, options = {}) {
  this.log.info(`Terminating '${appId}'`);
  if (!(await this.adb.processExists(appId))) {
    this.log.info(`The app '${appId}' is not running`);
    return false;
  }
  await this.adb.forceStop(appId);
  const timeout = util.hasValue(options.timeout) && !isNaN(options.timeout) ? parseInt(options.timeout, 10) : 500;

  if (timeout <= 0) {
    this.log.info(`'${appId}' has been terminated. Skip checking the application process state ` +
      `since the timeout was set as ${timeout}ms`);
    return true;
  }

  try {
    await waitForCondition(async () => await this.queryAppState(appId) <= APP_STATE.NOT_RUNNING,
      {waitMs: timeout, intervalMs: 100});
  } catch (e) {
    this.log.errorAndThrow(`'${appId}' is still running after ${timeout}ms timeout`);
  }
  this.log.info(`'${appId}' has been successfully terminated`);
  return true;
};

/**
 * @typedef {Object} MobileTerminateAppOptions
 * @property {string} appId - Application package identifier. Must be always provided.
 * @property {number|string} timeout [500] - The count of milliseconds to wait until the
 *                                           app is terminated.
 */

/**
 * Terminates the app if it is running.
 *
 * @param {MobileTerminateAppOptions} opts
 * @returns {boolean} Same as in `terminateApp`
 * @throws {Error} if the app has not been terminated within the given timeout.
 */
commands.mobileTerminateApp = async function mobileTerminateApp (opts = {}) {
  const { appId } = requireArgs('appId', opts);
  return await this.terminateApp(appId, opts);
};

/**
 * @typedef {Object} InstallOptions
 * @property {number} timeout [60000] - The count of milliseconds to wait until the
 *                                      app is installed.
 * @property {boolean} allowTestPackages [false] - Set to true in order to allow test
 *                                                 packages installation.
 * @property {boolean} useSdcard [false] - Set to true to install the app on sdcard
 *                                         instead of the device memory.
 * @property {boolean} grantPermissions [false] - Set to true in order to grant all the
 *                                                permissions requested in the application's manifest
 *                                                automatically after the installation is completed
 *                                                under Android 6+.
 * @property {boolean} replace [true] - Set it to false if you don't want
 *                                      the application to be upgraded/reinstalled
 *                                      if it is already present on the device.
 */

/**
 * Installs the given application to the device under test
 *
 * @param {string} appPath - The local apk path or a remote url
 * @param {?InstallOptions} options - The set of installation options
 * @throws {Error} if the given apk does not exist or is not reachable
 */
commands.installApp = async function installApp (appPath, options = {}) {
  const localPath = await this.helpers.configureApp(appPath, APP_EXTENSIONS);
  await this.adb.install(localPath, options);
};

/**
 * @typedef {Object} MobileInstallAppOptions
 * @property {string} appPath - The local apk path or a remote url. Must be always provided.
 * @property {number} timeout [60000] - The count of milliseconds to wait until the
 *                                      app is installed.
 * @property {boolean} allowTestPackages [false] - Set to true in order to allow test
 *                                                 packages installation.
 * @property {boolean} useSdcard [false] - Set to true to install the app on sdcard
 *                                         instead of the device memory.
 * @property {boolean} grantPermissions [false] - Set to true in order to grant all the
 *                                                permissions requested in the application's manifest
 *                                                automatically after the installation is completed
 *                                                under Android 6+.
 * @property {boolean} replace [true] - Set it to false if you don't want
 *                                      the application to be upgraded/reinstalled
 *                                      if it is already present on the device.
 */

/**
 * Installs the given application to the device under test
 *
 * @param {MobileInstallAppOptions} opts
 * @throws {Error} if the given apk does not exist or is not reachable
 */
commands.mobileInstallApp = async function mobileInstallApp (opts = {}) {
  const { appPath } = requireArgs('appPath', opts);
  return await this.installApp(appPath, opts);
};

/**
 * @typedef {Object} ClearAppOptions
 * @property {!string} appId The identifier of the application package to be cleared
 */

/**
 * Deletes all data associated with a package.
 *
 * @param {ClearAppOptions} opts
 * @throws {Error} If cleaning of the app data fails
 */
commands.mobileClearApp = async function mobileClearApp (opts = {}) {
  const {appId} = opts;
  if (!appId) {
    throw new errors.InvalidArgumentError(`The 'appId' argument is required`);
  }
  await this.adb.clear(appId);
};

export { commands };
export default commands;
