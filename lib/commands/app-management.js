import {util} from '@appium/support';
import {waitForCondition, longSleep} from 'asyncbox';
import _ from 'lodash';
import {requireArgs} from '../utils';
import {EOL} from 'node:os';
import B from 'bluebird';

const APP_EXTENSIONS = ['.apk', '.apks'];
const RESOLVER_ACTIVITY_NAME = 'android/com.android.internal.app.ResolverActivity';
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
 * @this {AndroidDriver}
 * @param {string} appId
 * @returns {Promise<boolean>}
 */
export async function isAppInstalled(appId) {
  return await this.adb.isAppInstalled(appId);
}

/**
 * @this {AndroidDriver}
 * @param {import('./types').IsAppInstalledOpts} opts
 * @returns {Promise<boolean>}
 */
export async function mobileIsAppInstalled(opts) {
  const {appId} = requireArgs('appId', opts);
  return await this.isAppInstalled(appId);
}

/**
 * @this {AndroidDriver}
 * @param {string} appId
 * @returns {Promise<import('./types').AppState>}
 */
export async function queryAppState(appId) {
  this.log.info(`Querying the state of '${appId}'`);
  if (!(await this.adb.isAppInstalled(appId))) {
    return APP_STATE.NOT_INSTALLED;
  }
  if (!(await this.adb.processExists(appId))) {
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
 * @param {import('./types').QueryAppStateOpts} opts
 * @returns {Promise<import('./types').AppState>}
 */
export async function mobileQueryAppState(opts) {
  const {appId} = requireArgs('appId', opts);
  return await this.queryAppState(appId);
}

/**
 * @this {AndroidDriver}
 * @param {string} appId
 * @returns {Promise<void>}
 */
export async function activateApp(appId) {
  this.log.debug(`Activating '${appId}'`);
  const apiLevel = await this.adb.getApiLevel();
  // Fallback to Monkey in older APIs
  if (apiLevel < 24) {
    // The monkey command could raise an issue as https://stackoverflow.com/questions/44860475/how-to-use-the-monkey-command-with-an-android-system-that-doesnt-have-physical
    // but '--pct-syskeys 0' could cause another background process issue. https://github.com/appium/appium/issues/16941#issuecomment-1129837285
    const cmd = ['monkey', '-p', appId, '-c', 'android.intent.category.LAUNCHER', '1'];
    let output = '';
    try {
      output = await this.adb.shell(cmd);
      this.log.debug(`Command stdout: ${output}`);
    } catch (e) {
      this.log.errorAndThrow(
        `Cannot activate '${appId}'. Original error: ${/** @type {Error} */ (e).message}`,
      );
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
        `Switching the resolver to not use cmd`,
    );
    activityName = await this.adb.resolveLaunchableActivity(appId, {preferCmd: false});
  }

  const stdout = await this.adb.shell([
    'am',
    apiLevel < 26 ? 'start' : 'start-activity',
    '-a',
    'android.intent.action.MAIN',
    '-c',
    'android.intent.category.LAUNCHER',
    // FLAG_ACTIVITY_NEW_TASK | FLAG_ACTIVITY_RESET_TASK_IF_NEEDED
    // https://developer.android.com/reference/android/content/Intent#FLAG_ACTIVITY_NEW_TASK
    // https://developer.android.com/reference/android/content/Intent#FLAG_ACTIVITY_RESET_TASK_IF_NEEDED
    '-f',
    '0x10200000',
    '-n',
    activityName,
  ]);
  this.log.debug(stdout);
  if (/^error:/im.test(stdout)) {
    throw new Error(`Cannot activate '${appId}'. Original error: ${stdout}`);
  }
}

/**
 * @this {AndroidDriver}
 * @param {import('./types').ActivateAppOpts} opts
 * @returns {Promise<void>}
 */
export async function mobileActivateApp(opts) {
  const {appId} = requireArgs('appId', opts);
  return await this.activateApp(appId);
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
 * @param {import('./types').RemoveAppOpts} opts
 * @returns {Promise<boolean>}
 */
export async function mobileRemoveApp(opts) {
  const {appId} = requireArgs('appId', opts);
  return await this.removeApp(appId, opts);
}

/**
 * @this {AndroidDriver}
 * @param {string} appId
 * @param {Omit<import('./types').TerminateAppOpts, 'appId'>} [options={}]
 * @returns {Promise<boolean>}
 */
export async function terminateApp(appId, options = {}) {
  this.log.info(`Terminating '${appId}'`);
  if (!(await this.adb.processExists(appId))) {
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
      `'${appId}' has been terminated. Skip checking the application process state ` +
        `since the timeout was set as ${timeout}ms`,
    );
    return true;
  }

  try {
    await waitForCondition(async () => (await this.queryAppState(appId)) <= APP_STATE.NOT_RUNNING, {
      waitMs: timeout,
      intervalMs: 100,
    });
  } catch (e) {
    this.log.errorAndThrow(`'${appId}' is still running after ${timeout}ms timeout`);
  }
  this.log.info(`'${appId}' has been successfully terminated`);
  return true;
}

/**
 * @this {AndroidDriver}
 * @param {import('./types').TerminateAppOpts} opts
 * @returns {Promise<boolean>}
 */
export async function mobileTerminateApp(opts) {
  const {appId} = requireArgs('appId', opts);
  return await this.terminateApp(appId, opts);
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
 * @param {import('./types').InstallAppOpts} opts
 * @returns {Promise<void>}
 */
export async function mobileInstallApp(opts) {
  const {appPath, checkVersion} = requireArgs('appPath', opts);
  if (checkVersion) {
    const localPath = await this.helpers.configureApp(appPath, APP_EXTENSIONS);
    await this.adb.installOrUpgrade(localPath, null, Object.assign({}, opts, {enforceCurrentBuild: false}));
    return;
  }

  return await this.installApp(appPath, opts);
}

/**
 * @this {AndroidDriver}
 * @param {import('./types').ClearAppOpts} opts
 * @returns {Promise<void>}
 */
export async function mobileClearApp(opts) {
  const {appId} = requireArgs('appId', opts);
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
  if (this._cachedActivityArgs && this._cachedActivityArgs[`${appPackage}/${appActivity}`]) {
    // the activity was started with `startActivity`, so use those args to restart
    args = this._cachedActivityArgs[`${appPackage}/${appActivity}`];
  } else {
    try {
      this.log.debug(`Activating app '${appPackage}' in order to restore it`);
      await this.activateApp(/** @type {string} */ (appPackage));
      return true;
    } catch (ign) {}
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
    } catch (ign) {}
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
