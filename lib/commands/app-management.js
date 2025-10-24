import {util} from '@appium/support';
import {waitForCondition, longSleep} from 'asyncbox';
import _ from 'lodash';
import {EOL} from 'node:os';
import B from 'bluebird';

const APP_EXTENSIONS = ['.apk', '.apks'];
const PACKAGE_INSTALL_TIMEOUT_MS = 90000;
// These constants are in sync with
// https://developer.apple.com/documentation/xctest/xcuiapplicationstate/xcuiapplicationstaterunningbackground?language=objc
export const APP_STATE = /** @type {const}  */ ({
  NOT_INSTALLED: 0,
  NOT_RUNNING: 1,
  RUNNING_IN_BACKGROUND: 3,
  RUNNING_IN_FOREGROUND: 4,
});

/**
 * @typedef {Object} IsAppInstalledOptions
 * @property {string} [user] - The user id
 */

/**
 * @this {AndroidDriver}
 * @param {string} appId
 * @param {IsAppInstalledOptions} [opts={}]
 * @returns {Promise<boolean>}
 */
export async function isAppInstalled(appId, opts = {}) {
  return await this.adb.isAppInstalled(appId, opts);
}

/**
 * @this {AndroidDriver}
 * @param {string} appId Application package identifier
 * @param {string | number} [user] The user ID for which the package is installed.
 * The `current` user id is used by default.
 * @returns {Promise<boolean>}
 */
export async function mobileIsAppInstalled(appId, user) {
  const _opts = {};
  if (util.hasValue(user)) {
    _opts.user = `${user}`;
  }
  return await this.isAppInstalled(appId, _opts);
}

/**
 * @this {AndroidDriver}
 * @param {string} appId Application package identifier
 * @returns {Promise<import('./types').AppState>}
 */
export async function queryAppState(appId) {
  this.log.info(`Querying the state of '${appId}'`);
  if (!(await this.adb.isAppInstalled(appId))) {
    return APP_STATE.NOT_INSTALLED;
  }
  if (!(await this.adb.isAppRunning(appId))) {
    return APP_STATE.NOT_RUNNING;
  }
  const appIdRe = new RegExp(`\\b${_.escapeRegExp(appId)}/`);
  for (const line of (await this.adb.dumpWindows()).split('\n')) {
    if (appIdRe.test(line) && ['mCurrentFocus', 'mFocusedApp'].some((x) => line.includes(x))) {
      return APP_STATE.RUNNING_IN_FOREGROUND;
    }
  }
  return APP_STATE.RUNNING_IN_BACKGROUND;
}

/**
 * @this {AndroidDriver}
 * @param {string} appId Application package identifier
 * @returns {Promise<void>}
 */
export async function activateApp(appId) {
  return await this.adb.activateApp(appId);
}

/**
 * @this {AndroidDriver}
 * @param {string} appId
 * @param {Omit<import('appium-adb').UninstallOptions, 'appId'>} opts
 * @returns {Promise<boolean>}
 */
export async function removeApp(appId, opts = {}) {
  return await this.adb.uninstallApk(appId, opts);
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {string} appId Application package identifier
 * @param {number} [timeout] The count of milliseconds to wait until the
 * app is uninstalled.
 * @param {boolean} [keepData] Set to true in order to keep the
 * application data and cache folders after uninstall.
 * @param {boolean} [skipInstallCheck] Whether to check if the app is installed prior to
 * uninstalling it. By default this is checked.
 * @returns {Promise<boolean>}
 */
export async function mobileRemoveApp(appId, timeout, keepData, skipInstallCheck) {
  return await this.removeApp(appId, {
    timeout,
    keepData,
    skipInstallCheck,
  });
}

/**
 * @this {AndroidDriver}
 * @param {string} appId
 * @param {import('./types').TerminateAppOpts} [options={}]
 * @returns {Promise<boolean>}
 */
export async function terminateApp(appId, options = {}) {
  this.log.info(`Terminating '${appId}'`);
  const pids = await this.adb.listAppProcessIds(appId);
  if (_.isEmpty(pids)) {
    this.log.info(`The app '${appId}' is not running`);
    return false;
  }
  await this.adb.forceStop(appId);
  const timeout =
    util.hasValue(options.timeout) && !Number.isNaN(options.timeout)
      ? parseInt(String(options.timeout), 10)
      : 500;

  if (timeout <= 0) {
    this.log.info(
      `'${appId}' has been terminated. Skipping checking of the application process state ` +
      `since the timeout was set to ${timeout}ms`,
    );
    return true;
  }

  /** @type {number[]} */
  let currentPids = [];
  try {
    await waitForCondition(async () => {
      if (await this.queryAppState(appId) <= APP_STATE.NOT_RUNNING) {
        return true;
      }
      currentPids = await this.adb.listAppProcessIds(appId);
      if (_.isEmpty(currentPids) || _.isEmpty(_.intersection(pids, currentPids))) {
        this.log.info(
          `The application '${appId}' was reported running, ` +
          `although all process ids belonging to it have been changed: ` +
          `(${JSON.stringify(pids)} -> ${JSON.stringify(currentPids)}). ` +
          `Assuming the termination was successful.`
        );
        return true;
      }
      return false;
    }, {
      waitMs: timeout,
      intervalMs: 100,
    });
  } catch {
    if (!_.isEmpty(currentPids) && !_.isEmpty(_.difference(pids, currentPids))) {
      this.log.warn(
        `Some of processes belonging to the '${appId}' applcation are still running ` +
        `after ${timeout}ms (${JSON.stringify(pids)} -> ${JSON.stringify(currentPids)})`
      );
    }
    throw this.log.errorWithException(`'${appId}' is still running after ${timeout}ms timeout`);
  }
  this.log.info(`'${appId}' has been successfully terminated`);
  return true;
}

/**
 * @this {AndroidDriver}
 * @param {string} appId Application package identifier
 * @param {number|string} [timeout] The count of milliseconds to wait until the app is terminated.
 * 500ms by default.
 * @returns {Promise<boolean>}
 */
export async function mobileTerminateApp(appId, timeout) {
  return await this.terminateApp(appId, {
    timeout,
  });
}

/**
 * @this {AndroidDriver}
 * @param {string} appPath
 * @param {Omit<import('appium-adb').InstallOptions, 'appId'>} opts
 * @returns {Promise<void>}
 */
export async function installApp(appPath, opts) {
  const localPath = await this.helpers.configureApp(appPath, APP_EXTENSIONS);
  await this.adb.install(localPath, opts);
}

/**
 * @this {AndroidDriver}
 * @param {string} appPath
 * @param {boolean} [checkVersion]
 * @param {number} [timeout] The count of milliseconds to wait until the app is installed.
 * 20000ms by default.
 * @param {boolean} [allowTestPackages] Set to true in order to allow test packages installation.
 * `false` by default.
 * @param {boolean} [useSdcard] Set to true to install the app on sdcard instead of the device memory.
 * `false` by default.
 * @param {boolean} [grantPermissions] Set to true in order to grant all the
 * permissions requested in the application's manifest automatically after the installation is completed
 * under Android 6+. `false` by default.
 * @param {boolean} [replace] Set it to false if you don't want the application to be upgraded/reinstalled
 * if it is already present on the device. `true` by default.
 * @param {boolean} [noIncremental] Forcefully disables incremental installs if set to `true`.
 * Read https://developer.android.com/preview/features#incremental for more details.
 * `false` by default.
 * @returns {Promise<void>}
 */
export async function mobileInstallApp(
  appPath,
  checkVersion,
  timeout,
  allowTestPackages,
  useSdcard,
  grantPermissions,
  replace,
  noIncremental,
) {
  const opts = {
    timeout,
    allowTestPackages,
    useSdcard,
    grantPermissions,
    replace,
    noIncremental,
  };
  if (checkVersion) {
    const localPath = await this.helpers.configureApp(appPath, APP_EXTENSIONS);
    await this.adb.installOrUpgrade(localPath, null, {
      ...opts,
      enforceCurrentBuild: false,
    });
    return;
  }

  return await this.installApp(appPath, opts);
}

/**
 * @this {AndroidDriver}
 * @param {string} appId Application package identifier
 * @returns {Promise<void>}
 */
export async function mobileClearApp(appId) {
  await this.adb.clear(appId);
}

/**
 * @this {AndroidDriver}
 * @returns {Promise<string>}
 */
export async function getCurrentActivity() {
  return /** @type {string} */ ((await this.adb.getFocusedPackageAndActivity()).appActivity);
}

/**
 * @this {AndroidDriver}
 * @returns {Promise<string>}
 */
export async function getCurrentPackage() {
  return /** @type {string} */ ((await this.adb.getFocusedPackageAndActivity()).appPackage);
}

/**
 * @this {AndroidDriver}
 * @param {number} seconds
 * @returns {Promise<string|true>}
 */
export async function background(seconds) {
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
  const intervalMs = _.min([30 * 1000, parseInt(String(sleepMs / 100), 10)]);
  /**
   *
   * @param {{elapsedMs: number, progress: number}} param0
   */
  const progressCb = ({elapsedMs, progress}) => {
    const waitSecs = (elapsedMs / 1000).toFixed(0);
    const progressPct = (progress * 100).toFixed(2);
    this.log.debug(`Waited ${waitSecs}s so far (${progressPct}%)`);
  };
  await longSleep(sleepMs, {thresholdMs, intervalMs, progressCb});

  /** @type {import('appium-adb').StartAppOptions} */
  let args;
  if (this._cachedActivityArgs?.[`${appPackage}/${appActivity}`]) {
    // the activity was started with `startActivity`, so use those args to restart
    args = this._cachedActivityArgs[`${appPackage}/${appActivity}`];
  } else {
    try {
      this.log.debug(`Activating app '${appPackage}' in order to restore it`);
      await this.adb.activateApp(/** @type {string} */ (appPackage));
      return true;
    } catch {}
    args =
      (appPackage === this.opts.appPackage && appActivity === this.opts.appActivity) ||
      (appPackage === this.opts.appWaitPackage &&
        (this.opts.appWaitActivity || '').split(',').includes(String(appActivity)))
        ? {
            // the activity is the original session activity, so use the original args
            pkg: /** @type {string} */ (this.opts.appPackage),
            activity: this.opts.appActivity ?? undefined,
            action: this.opts.intentAction,
            category: this.opts.intentCategory,
            flags: this.opts.intentFlags,
            waitPkg: this.opts.appWaitPackage ?? undefined,
            waitActivity: this.opts.appWaitActivity ?? undefined,
            waitForLaunch: this.opts.appWaitForLaunch,
            waitDuration: this.opts.appWaitDuration,
            optionalIntentArguments: this.opts.optionalIntentArguments,
            stopApp: false,
            user: this.opts.userProfile,
          }
        : {
            // the activity was started some other way, so use defaults
            pkg: /** @type {string} */ (appPackage),
            activity: appActivity ?? undefined,
            waitPkg: appPackage ?? undefined,
            waitActivity: appActivity ?? undefined,
            stopApp: false,
          };
  }
  args = /** @type {import('appium-adb').StartAppOptions} */ (
    _.pickBy(args, (value) => !_.isUndefined(value))
  );
  this.log.debug(`Bringing application back to foreground with arguments: ${JSON.stringify(args)}`);
  return await this.adb.startApp(args);
}

/**
 * Puts the app to background and waits the given number of seconds then restores the app
 * if necessary. The call is blocking.
 *
 * @this {AndroidDriver}
 * @param {number} [seconds=-1] The amount of seconds to wait between putting the app to background and restoring it.
 * Any negative value means to not restore the app after putting it to background.
 * @returns {Promise<void>}
 */
export async function mobileBackgroundApp (seconds = -1) {
  await this.background(seconds);
}

/**
 * @this {AndroidDriver}
 * @param {import('../driver').AndroidDriverOpts?} [opts=null]
 * @returns {Promise<void>}
 */
export async function resetAUT(opts = null) {
  const {
    app,
    appPackage,
    fastReset,
    fullReset,
    androidInstallTimeout = PACKAGE_INSTALL_TIMEOUT_MS,
    autoGrantPermissions,
    allowTestPackages,
  } = opts ?? this.opts;

  if (!appPackage) {
    throw new Error("'appPackage' option is required");
  }

  const isInstalled = await this.adb.isAppInstalled(appPackage);

  if (isInstalled) {
    try {
      await this.adb.forceStop(appPackage);
    } catch {}
    // fullReset has priority over fastReset
    if (!fullReset && fastReset) {
      const output = await this.adb.clear(appPackage);
      if (_.isString(output) && output.toLowerCase().includes('failed')) {
        throw new Error(
          `Cannot clear the application data of '${appPackage}'. Original error: ${output}`,
        );
      }
      // executing `shell pm clear` resets previously assigned application permissions as well
      if (autoGrantPermissions) {
        try {
          await this.adb.grantAllPermissions(appPackage);
        } catch (error) {
          this.log.error(`Unable to grant permissions requested. Original error: ${error.message}`);
        }
      }
      this.log.debug(
        `Performed fast reset on the installed '${appPackage}' application (stop and clear)`,
      );
      return;
    }
  }

  if (!app) {
    throw new Error(
      `Either provide 'app' option to install '${appPackage}' or ` +
        `consider setting 'noReset' to 'true' if '${appPackage}' is supposed to be preinstalled.`,
    );
  }

  this.log.debug(`Running full reset on '${appPackage}' (reinstall)`);
  if (isInstalled) {
    await this.adb.uninstallApk(appPackage);
  }
  await this.adb.install(app, {
    grantPermissions: autoGrantPermissions,
    timeout: androidInstallTimeout,
    allowTestPackages,
  });
}

/**
 * @this {AndroidDriver}
 * @param {import('../driver').AndroidDriverOpts?} [opts=null]
 * @returns {Promise<void>}
 */
export async function installAUT(opts = null) {
  const {
    app,
    appPackage,
    fastReset,
    fullReset,
    androidInstallTimeout = PACKAGE_INSTALL_TIMEOUT_MS,
    autoGrantPermissions,
    allowTestPackages,
    enforceAppInstall,
  } = opts ?? this.opts;

  if (!app || !appPackage) {
    throw new Error("'app' and 'appPackage' options are required");
  }

  if (fullReset) {
    await this.resetAUT(opts);
    return;
  }

  const {appState, wasUninstalled} = await this.adb.installOrUpgrade(app, appPackage, {
    grantPermissions: autoGrantPermissions,
    timeout: androidInstallTimeout,
    allowTestPackages,
    enforceCurrentBuild: enforceAppInstall,
  });

  // There is no need to reset the newly installed app
  const isInstalledOverExistingApp =
    !wasUninstalled && appState !== this.adb.APP_INSTALL_STATE.NOT_INSTALLED;
  if (fastReset && isInstalledOverExistingApp) {
    this.log.info(`Performing fast reset on '${appPackage}'`);
    await this.resetAUT(opts);
  }
}

/**
 * @this {AndroidDriver}
 * @param {string[]} otherApps
 * @param {import('../driver').AndroidDriverOpts?} [opts=null]
 * @returns {Promise<void>}
 */
export async function installOtherApks(otherApps, opts = null) {
  const {
    androidInstallTimeout = PACKAGE_INSTALL_TIMEOUT_MS,
    autoGrantPermissions,
    allowTestPackages,
  } = opts ?? this.opts;

  // Install all of the APK's asynchronously
  await B.all(
    otherApps.map((otherApp) => {
      this.log.debug(`Installing app: ${otherApp}`);
      return this.adb.installOrUpgrade(otherApp, undefined, {
        grantPermissions: autoGrantPermissions,
        timeout: androidInstallTimeout,
        allowTestPackages,
      });
    }),
  );
}

/**
 * @this {AndroidDriver}
 * @param {string[]} appPackages
 * @param {string[]} [filterPackages=[]]
 * @returns {Promise<void>}
 */
export async function uninstallOtherPackages(appPackages, filterPackages = []) {
  if (appPackages.includes('*')) {
    this.log.debug('Uninstall third party packages');
    appPackages = await getThirdPartyPackages.bind(this)(filterPackages);
  }

  this.log.debug(`Uninstalling packages: ${appPackages}`);
  await B.all(appPackages.map((appPackage) => this.adb.uninstallApk(appPackage)));
}

/**
 * @this {AndroidDriver}
 * @param {string[]} [filterPackages=[]]
 * @returns {Promise<string[]>}
 */
export async function getThirdPartyPackages(filterPackages = []) {
  try {
    const packagesString = await this.adb.shell(['pm', 'list', 'packages', '-3']);
    const appPackagesArray = packagesString
      .trim()
      .replace(/package:/g, '')
      .split(EOL);
    this.log.debug(`'${appPackagesArray}' filtered with '${filterPackages}'`);
    return _.difference(appPackagesArray, filterPackages);
  } catch (err) {
    this.log.warn(`Unable to get packages with 'adb shell pm list packages -3': ${err.message}`);
    return [];
  }
}

/**
 * @typedef {import('../driver').AndroidDriver} AndroidDriver
 */
