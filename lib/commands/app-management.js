// @ts-check

import {util} from '@appium/support';
import {waitForCondition} from 'asyncbox';
import _ from 'lodash';
import {APP_STATE} from '../helpers';
import {requireArgs} from '../utils';
import {mixin} from './mixins';

const APP_EXTENSIONS = ['.apk', '.apks'];
const RESOLVER_ACTIVITY_NAME = 'android/com.android.internal.app.ResolverActivity';

/**
 * @type {import('./mixins').AppManagementMixin & ThisType<import('../driver').AndroidDriver>}
 * @satisfies {import('@appium/types').ExternalDriver}
 */
const AppManagementMixin = {
  async isAppInstalled(appId) {
    return await this.adb.isAppInstalled(appId);
  },

  async mobileIsAppInstalled(opts) {
    const {appId} = requireArgs('appId', opts);
    return await this.isAppInstalled(appId);
  },

  async queryAppState(appId) {
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
  },

  async mobileQueryAppState(opts) {
    const {appId} = requireArgs('appId', opts);
    return await this.queryAppState(appId);
  },

  async activateApp(appId) {
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
          `Cannot activate '${appId}'. Original error: ${/** @type {Error} */ (e).message}`
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
          `Switching the resolver to not use cmd`
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
  },

  async mobileActivateApp(opts) {
    const {appId} = requireArgs('appId', opts);
    return await this.activateApp(appId);
  },

  async removeApp(appId, opts = {}) {
    return await this.adb.uninstallApk(appId, opts);
  },

  async mobileRemoveApp(opts) {
    const {appId} = requireArgs('appId', opts);
    return await this.removeApp(appId, opts);
  },

  async terminateApp(appId, options = {}) {
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
          `since the timeout was set as ${timeout}ms`
      );
      return true;
    }

    try {
      await waitForCondition(
        async () => (await this.queryAppState(appId)) <= APP_STATE.NOT_RUNNING,
        {waitMs: timeout, intervalMs: 100}
      );
    } catch (e) {
      this.log.errorAndThrow(`'${appId}' is still running after ${timeout}ms timeout`);
    }
    this.log.info(`'${appId}' has been successfully terminated`);
    return true;
  },

  async mobileTerminateApp(opts) {
    const {appId} = requireArgs('appId', opts);
    return await this.terminateApp(appId, opts);
  },

  async installApp(appPath, opts) {
    const localPath = await this.helpers.configureApp(appPath, APP_EXTENSIONS);
    await this.adb.install(localPath, opts);
  },

  async mobileInstallApp(opts) {
    const {appPath} = requireArgs('appPath', opts);
    return await this.installApp(appPath, opts);
  },

  async mobileClearApp(opts) {
    const {appId} = requireArgs('appId', opts);
    await this.adb.clear(appId);
  },
};

mixin(AppManagementMixin);

export default AppManagementMixin;

/**
 * @typedef {import('appium-adb').ADB} ADB
 */
