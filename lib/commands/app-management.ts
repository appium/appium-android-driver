import {util} from '@appium/support';
import {waitForCondition, longSleep} from 'asyncbox';
import _ from 'lodash';
import {EOL} from 'node:os';
import B from 'bluebird';
import type {AndroidDriver, AndroidDriverOpts} from '../driver';
import type {AppState, TerminateAppOpts} from './types';
import type {UninstallOptions, InstallOptions, StartAppOptions} from 'appium-adb';

const APP_EXTENSIONS = ['.apk', '.apks'] as const;
const PACKAGE_INSTALL_TIMEOUT_MS = 90000;
// These constants are in sync with
// https://developer.apple.com/documentation/xctest/xcuiapplicationstate/xcuiapplicationstaterunningbackground?language=objc
export const APP_STATE = {
  NOT_INSTALLED: 0,
  NOT_RUNNING: 1,
  RUNNING_IN_BACKGROUND: 3,
  RUNNING_IN_FOREGROUND: 4,
} as const;

export interface IsAppInstalledOptions {
  /**
   * The user ID for which to check the package installation.
   * The `current` user id is used by default.
   */
  user?: string;
}

/**
 * Checks whether the specified application is installed on the device.
 *
 * @param appId The application package identifier to check.
 * @param opts Optional parameters for the installation check.
 * @returns `true` if the application is installed, `false` otherwise.
 */
export async function isAppInstalled(
  this: AndroidDriver,
  appId: string,
  opts: IsAppInstalledOptions = {},
): Promise<boolean> {
  return await this.adb.isAppInstalled(appId, opts);
}

/**
 * Checks whether the specified application is installed on the device.
 *
 * @param appId Application package identifier
 * @param user The user ID for which the package is installed.
 * The `current` user id is used by default.
 * @returns `true` if the application is installed, `false` otherwise.
 */
export async function mobileIsAppInstalled(
  this: AndroidDriver,
  appId: string,
  user?: string | number,
): Promise<boolean> {
  const _opts: IsAppInstalledOptions = {};
  if (util.hasValue(user)) {
    _opts.user = `${user}`;
  }
  return await this.isAppInstalled(appId, _opts);
}

/**
 * Queries the current state of the specified application.
 *
 * The possible states are:
 * - `APP_STATE.NOT_INSTALLED` (0): The application is not installed
 * - `APP_STATE.NOT_RUNNING` (1): The application is installed but not running
 * - `APP_STATE.RUNNING_IN_BACKGROUND` (3): The application is running in the background
 * - `APP_STATE.RUNNING_IN_FOREGROUND` (4): The application is running in the foreground
 *
 * @param appId Application package identifier
 * @returns The current state of the application as a numeric value.
 */
export async function queryAppState(this: AndroidDriver, appId: string): Promise<AppState> {
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
 * Activates the specified application, bringing it to the foreground.
 *
 * This is equivalent to launching the application if it's not already running,
 * or bringing it to the foreground if it's running in the background.
 *
 * @param appId Application package identifier
 */
export async function activateApp(this: AndroidDriver, appId: string): Promise<void> {
  return await this.adb.activateApp(appId);
}

/**
 * Removes (uninstalls) the specified application from the device.
 *
 * @param appId The application package identifier to remove.
 * @param opts Optional uninstall options. See {@link UninstallOptions} for available options.
 * @returns `true` if the application was successfully uninstalled, `false` otherwise.
 */
export async function removeApp(
  this: AndroidDriver,
  appId: string,
  opts: Omit<UninstallOptions, 'appId'> = {},
): Promise<boolean> {
  return await this.adb.uninstallApk(appId, opts);
}

/**
 * @param appId Application package identifier
 * @param timeout The count of milliseconds to wait until the
 * app is uninstalled.
 * @param keepData Set to true in order to keep the
 * application data and cache folders after uninstall.
 * @param skipInstallCheck Whether to check if the app is installed prior to
 * uninstalling it. By default this is checked.
 */
export async function mobileRemoveApp(
  this: AndroidDriver,
  appId: string,
  timeout?: number,
  keepData?: boolean,
  skipInstallCheck?: boolean,
): Promise<boolean> {
  return await this.removeApp(appId, {
    timeout,
    keepData,
    skipInstallCheck,
  });
}

/**
 * Terminates the specified application.
 *
 * This method forcefully stops the application and waits for it to be terminated.
 * It checks that all process IDs belonging to the application have been stopped.
 *
 * @param appId The application package identifier to terminate.
 * @param options Optional termination options. See {@link TerminateAppOpts} for available options.
 * @returns `true` if the application was successfully terminated, `false` if it was not running.
 * @throws {Error} If the application is still running after the timeout period.
 */
export async function terminateApp(
  this: AndroidDriver,
  appId: string,
  options: TerminateAppOpts = {},
): Promise<boolean> {
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

  let currentPids: number[] = [];
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
 * Terminates the specified application.
 *
 * This method forcefully stops the application and waits for it to be terminated.
 * It checks that all process IDs belonging to the application have been stopped.
 *
 * @param appId Application package identifier
 * @param timeout The count of milliseconds to wait until the app is terminated.
 * 500ms by default.
 * @returns `true` if the application was successfully terminated, `false` if it was not running.
 * @throws {Error} If the application is still running after the timeout period.
 */
export async function mobileTerminateApp(
  this: AndroidDriver,
  appId: string,
  timeout?: number | string,
): Promise<boolean> {
  return await this.terminateApp(appId, {
    timeout,
  });
}

/**
 * Installs the specified application on the device.
 *
 * The application file will be configured and validated before installation.
 * Supported file formats are: `.apk`, `.apks`.
 *
 * @param appPath The path to the application file to install.
 * Can be a local file path or a URL.
 * @param opts Optional installation options. See {@link InstallOptions} for available options.
 */
export async function installApp(
  this: AndroidDriver,
  appPath: string,
  opts: Omit<InstallOptions, 'appId'>,
): Promise<void> {
  const localPath = await this.helpers.configureApp(appPath, [...APP_EXTENSIONS]);
  await this.adb.install(localPath, opts);
}

/**
 * @param appPath
 * @param checkVersion
 * @param timeout The count of milliseconds to wait until the app is installed.
 * 20000ms by default.
 * @param allowTestPackages Set to true in order to allow test packages installation.
 * `false` by default.
 * @param useSdcard Set to true to install the app on sdcard instead of the device memory.
 * `false` by default.
 * @param grantPermissions Set to true in order to grant all the
 * permissions requested in the application's manifest automatically after the installation is completed
 * under Android 6+. `false` by default.
 * @param replace Set it to false if you don't want the application to be upgraded/reinstalled
 * if it is already present on the device. `true` by default.
 * @param noIncremental Forcefully disables incremental installs if set to `true`.
 * Read https://developer.android.com/preview/features#incremental for more details.
 * `false` by default.
 */
export async function mobileInstallApp(
  this: AndroidDriver,
  appPath: string,
  checkVersion?: boolean,
  timeout?: number,
  allowTestPackages?: boolean,
  useSdcard?: boolean,
  grantPermissions?: boolean,
  replace?: boolean,
  noIncremental?: boolean,
): Promise<void> {
  const opts: Omit<InstallOptions, 'appId'> = {
    timeout,
    allowTestPackages,
    useSdcard,
    grantPermissions,
    replace,
    noIncremental,
  };
  if (checkVersion) {
    const localPath = await this.helpers.configureApp(appPath, [...APP_EXTENSIONS]);
    await this.adb.installOrUpgrade(localPath, null, {
      ...opts,
      enforceCurrentBuild: false,
    });
    return;
  }

  return await this.installApp(appPath, opts);
}

/**
 * Clears the application data and cache for the specified application.
 *
 * This is equivalent to running `adb shell pm clear <appId>`.
 * All user data, cache, and settings for the application will be removed.
 *
 * @param appId Application package identifier
 */
export async function mobileClearApp(this: AndroidDriver, appId: string): Promise<void> {
  await this.adb.clear(appId);
}

/**
 * Retrieves the name of the currently focused activity.
 *
 * @returns The fully qualified name of the current activity (e.g., 'com.example.app.MainActivity').
 */
export async function getCurrentActivity(this: AndroidDriver): Promise<string> {
  return (await this.adb.getFocusedPackageAndActivity()).appActivity as string;
}

/**
 * Retrieves the package name of the currently focused application.
 *
 * @returns The package identifier of the current application (e.g., 'com.example.app').
 */
export async function getCurrentPackage(this: AndroidDriver): Promise<string> {
  return (await this.adb.getFocusedPackageAndActivity()).appPackage as string;
}

/**
 * Puts the application in the background for the specified duration.
 *
 * If a negative value is provided, the app will be sent to background and not restored.
 * Otherwise, the app will be restored to the foreground after the specified duration.
 *
 * @param seconds The number of seconds to keep the app in the background.
 * A negative value means to not restore the app after putting it to background.
 * @returns `true` if the app was successfully restored, or the result of `startApp` if restoration was attempted.
 */
export async function background(
  this: AndroidDriver,
  seconds: number,
): Promise<string | true> {
  if (seconds < 0) {
    // if user passes in a negative seconds value, interpret that as the instruction
    // to not bring the app back at all
    await this.adb.goToHome();
    return true;
  }
  const {appPackage, appActivity} = await this.adb.getFocusedPackageAndActivity();
  await this.adb.goToHome();

  // people can wait for a long time, so to be safe let's use the longSleep function and log
  // progress periodically.
  const sleepMs = seconds * 1000;
  const thresholdMs = 30 * 1000; // use the spin-wait for anything over this threshold
  // for our spin interval, use 1% of the total wait time, but nothing bigger than 30s
  const intervalMs = _.min([30 * 1000, parseInt(String(sleepMs / 100), 10)]) || 1000;
  const progressCb = ({elapsedMs, progress}: {elapsedMs: number; progress: number}) => {
    const waitSecs = (elapsedMs / 1000).toFixed(0);
    const progressPct = (progress * 100).toFixed(2);
    this.log.debug(`Waited ${waitSecs}s so far (${progressPct}%)`);
  };
  await longSleep(sleepMs, {thresholdMs, intervalMs, progressCb});

  let args: StartAppOptions;
  if (this._cachedActivityArgs?.[`${appPackage}/${appActivity}`]) {
    // the activity was started with `startActivity`, so use those args to restart
    args = this._cachedActivityArgs[`${appPackage}/${appActivity}`];
  } else {
    try {
      this.log.debug(`Activating app '${appPackage}' in order to restore it`);
      await this.adb.activateApp(appPackage as string);
      return true;
    } catch {}
    args =
      (appPackage === this.opts.appPackage && appActivity === this.opts.appActivity) ||
      (appPackage === this.opts.appWaitPackage &&
        (this.opts.appWaitActivity || '').split(',').includes(String(appActivity)))
        ? {
            // the activity is the original session activity, so use the original args
            pkg: this.opts.appPackage as string,
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
            pkg: appPackage as string,
            activity: appActivity ?? undefined,
            waitPkg: appPackage ?? undefined,
            waitActivity: appActivity ?? undefined,
            stopApp: false,
          };
  }
  args = _.pickBy(args, (value) => !_.isUndefined(value)) as StartAppOptions;
  this.log.debug(`Bringing application back to foreground with arguments: ${JSON.stringify(args)}`);
  return await this.adb.startApp(args);
}

/**
 * Puts the app to background and waits the given number of seconds then restores the app
 * if necessary. The call is blocking.
 *
 * @param seconds The amount of seconds to wait between putting the app to background and restoring it.
 * Any negative value means to not restore the app after putting it to background.
 */
export async function mobileBackgroundApp(
  this: AndroidDriver,
  seconds: number = -1,
): Promise<void> {
  await this.background(seconds);
}

/**
 * Resets the Application Under Test (AUT).
 *
 * The reset behavior depends on the driver options:
 * - If `fastReset` is enabled: Stops the app and clears its data
 * - If `fullReset` is enabled: Uninstalls and reinstalls the app
 * - If neither is enabled: Only stops the app
 *
 * @param opts Optional driver options. If not provided, uses the current session options.
 * @throws {Error} If `appPackage` is not specified or if the app cannot be reset.
 */
export async function resetAUT(
  this: AndroidDriver,
  opts: AndroidDriverOpts | null = null,
): Promise<void> {
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
          const err = error as Error;
          this.log.error(`Unable to grant permissions requested. Original error: ${err.message}`);
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
 * Installs the Application Under Test (AUT) on the device.
 *
 * If `fullReset` is enabled, this will perform a full reset (uninstall and reinstall).
 * Otherwise, it will install or upgrade the app if needed. If `fastReset` is enabled
 * and the app was already installed, it will perform a fast reset after installation.
 *
 * @param opts Optional driver options. If not provided, uses the current session options.
 * @throws {Error} If `app` or `appPackage` options are not specified.
 */
export async function installAUT(
  this: AndroidDriver,
  opts: AndroidDriverOpts | null = null,
): Promise<void> {
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
 * Installs multiple additional APK files on the device.
 *
 * All APKs are installed asynchronously in parallel. This is useful for installing
 * dependencies or additional applications required for testing.
 *
 * @param otherApps An array of paths to APK files to install.
 * Each path can be a local file path or a URL.
 * @param opts Optional driver options. If not provided, uses the current session options.
 */
export async function installOtherApks(
  this: AndroidDriver,
  otherApps: string[],
  opts: AndroidDriverOpts | null = null,
): Promise<void> {
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
 * Uninstalls the specified packages from the device.
 *
 * If `appPackages` contains `'*'`, all third-party packages will be uninstalled
 * (excluding packages in `filterPackages`).
 *
 * @param appPackages An array of package names to uninstall, or `['*']` to uninstall all third-party packages.
 * @param filterPackages An array of package names to exclude from uninstallation.
 * Only used when `appPackages` contains `'*'`.
 */
export async function uninstallOtherPackages(
  this: AndroidDriver,
  appPackages: string[],
  filterPackages: string[] = [],
): Promise<void> {
  if (appPackages.includes('*')) {
    this.log.debug('Uninstall third party packages');
    appPackages = await getThirdPartyPackages.bind(this)(filterPackages);
  }

  this.log.debug(`Uninstalling packages: ${appPackages}`);
  await B.all(appPackages.map((appPackage) => this.adb.uninstallApk(appPackage)));
}

/**
 * Retrieves a list of all third-party packages installed on the device.
 *
 * Third-party packages are those that are not part of the system installation.
 * This is equivalent to running `adb shell pm list packages -3`.
 *
 * @param filterPackages An array of package names to exclude from the results.
 * @returns An array of third-party package names, excluding those in `filterPackages`.
 * Returns an empty array if the command fails.
 */
export async function getThirdPartyPackages(
  this: AndroidDriver,
  filterPackages: string[] = [],
): Promise<string[]> {
  try {
    const packagesString = await this.adb.shell(['pm', 'list', 'packages', '-3']);
    const appPackagesArray = packagesString
      .trim()
      .replace(/package:/g, '')
      .split(EOL);
    this.log.debug(`'${appPackagesArray}' filtered with '${filterPackages}'`);
    return _.difference(appPackagesArray, filterPackages);
  } catch (err) {
    const error = err as Error;
    this.log.warn(`Unable to get packages with 'adb shell pm list packages -3': ${error.message}`);
    return [];
  }
}

