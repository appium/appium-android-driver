// @ts-check
import {util} from '@appium/support';
import {longSleep} from 'asyncbox';
import _ from 'lodash';
import moment from 'moment';
import androidHelpers from '../helpers/android';
import {requireArgs} from '../utils';
import {mixin} from './mixins';
import {errors} from 'appium/driver';

const MOMENT_FORMAT_ISO8601 = 'YYYY-MM-DDTHH:mm:ssZ';

/**
 * @type {import('./mixins').GeneralMixin & ThisType<import('../driver').AndroidDriver>}
 * @satisfies {import('@appium/types').ExternalDriver}
 */
const GeneralMixin = {
  _cachedActivityArgs: {},
  async keys(keys) {
    // Protocol sends an array; rethink approach
    keys = _.isArray(keys) ? keys.join('') : keys;
    /**
     * @type {import('./types').SendKeysOpts}
     */
    const params = {
      text: keys,
      replace: false,
    };
    if (this.opts.unicodeKeyboard) {
      params.unicodeKeyboard = true;
    }
    await this.doSendKeys(params);
  },

  async doSendKeys(params) {
    throw new errors.NotImplementedError('Not implemented');
  },

  async getDeviceTime(format = MOMENT_FORMAT_ISO8601) {
    this.log.debug(
      'Attempting to capture android device date and time. ' + `The format specifier is '${format}'`
    );
    const deviceTimestamp = (
      await this.adb.shell(['date', '+%Y-%m-%dT%T%z'])
    ).trim();
    this.log.debug(`Got device timestamp: ${deviceTimestamp}`);
    const parsedTimestamp = moment.utc(deviceTimestamp, 'YYYY-MM-DDTHH:mm:ssZZ');
    if (!parsedTimestamp.isValid()) {
      this.log.warn('Cannot parse the returned timestamp. Returning as is');
      return deviceTimestamp;
    }
    // @ts-expect-error private API
    return parsedTimestamp.utcOffset(parsedTimestamp._tzm || 0).format(format);
  },

  async mobileGetDeviceTime(opts = {}) {
    return await this.getDeviceTime(opts.format);
  },

  async getPageSource() {
    throw new errors.NotImplementedError('Not implemented');
  },

  async back() {
    throw new errors.NotImplementedError('Not implemented');
  },

  async openSettingsActivity(setting) {
    let {appPackage, appActivity} = await this.adb.getFocusedPackageAndActivity();
    await this.adb.shell(['am', 'start', '-a', `android.settings.${setting}`]);
    await this.adb.waitForNotActivity(
      /** @type {string} */ (appPackage),
      /** @type {string} */ (appActivity),
      5000
    );
  },

  async getWindowSize() {
    throw new errors.NotImplementedError('Not implemented');
  },

  // For W3C
  async getWindowRect() {
    const {width, height} = await this.getWindowSize();
    return {
      width,
      height,
      x: 0,
      y: 0,
    };
  },

  /**
   * @returns {Promise<string>}
   */
  async getCurrentActivity() {
    return /** @type {string} */ ((await this.adb.getFocusedPackageAndActivity()).appActivity);
  },

  /**
   * @returns {Promise<string>}
   */
  async getCurrentPackage() {
    return /** @type {string} */ ((await this.adb.getFocusedPackageAndActivity()).appPackage);
  },

  async background(seconds) {
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
    this.log.debug(
      `Bringing application back to foreground with arguments: ${JSON.stringify(args)}`
    );
    return await this.adb.startApp(args);
  },

  async getStrings(language) {
    if (!language) {
      language = await this.adb.getDeviceLanguage();
      this.log.info(`No language specified, returning strings for: ${language}`);
    }

    // Clients require the resulting mapping to have both keys
    // and values of type string
    /** @param {StringRecord} mapping */
    const preprocessStringsMap = (mapping) => {
      /** @type {StringRecord} */
      const result = {};
      for (const [key, value] of _.toPairs(mapping)) {
        result[key] = _.isString(value) ? value : JSON.stringify(value);
      }
      return result;
    };

    if (this.apkStrings[language]) {
      // Return cached strings
      return preprocessStringsMap(this.apkStrings[language]);
    }

    this.apkStrings[language] = await androidHelpers.pushStrings(language, this.adb, this.opts);

    return preprocessStringsMap(this.apkStrings[language]);
  },

  async launchApp() {
    throw new errors.NotImplementedError('Not implemented');
  },

  async startActivity(
    appPackage,
    appActivity,
    appWaitPackage,
    appWaitActivity,
    intentAction,
    intentCategory,
    intentFlags,
    optionalIntentArguments,
    dontStopAppOnReset
  ) {
    this.log.debug(`Starting package '${appPackage}' and activity '${appActivity}'`);

    // dontStopAppOnReset is both an argument here, and a desired capability
    // if the argument is set, use it, otherwise use the cap
    if (!util.hasValue(dontStopAppOnReset)) {
      dontStopAppOnReset = !!this.opts.dontStopAppOnReset;
    }

    /** @type {import('appium-adb').StartAppOptions} */
    let args = {
      pkg: appPackage,
      activity: appActivity,
      waitPkg: appWaitPackage || appPackage,
      waitActivity: appWaitActivity || appActivity,
      action: intentAction,
      category: intentCategory,
      flags: intentFlags,
      optionalIntentArguments,
      stopApp: !dontStopAppOnReset,
    };
    this._cachedActivityArgs = this._cachedActivityArgs || {};
    this._cachedActivityArgs[`${args.waitPkg}/${args.waitActivity}`] = args;
    await this.adb.startApp(args);
  },

  async reset() {
    await androidHelpers.resetApp(
      this.adb,
      Object.assign({}, this.opts, {fastReset: true})
    );
    // reset context since we don't know what kind on context we will end up after app launch.
    await this.setContext();
    return this.isChromeSession ? this.startChromeSession() : this.startAUT();
  },

  async startAUT() {
    await this.adb.startApp({
      pkg: /** @type {string} */ (this.opts.appPackage),
      activity: this.opts.appActivity,
      action: this.opts.intentAction,
      category: this.opts.intentCategory,
      flags: this.opts.intentFlags,
      waitPkg: this.opts.appWaitPackage,
      waitActivity: this.opts.appWaitActivity,
      waitForLaunch: this.opts.appWaitForLaunch,
      waitDuration: this.opts.appWaitDuration,
      optionalIntentArguments: this.opts.optionalIntentArguments,
      stopApp: !this.opts.dontStopAppOnReset,
      user: this.opts.userProfile,
    });
  },

  // we override setUrl to take an android URI which can be used for deep-linking
  // inside an app, similar to starting an intent
  async setUrl(uri) {
    await this.adb.startUri(uri, /** @type {string} */ (this.opts.appPackage));
  },

  // closing app using force stop
  async closeApp() {
    await this.adb.forceStop(/** @type {string} */ (this.opts.appPackage));
    // reset context since we don't know what kind on context we will end up after app launch.
    await this.setContext();
  },

  async getDisplayDensity() {
    // first try the property for devices
    let out = await this.adb.shell(['getprop', 'ro.sf.lcd_density']);
    if (out) {
      let val = parseInt(out, 10);
      // if the value is NaN, try getting the emulator property
      if (!isNaN(val)) {
        return val;
      }
      this.log.debug(`Parsed density value was NaN: "${out}"`);
    }
    // fallback to trying property for emulators
    out = await this.adb.shell(['getprop', 'qemu.sf.lcd_density']);
    if (out) {
      let val = parseInt(out, 10);
      if (!isNaN(val)) {
        return val;
      }
      this.log.debug(`Parsed density value was NaN: "${out}"`);
    }
    // couldn't get anything, so error out
    this.log.errorAndThrow('Failed to get display density property.');
    throw new Error(); // unreachable
  },

  async mobilePerformEditorAction(opts) {
    const {action} = requireArgs('action', opts);
    await this.adb.performEditorAction(action);
  },

  async mobileGetNotifications() {
    return await this.adb.getNotifications();
  },

  async mobileListSms(opts) {
    return await this.adb.getSmsList(opts);
  },

  async mobileUnlock(opts = {}) {
    const {key, type, strategy, timeoutMs} = opts;
    if (!key && !type) {
      await this.unlock();
    } else {
      // @ts-expect-error XXX: these caps should be defined in the constraints!!
      await androidHelpers.unlock(this, this.adb, {
        unlockKey: key,
        unlockType: type,
        unlockStrategy: strategy,
        unlockSuccessTimeout: timeoutMs,
      });
    }
  },
};

mixin(GeneralMixin);

export default GeneralMixin;

/**
 * @typedef {import('appium-adb').ADB} ADB
 * @typedef {import('@appium/types').StringRecord} StringRecord
 */
