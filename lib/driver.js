// @ts-check

import {BaseDriver, DeviceSettings} from 'appium/driver';
import desiredConstraints from './constraints';

import {newMethodMap} from './method-map';
import {helpers, ensureNetworkSpeed, SETTINGS_HELPER_PKG_ID} from './helpers';
import _ from 'lodash';
import {DEFAULT_ADB_PORT} from 'appium-adb';
import {fs, tempDir, util} from '@appium/support';
import {retryInterval} from 'asyncbox';
import {SharedPrefsBuilder} from 'shared-preferences-builder';
import B from 'bluebird';

const APP_EXTENSION = '.apk';
const DEVICE_PORT = 4724;

// This is a set of methods and paths that we never want to proxy to
// Chromedriver
const NO_PROXY = /** @type {import('@appium/types').RouteMatcher[]} */ ([
  ['POST', new RegExp('^/session/[^/]+/context')],
  ['GET', new RegExp('^/session/[^/]+/context')],
  ['POST', new RegExp('^/session/[^/]+/appium')],
  ['GET', new RegExp('^/session/[^/]+/appium')],
  ['POST', new RegExp('^/session/[^/]+/touch/perform')],
  ['POST', new RegExp('^/session/[^/]+/touch/multi/perform')],
  ['POST', new RegExp('^/session/[^/]+/orientation')],
  ['GET', new RegExp('^/session/[^/]+/orientation')],
  ['POST', new RegExp('^/session/[^/]+/execute')],
  ['POST', new RegExp('^/session/[^/]+/execute/sync')],
  ['GET', new RegExp('^/session/[^/]+/network_connection')],
  ['POST', new RegExp('^/session/[^/]+/network_connection')],
]);

/**
 * @typedef {import('@appium/types').DriverCaps<AndroidDriverConstraints>} AndroidDriverCaps
 * @typedef {import('@appium/types').W3CDriverCaps<AndroidDriverConstraints>} W3CAndroidDriverCaps
 * @typedef {typeof desiredConstraints} AndroidDriverConstraints
 */

/**
 * @extends {BaseDriver<AndroidDriverConstraints>}
 * @implements {AndroidExternalDriver}
 */
class AndroidDriver extends BaseDriver {
  static newMethodMap = newMethodMap;

  /**
   * @type {typeof NO_PROXY}
   */
  jwpProxyAvoid;

  /**
   * @type {import('./bootstrap').AndroidBootstrap | undefined}
   */
  bootstrap;

  /** @type {import('appium-adb').ADB|undefined} */
  adb;

  /** @type {typeof helpers.unlocker} */
  unlocker;

  /** @type {StringRecord<StringRecord<string>>} */
  apkStrings;

  /**
   * @type {((...args: any) => any) | undefined}
   */
  proxyReqRes;

  /**
   * @type {string[]|undefined}
   */
  contexts;

  /** @type {StringRecord<import('appium-chromedriver').default>} */
  sessionChromedrivers;

  /** @type {import('appium-chromedriver').default|null} */
  chromedriver;

  /**
   * @type {AndroidExternalDriver['proxyCommand']|undefined}
   */
  proxyCommand;

  /**
   *
   * @param {AndroidDriverOpts} opts
   * @param {boolean} shouldValidateCaps
   */
  constructor(opts = /** @type {AndroidDriverOpts} */ ({}), shouldValidateCaps = true) {
    super(opts, shouldValidateCaps);

    this.locatorStrategies = [
      'xpath',
      'id',
      'class name',
      'accessibility id',
      '-android uiautomator',
    ];
    this.desiredCapConstraints = desiredConstraints;
    this.sessionChromedrivers = {};
    this.jwpProxyActive = false;
    this.jwpProxyAvoid = _.clone(NO_PROXY);
    this.settings = new DeviceSettings(
      {ignoreUnimportantViews: false},
      this.onSettingsUpdate.bind(this)
    );
    this.chromedriver = null;
    this.apkStrings = {};
    this.unlocker = helpers.unlocker;

    this.curContext = this.defaultContextName();
  }

  /**
   *
   * @param {W3CAndroidDriverCaps} w3cCaps1
   * @param {W3CAndroidDriverCaps} [w3cCaps2]
   * @param {W3CAndroidDriverCaps} [w3cCaps3]
   * @param {import('@appium/types').DriverData[]} [driverData]
   * @returns {Promise<[string, AndroidDriverCaps]>}
   */
  async createSession(w3cCaps1, w3cCaps2, w3cCaps3, driverData) {
    // the whole createSession flow is surrounded in a try-catch statement
    // if creating a session fails at any point, we teardown everything we
    // set up before throwing the error.
    try {
      let [sessionId, caps] = await super.createSession(w3cCaps1, w3cCaps2, w3cCaps3, driverData);

      let serverDetails = {
        platform: 'LINUX',
        webStorageEnabled: false,
        takesScreenshot: true,
        javascriptEnabled: true,
        databaseEnabled: false,
        networkConnectionEnabled: true,
        locationContextEnabled: false,
        warnings: {},
        desired: this.caps,
      };

      this.caps = Object.assign(serverDetails, this.caps);

      // assigning defaults
      let defaultOpts = {
        action: 'android.intent.action.MAIN',
        category: 'android.intent.category.LAUNCHER',
        flags: '0x10200000',
        disableAndroidWatchers: false,
        tmpDir: await tempDir.staticDir(),
        fullReset: false,
        autoLaunch: true,
        adbPort: DEFAULT_ADB_PORT,
        bootstrapPort: DEVICE_PORT,
        androidInstallTimeout: 90000,
      };
      _.defaults(this.opts, defaultOpts);
      this.useUnlockHelperApp = _.isUndefined(this.caps.unlockType);

      // not user visible via caps
      if (this.opts.noReset === true) {
        this.opts.fullReset = false;
      }
      if (this.opts.fullReset === true) {
        this.opts.noReset = false;
      }
      this.opts.fastReset = !this.opts.fullReset && !this.opts.noReset;
      this.opts.skipUninstall = this.opts.fastReset || this.opts.noReset;

      if (this.isChromeSession) {
        helpers.adjustBrowserSessionCaps(this.opts);
      }

      if (this.opts.nativeWebScreenshot) {
        this.jwpProxyAvoid.push(['GET', new RegExp('^/session/[^/]+/screenshot')]);
      }

      // @ts-expect-error do not put arbitrary properties on opts
      if (this.opts.reboot) {
        this.setAvdFromCapabilities(caps);
      }

      // get device udid for this session
      let {udid, emPort} = await helpers.getDeviceInfoFromCaps(this.opts);
      this.opts.udid = udid;
      // @ts-expect-error do not put arbitrary properties on opts
      this.opts.emPort = emPort;

      // set up an instance of ADB
      this.adb = await helpers.createADB({
        udid: this.opts.udid,
        // @ts-expect-error do not put arbitrary properties on opts
        emPort: this.opts.emPort,
        adbPort: this.opts.adbPort,
        suppressKillServer: this.opts.suppressKillServer,
        remoteAdbHost: this.opts.remoteAdbHost,
        clearDeviceLogsOnStart: this.opts.clearDeviceLogsOnStart,
        adbExecTimeout: this.opts.adbExecTimeout,
        allowOfflineDevices: this.opts.allowOfflineDevices,
      });

      if ((await this.adb.getApiLevel()) >= 23) {
        this.log.warn(
          "Consider setting 'automationName' capability to " +
            "'uiautomator2' on Android >= 6, since UIAutomator framework " +
            'is not maintained anymore by the OS vendor.'
        );
      }

      // @ts-expect-error no arbitrary props on opts
      if (this.helpers.isPackageOrBundle(this.opts.app)) {
        // user provided package instead of app for 'app' capability, massage options
        this.opts.appPackage = this.opts.app;
        // @ts-expect-error no arbitrary props on opts
        this.opts.app = null;
      }

      if (this.opts.app) {
        // find and copy, or download and unzip an app url or path
        this.opts.app = await this.helpers.configureApp(this.opts.app, APP_EXTENSION);
        await this.checkAppPresent();
      } else if (this.appOnDevice) {
        // the app isn't an actual app file but rather something we want to
        // assume is on the device and just launch via the appPackage
        this.log.info(
          `App file was not listed, instead we're going to run ` +
            `${this.opts.appPackage} directly on the device`
        );
        await this.checkPackagePresent();
      }

      // Some cloud services using appium launch the avd themselves, so we ensure netspeed
      // is set for emulators by calling adb.networkSpeed before running the app
      if (util.hasValue(this.opts.networkSpeed)) {
        if (!this.isEmulator()) {
          this.log.warn('Sorry, networkSpeed capability is only available for emulators');
        } else {
          const networkSpeed = ensureNetworkSpeed(this.adb, this.opts.networkSpeed);
          await this.adb.networkSpeed(networkSpeed);
        }
      }
      // check if we have to enable/disable gps before running the application
      if (util.hasValue(this.opts.gpsEnabled)) {
        if (this.isEmulator()) {
          this.log.info(
            `Trying to ${this.opts.gpsEnabled ? 'enable' : 'disable'} gps location provider`
          );
          await this.adb.toggleGPSLocationProvider(this.opts.gpsEnabled);
        } else {
          this.log.warn('Sorry! gpsEnabled capability is only available for emulators');
        }
      }

      await this.startAndroidSession(this.opts);
      return [sessionId, this.caps];
    } catch (e) {
      // ignoring delete session exception if any and throw the real error
      // that happened while creating the session.
      try {
        await this.deleteSession();
      } catch (ign) {}
      throw e;
    }
  }

  isEmulator() {
    return helpers.isEmulator(this.adb, this.opts);
  }

  /**
   *
   * @param {AndroidDriverCaps} caps
   */
  setAvdFromCapabilities(caps) {
    if (this.opts.avd) {
      this.log.info('avd name defined, ignoring device name and platform version');
    } else {
      if (!caps.deviceName) {
        this.log.errorAndThrow(
          'avd or deviceName should be specified when reboot option is enables'
        );
      }
      if (!caps.platformVersion) {
        this.log.errorAndThrow(
          'avd or platformVersion should be specified when reboot option is enabled'
        );
      }
      let avdDevice = caps.deviceName.replace(/[^a-zA-Z0-9_.]/g, '-');
      this.opts.avd = `${avdDevice}__${caps.platformVersion}`;
    }
  }

  get appOnDevice() {
    return (
      // @ts-expect-error no arbitrary props on opts
      this.helpers.isPackageOrBundle(this.opts.app) ||
      // @ts-expect-error no arbitrary props on opts
      (!this.opts.app && this.helpers.isPackageOrBundle(this.opts.appPackage))
    );
  }

  get isChromeSession() {
    return helpers.isChromeBrowser(this.opts.browserName);
  }

  /**
   *
   * @param {string} key
   * @param {any} value
   */
  async onSettingsUpdate(key, value) {
    if (key === 'ignoreUnimportantViews') {
      await this.setCompressedLayoutHierarchy(value);
    }
  }

  /**
   *
   * @param {AndroidDriverOpts} [opts]
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async startAndroidSession(opts) {
    this.log.info(`Starting Android session`);
    const adb = /** @type {ADB} */ (this.adb);
    // set up the device to run on (real or emulator, etc)
    this.defaultIME = await helpers.initDevice(adb, this.opts);

    // set actual device name, udid, platform version, screen size, model and manufacturer details.
    this.caps.deviceName = /** @type {string} */ (adb.curDeviceId);
    // @ts-expect-error do not put arbitrary properties on caps
    this.caps.deviceUDID = this.opts.udid;
    this.caps.platformVersion = await adb.getPlatformVersion();
    // @ts-expect-error do not put arbitrary properties on caps
    this.caps.deviceScreenSize = await this.adb.getScreenSize();
    // @ts-expect-error do not put arbitrary properties on caps
    this.caps.deviceModel = await this.adb.getModel();
    // @ts-expect-error do not put arbitrary properties on caps
    this.caps.deviceManufacturer = await this.adb.getManufacturer();

    if (this.opts.disableWindowAnimation) {
      if (await adb.isAnimationOn()) {
        if ((await adb.getApiLevel()) >= 28) {
          // API level 28 is Android P
          // Don't forget to reset the relaxing in delete session
          this.log.warn('Relaxing hidden api policy to manage animation scale');
          await adb.setHiddenApiPolicy('1', !!this.opts.ignoreHiddenApiPolicyError);
        }

        this.log.info(
          'Disabling window animation as it is requested by "disableWindowAnimation" capability'
        );
        await adb.setAnimationState(false);
        this._wasWindowAnimationDisabled = true;
      } else {
        this.log.info('Window animation is already disabled');
      }
    }

    // set up app under test
    await this.initAUT();

    // start UiAutomator
    const bootstrap = (this.bootstrap = new helpers.bootstrap(
      adb,
      this.opts.bootstrapPort,
      // @ts-expect-error do not put arbitrary properties on opts
      this.opts.websocket
    ));
    await bootstrap.start(
      this.opts.appPackage,
      this.opts.disableAndroidWatchers,
      this.opts.acceptSslCerts
    );
    // handling unexpected shutdown
    (async () => {
      try {
        await bootstrap.onUnexpectedShutdown;
      } catch (err) {
        if (!bootstrap.ignoreUnexpectedShutdown) {
          await this.startUnexpectedShutdown(/** @type {Error} */ (err));
        }
      }
    })();

    if (this.opts.skipUnlock) {
      this.log.info('Skipping lockscreen check');
    } else {
      this.log.info(
        'Checking for lockscreen presence. ' +
          `This could be skipped by setting the 'appium:skipUnlock' capability to true.`
      );
      await helpers.unlock(this, adb, this.caps);
    }

    // Set CompressedLayoutHierarchy on the device based on current settings object
    // this has to happen _after_ bootstrap is initialized
    if (this.opts.ignoreUnimportantViews) {
      await this.settings.update({ignoreUnimportantViews: this.opts.ignoreUnimportantViews});
    }

    if (this.isChromeSession) {
      // start a chromedriver session and proxy to it
      await this.startChromeSession();
    } else {
      if (this.opts.autoLaunch) {
        // start app
        await this.startAUT();
      }
    }

    if (util.hasValue(this.opts.orientation)) {
      this.log.debug(`Setting initial orientation to '${this.opts.orientation}'`);
      // @ts-expect-error no arbitrary props on opts
      await this.setOrientation(this.opts.orientation);
    }

    await this.initAutoWebview();
  }

  async initAutoWebview() {
    if (this.opts.autoWebview) {
      let viewName = this.defaultWebviewName();
      let timeout = this.opts.autoWebviewTimeout || 2000;

      this.log.info(`Setting auto webview to context '${viewName}' with timeout ${timeout}ms`);

      // try every 500ms until timeout is over
      await retryInterval(timeout / 500, 500, async () => {
        await this.setContext(viewName);
      });
    }
  }

  async initAUT() {
    const adb = /** @type {ADB} */ (this.adb);
    // populate appPackage, appActivity, appWaitPackage, appWaitActivity,
    // and the device being used
    // in the opts and caps (so it gets back to the user on session creation)
    let launchInfo = await helpers.getLaunchInfo(adb, this.opts);
    Object.assign(this.opts, launchInfo);
    Object.assign(this.caps, launchInfo);

    // Uninstall any uninstallOtherPackages which were specified in caps
    if (this.opts.uninstallOtherPackages) {
      helpers.validateDesiredCaps(this.opts);
      // Only SETTINGS_HELPER_PKG_ID package is used by UIA1
      await helpers.uninstallOtherPackages(
        adb,
        helpers.parseArray(this.opts.uninstallOtherPackages),
        [SETTINGS_HELPER_PKG_ID]
      );
    }

    // Install any "otherApps" that were specified in caps
    if (this.opts.otherApps) {
      /** @type {string[]} */
      let otherApps;
      try {
        otherApps = helpers.parseArray(this.opts.otherApps);
      } catch (e) {
        this.log.errorAndThrow(
          `Could not parse "otherApps" capability: ${/** @type {Error} */ (e).message}`
        );
        return; // unreachable
      }
      otherApps = await B.all(
        otherApps.map((app) => this.helpers.configureApp(app, APP_EXTENSION))
      );
      await helpers.installOtherApks(otherApps, adb, this.opts);
    }

    // install app
    if (!this.opts.app) {
      if (this.opts.fullReset) {
        this.log.errorAndThrow(
          'Full reset requires an app capability, use fastReset if app is not provided'
        );
      }
      this.log.debug('No app capability. Assuming it is already on the device');
      if (this.opts.fastReset) {
        await helpers.resetApp(adb, this.opts);
      }
      return;
    }
    if (!this.opts.skipUninstall) {
      await adb.uninstallApk(/** @type {string} */ (this.opts.appPackage));
    }
    await helpers.installApk(adb, this.opts);
    const apkStringsForLanguage = await helpers.pushStrings(
      this.opts.language,
      /** @type {ADB} */ (this.adb),
      this.opts
    );
    if (this.opts.language) {
      this.apkStrings[this.opts.language] = apkStringsForLanguage;
    }

    // This must run after installing the apk, otherwise it would cause the
    // install to fail. And before running the app.
    if (!_.isUndefined(this.opts.sharedPreferences)) {
      await this.setSharedPreferences(this.opts);
    }
  }

  async checkAppPresent() {
    this.log.debug('Checking whether app is actually present');
    // @ts-expect-error do not put arbitrary properties on opts
    if (!(await fs.exists(this.opts.app))) {
      this.log.errorAndThrow(`Could not find app apk at ${this.opts.app}`);
    }
  }

  async checkPackagePresent() {
    this.log.debug('Checking whether package is present on the device');
    if (
      !(await /** @type {ADB} */ (this.adb).shell([
        'pm',
        'list',
        'packages',
        String(this.opts.appPackage),
      ]))
    ) {
      this.log.errorAndThrow(`Could not find package ${this.opts.appPackage} on the device`);
    }
  }

  // Set CompressedLayoutHierarchy on the device
  /**
   *
   * @param {any} compress
   * @privateRemarks FIXME: unknown type
   */
  async setCompressedLayoutHierarchy(compress) {
    await /** @type {import('./bootstrap').AndroidBootstrap} */ (this.bootstrap).sendAction(
      'compressedLayoutHierarchy',
      {compressLayout: compress}
    );
  }

  async deleteSession() {
    this.log.debug('Shutting down Android driver');

    try {
      if (!_.isEmpty(this._screenRecordingProperties)) {
        await this.stopRecordingScreen();
      }
    } catch (ign) {}

    await helpers.removeAllSessionWebSocketHandlers(
      /** @type {import('@appium/types').AppiumServer} */ (this.server),
      /** @type {string} */ (this.sessionId)
    );

    await this.mobileStopScreenStreaming();

    await super.deleteSession();

    if (this.bootstrap) {
      // certain cleanup we only care to do if the bootstrap was ever run
      await this.stopChromedriverProxies();
      if (this.opts.unicodeKeyboard && this.opts.resetKeyboard && this.defaultIME) {
        this.log.debug(`Resetting IME to ${this.defaultIME}`);
        await this.adb?.setIME(this.defaultIME);
      }
      if (!this.isChromeSession && !this.opts.dontStopAppOnReset) {
        await this.adb?.forceStop(/** @type {string} */ (this.opts.appPackage));
      }
      await this.adb?.goToHome();
      if (this.opts.fullReset && !this.opts.skipUninstall && !this.appOnDevice) {
        await this.adb?.uninstallApk(/** @type {string} */ (this.opts.appPackage));
      }
      await this.bootstrap.shutdown();
      this.bootstrap = undefined;
    } else {
      this.log.debug("Called deleteSession but bootstrap wasn't active");
    }
    // some cleanup we want to do regardless, in case we are shutting down
    // mid-startup
    await this.adb?.stopLogcat();
    if (this.useUnlockHelperApp) {
      await this.adb?.forceStop('io.appium.unlock');
    }
    if (this._wasWindowAnimationDisabled) {
      this.log.info('Restoring window animation state');
      await this.adb?.setAnimationState(true);

      // This was necessary to change animation scale over Android P. We must reset the policy for the security.
      if (this.adb && (await this.adb.getApiLevel()) >= 28) {
        this.log.info('Restoring hidden api policy to the device default configuration');
        await this.adb?.setDefaultHiddenApiPolicy(!!this.opts.ignoreHiddenApiPolicyError);
      }
    }

    // @ts-expect-error do not put arbitrary properties on opts
    if (this.opts.reboot) {
      // @ts-expect-error do not put arbitrary properties on opts
      let avdName = this.opts.avd.replace('@', '');
      this.log.debug(`closing emulator '${avdName}'`);
      await this.adb?.killEmulator(avdName);
    }
  }

  /**
   *
   * @param {AndroidDriverOpts} [opts]
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async setSharedPreferences(opts) {
    let sharedPrefs = /** @type {StringRecord} */ (this.opts.sharedPreferences);
    this.log.info('Trying to set shared preferences');
    let name = sharedPrefs.name;
    if (_.isUndefined(name)) {
      this.log.warn(
        `Skipping setting Shared preferences, name is undefined: ${JSON.stringify(sharedPrefs)}`
      );
      return false;
    }
    let remotePath = `/data/data/${this.opts.appPackage}/shared_prefs`;
    let remoteFile = `${remotePath}/${name}.xml`;
    let localPath = `/tmp/${name}.xml`;
    let builder = this.getPrefsBuilder();
    builder.build(sharedPrefs.prefs);
    this.log.info(`Creating temporary shared preferences: ${localPath}`);
    builder.toFile(localPath);
    this.log.info(`Creating shared_prefs remote folder: ${remotePath}`);
    const adb = /** @type {ADB} */ (this.adb);
    await adb.shell(['mkdir', '-p', remotePath]);
    this.log.info(`Pushing shared_prefs to ${remoteFile}`);
    await adb.push(localPath, remoteFile);
    try {
      this.log.info(`Trying to remove shared preferences temporary file`);
      if (await fs.exists(localPath)) {
        await fs.unlink(localPath);
      }
    } catch (e) {
      this.log.warn(`Error trying to remove temporary file ${localPath}`);
    }
    return true;
  }

  getPrefsBuilder() {
    /* Add this method to create a new SharedPrefsBuilder instead of
     * directly creating the object on setSharedPreferences for testing purposes
     */
    return new SharedPrefsBuilder();
  }

  /**
   *
   * @param {any} caps
   * @returns {caps is AndroidDriverCaps}
   */
  validateDesiredCaps(caps) {
    if (!super.validateDesiredCaps(caps)) {
      return false;
    }
    if (
      (!caps.browserName || !helpers.isChromeBrowser(caps.browserName)) &&
      !caps.app &&
      !caps.appPackage
    ) {
      this.log.errorAndThrow(
        'The desired capabilities must include either an app, appPackage or browserName'
      );
    }
    return helpers.validateDesiredCaps(caps);
  }

  /**
   *
   * @param {string} sessionId
   */
  proxyActive(sessionId) {
    super.proxyActive(sessionId);

    return this.jwpProxyActive;
  }

  /**
   *
   * @param {string} sessionId
   */
  getProxyAvoidList(sessionId) {
    super.getProxyAvoidList(sessionId);

    return this.jwpProxyAvoid;
  }

  /**
   *
   * @param {string} sessionId
   */
  canProxy(sessionId) {
    super.canProxy(sessionId);

    // this will change depending on ChromeDriver status
    return _.isFunction(this.proxyReqRes);
  }
}

export {AndroidDriver};
export {commands as androidCommands} from './commands';

/**
 * @typedef {import('@appium/types').ExternalDriver<AndroidDriverConstraints>} AndroidExternalDriver
 * @typedef {import('@appium/types').DriverOpts<AndroidDriverConstraints>} AndroidDriverOpts
 * @typedef {import('appium-adb').ADB} ADB
 */

/**
 * @template [T=any]
 * @typedef {import('@appium/types').StringRecord<T>} StringRecord
 */
