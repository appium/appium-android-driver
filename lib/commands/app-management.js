import { waitForCondition } from 'asyncbox';
import { util } from 'appium-support';
import log from '../logger';
import { APP_STATE } from '../android-helpers';
import { errors } from 'appium-base-driver';

const APP_EXTENSIONS = ['.apk', '.apks'];

let commands = {};

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
  log.info(`Querying the state of '${appId}'`);
  if (!await this.adb.isAppInstalled(appId)) {
    return APP_STATE.NOT_INSTALLED;
  }
  if (!await this.adb.processExists(appId)) {
    return APP_STATE.NOT_RUNNING;
  }
  for (const line of (await this.adb.dumpWindows()).split('\n')) {
    if (line.includes(appId) && (line.includes('mCurrentFocus') || line.includes('mFocusedApp'))) {
      return APP_STATE.RUNNING_IN_FOREGROUND;
    }
  }
  return APP_STATE.RUNNING_IN_BACKGROUND;
};

/**
 * Activates the given application or launches it if necessary.
 * The action is done with monkey tool and literally simulates
 * clicking the corresponding application icon on the dashboard.
 *
 * @param {string} appId - Application package identifier
 */
commands.activateApp = async function activateApp (appId) {
  const cmd = ['monkey',
    '-p', appId,
    '-c', 'android.intent.category.LAUNCHER',
    '1'];
  let output = '';
  try {
    log.debug(`Activating '${appId}' with 'adb shell ${cmd.join(' ')}' command`);
    output = await this.adb.shell(cmd);
    log.debug(`Command stdout: ${output}`);
  } catch (e) {
    log.errorAndThrow(`Cannot activate '${appId}'. Original error: ${e.message}`);
  }
  if (output.includes('monkey aborted')) {
    log.errorAndThrow(`Cannot activate '${appId}'. Are you sure it is installed?`);
  }
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
 * @typedef {Object} TerminateOptions
 * @property {number|string} timeout [500] - The count of milliseconds to wait until the
 *                                           app is terminated.
 */

/**
 * Terminates the app if it is running.
 *
 * @param {string} appId - Application package identifier
 * @param {?TerminateOptions} options - The set of application termination options
 * @returns {boolean} True if the app has been successfully terminated.
 * @throws {Error} if the app has not been terminated within the given timeout.
 */
commands.terminateApp = async function terminateApp (appId, options = {}) {
  log.info(`Terminating '${appId}'`);
  if (!(await this.adb.processExists(appId))) {
    log.info(`The app '${appId}' is not running`);
    return false;
  }
  await this.adb.forceStop(appId);
  const timeout = util.hasValue(options.timeout) && !isNaN(options.timeout) ? parseInt(options.timeout, 10) : 500;
  try {
    await waitForCondition(async () => await this.queryAppState(appId) <= APP_STATE.NOT_RUNNING,
                           {waitMs: timeout, intervalMs: 100});
  } catch (e) {
    log.errorAndThrow(`'${appId}' is still running after ${timeout}ms timeout`);
  }
  log.info(`'${appId}' has been successfully terminated`);
  return true;
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
