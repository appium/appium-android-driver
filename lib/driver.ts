/* eslint-disable @typescript-eslint/no-non-null-assertion */

import {fs, tempDir, util} from '@appium/support';
import type {
  Constraints,
  DefaultCreateSessionResult,
  DriverCaps,
  DriverData,
  DriverOpts,
  ExternalDriver,
  InitialOpts,
  RouteMatcher,
  StringRecord,
  W3CDriverCaps,
} from '@appium/types';
import ADB, {DEFAULT_ADB_PORT} from 'appium-adb';
import type {default as AppiumChromedriver} from 'appium-chromedriver';
import {BaseDriver, DeviceSettings} from 'appium/driver';
import {retryInterval} from 'asyncbox';
import B from 'bluebird';
import _ from 'lodash';
import {SharedPrefsBuilder} from 'shared-preferences-builder';
import AndroidBootstrap from './bootstrap';
import ANDROID_DRIVER_CONSTRAINTS, {AndroidDriverConstraints} from './constraints';
import {SETTINGS_HELPER_PKG_ID, ensureNetworkSpeed, helpers} from './helpers';
import {newMethodMap} from './method-map';

const APP_EXTENSION = '.apk';
const DEVICE_PORT = 4724;

/**
 * This is a set of methods and paths that we never want to proxy to
 * Chromedriver
 **/
const NO_PROXY: RouteMatcher[] = [
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
];

export type AndroidDriverCaps = DriverCaps<AndroidDriverConstraints>;
export type W3CAndroidDriverCaps = W3CDriverCaps<AndroidDriverConstraints>;
export type AndroidDriverOpts = DriverOpts<AndroidDriverConstraints>;

export interface AndroidSettings {
  ignoreUnimportantViews: boolean;
}

export type AndroidDriverCreateResult = [string, AndroidDriverCaps];
type AndroidExternalDriver = ExternalDriver<AndroidDriverConstraints>;
class AndroidDriver
  extends BaseDriver<
    AndroidDriverConstraints,
    StringRecord,
    AndroidSettings,
    AndroidDriverCreateResult
  >
  implements
    ExternalDriver<
      AndroidDriverConstraints,
      string,
      StringRecord,
      AndroidSettings,
      AndroidDriverCreateResult
    >
{
  static newMethodMap = newMethodMap;
  jwpProxyAvoid: RouteMatcher[];

  bootstrap?: AndroidBootstrap;

  adb?: ADB;

  unlocker: typeof helpers.unlocker;

  apkStrings: StringRecord<StringRecord<string>>;

  proxyReqRes?: (...args: any) => any;

  contexts?: string[];

  sessionChromedrivers: StringRecord<AppiumChromedriver>;

  chromedriver?: AppiumChromedriver;

  proxyCommand?: AndroidExternalDriver['proxyCommand'];
  jwpProxyActive: boolean;
  curContext: string;

  useUnlockHelperApp?: boolean;

  defaultIME?: string;

  _wasWindowAnimationDisabled?: boolean;

  constructor(opts: InitialOpts = {} as InitialOpts, shouldValidateCaps = true) {
    super(opts, shouldValidateCaps);

    this.locatorStrategies = [
      'xpath',
      'id',
      'class name',
      'accessibility id',
      '-android uiautomator',
    ];
    this.desiredCapConstraints = _.cloneDeep(ANDROID_DRIVER_CONSTRAINTS);
    this.sessionChromedrivers = {};
    this.jwpProxyActive = false;
    this.jwpProxyAvoid = _.clone(NO_PROXY);
    this.settings = new DeviceSettings(
      {ignoreUnimportantViews: false} as AndroidSettings,
      this.onSettingsUpdate.bind(this)
    );
    this.apkStrings = {};
    this.unlocker = helpers.unlocker;

    this.curContext = this.defaultContextName();
  }

  async createSession(
    w3cCaps1: W3CAndroidDriverCaps,
    w3cCaps2?: W3CAndroidDriverCaps,
    w3cCaps3?: W3CAndroidDriverCaps,
    driverData?: DriverData[]
  ): Promise<AndroidDriverCreateResult> {
    // the whole createSession flow is surrounded in a try-catch statement
    // if creating a session fails at any point, we teardown everything we
    // set up before throwing the error.
    try {
      const [sessionId, caps] = (await super.createSession(
        w3cCaps1,
        w3cCaps2,
        w3cCaps3,
        driverData
      )) as DefaultCreateSessionResult<AndroidDriverConstraints>;

      const serverDetails = {
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
      const defaultOpts = {
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

      this.opts = {...defaultOpts, ...this.opts};

      this.useUnlockHelperApp = _.isUndefined(this.caps.unlockType);

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
      const {udid, emPort} = await helpers.getDeviceInfoFromCaps(this.opts);
      this.opts.udid = udid;
      // @ts-expect-error do not put arbitrary properties on opts
      this.opts.emPort = emPort;

      // set up an instance of ADB
      this.adb = await helpers.createADB({
        udid: this.opts.udid,
        // @ts-expect-error: unknown
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

  setAvdFromCapabilities(caps: AndroidDriverCaps) {
    if (this.opts.avd) {
      this.log.info('avd name defined, ignoring device name and platform version');
    } else {
      if (!caps.deviceName) {
        this.log.errorAndThrow(
          'avd or deviceName should be specified when reboot option is enables'
        );
        throw new Error(); // unreachable
      }
      if (!caps.platformVersion) {
        this.log.errorAndThrow(
          'avd or platformVersion should be specified when reboot option is enabled'
        );
        throw new Error(); // unreachable
      }
      const avdDevice = caps.deviceName.replace(/[^a-zA-Z0-9_.]/g, '-');
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
    return helpers.isChromeBrowser(String(this.opts.browserName));
  }

  async onSettingsUpdate(key: keyof AndroidSettings, value: any) {
    if (key === 'ignoreUnimportantViews') {
      await this.setCompressedLayoutHierarchy(value);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async startAndroidSession(opts: AndroidDriverOpts) {
    this.log.info(`Starting Android session`);

    // set up the device to run on (real or emulator, etc)
    this.defaultIME = (await helpers.initDevice(this.adb!, this.opts)) as string;

    // set actual device name, udid, platform version, screen size, model and manufacturer details.
    this.caps.deviceName = this.adb!.curDeviceId as string;
    // @ts-expect-error do not put arbitrary properties on caps
    this.caps.deviceUDID = this.opts.udid;
    this.caps.platformVersion = await this.adb!.getPlatformVersion();
    // @ts-expect-error do not put arbitrary properties on caps
    this.caps.deviceScreenSize = await this.adb.getScreenSize();
    // @ts-expect-error do not put arbitrary properties on caps
    this.caps.deviceModel = await this.adb.getModel();
    // @ts-expect-error do not put arbitrary properties on caps
    this.caps.deviceManufacturer = await this.adb.getManufacturer();

    if (this.opts.disableWindowAnimation) {
      if (await this.adb!.isAnimationOn()) {
        if ((await this.adb!.getApiLevel()) >= 28) {
          // API level 28 is Android P
          // Don't forget to reset the relaxing in delete session
          this.log.warn('Relaxing hidden api policy to manage animation scale');
          await this.adb!.setHiddenApiPolicy('1', !!this.opts.ignoreHiddenApiPolicyError);
        }

        this.log.info(
          'Disabling window animation as it is requested by "disableWindowAnimation" capability'
        );
        await this.adb!.setAnimationState(false);
        this._wasWindowAnimationDisabled = true;
      } else {
        this.log.info('Window animation is already disabled');
      }
    }

    // set up app under test
    await this.initAUT();

    // start UiAutomator
    const bootstrap = (this.bootstrap = new helpers.bootstrap(
      this.adb!,
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
          await this.startUnexpectedShutdown(err as Error);
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
      await helpers.unlock(this, this.adb!, this.caps);
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
      const viewName = this.defaultWebviewName();
      const timeout = this.opts.autoWebviewTimeout || 2000;

      this.log.info(`Setting auto webview to context '${viewName}' with timeout ${timeout}ms`);

      // try every 500ms until timeout is over
      await retryInterval(timeout / 500, 500, async () => {
        await this.setContext(viewName);
      });
    }
  }

  async initAUT() {
    // populate appPackage, appActivity, appWaitPackage, appWaitActivity,
    // and the device being used
    // in the opts and caps (so it gets back to the user on session creation)
    const launchInfo = await helpers.getLaunchInfo(this.adb!, this.opts);
    Object.assign(this.opts, launchInfo);
    Object.assign(this.caps, launchInfo);

    // Uninstall any uninstallOtherPackages which were specified in caps
    if (this.opts.uninstallOtherPackages) {
      helpers.validateDesiredCaps(this.opts);
      // Only SETTINGS_HELPER_PKG_ID package is used by UIA1
      await helpers.uninstallOtherPackages(
        this.adb!,
        helpers.parseArray(this.opts.uninstallOtherPackages),
        [SETTINGS_HELPER_PKG_ID]
      );
    }

    // Install any "otherApps" that were specified in caps
    if (this.opts.otherApps) {
      /** @type {string[]} */
      let otherApps: string[];
      try {
        otherApps = helpers.parseArray(this.opts.otherApps);
      } catch (e) {
        this.log.errorAndThrow(`Could not parse "otherApps" capability: ${(e as Error).message}`);
        return; // unreachable
      }
      otherApps = await B.all(
        otherApps.map((app) => this.helpers.configureApp(app, APP_EXTENSION))
      );
      await helpers.installOtherApks(otherApps, this.adb!, this.opts);
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
        await helpers.resetApp(this.adb!, this.opts);
      }
      return;
    }
    if (!this.opts.skipUninstall) {
      await this.adb!.uninstallApk(this.opts.appPackage!);
    }
    await helpers.installApk(this.adb!, this.opts);
    const apkStringsForLanguage = await helpers.pushStrings(
      this.opts.language,
      this.adb!,
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
    if (!(await this.adb!.shell(['pm', 'list', 'packages', String(this.opts.appPackage)]))) {
      this.log.errorAndThrow(`Could not find package ${this.opts.appPackage} on the device`);
    }
  }

  /**
   * Set CompressedLayoutHierarchy on the device
   * @privateRemarks FIXME: unknown param type
   */
  async setCompressedLayoutHierarchy(compress: any) {
    await this.bootstrap!.sendAction('compressedLayoutHierarchy', {compressLayout: compress});
  }

  async deleteSession() {
    this.log.debug('Shutting down Android driver');

    try {
      if (!_.isEmpty(this._screenRecordingProperties)) {
        await this.stopRecordingScreen();
      }
    } catch (ign) {}

    await helpers.removeAllSessionWebSocketHandlers(this.server!, this.sessionId!);

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
        await this.adb?.forceStop(this.opts.appPackage!);
      }
      await this.adb?.goToHome();
      if (this.opts.fullReset && !this.opts.skipUninstall && !this.appOnDevice) {
        await this.adb?.uninstallApk(this.opts.appPackage!);
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
      const avdName = this.opts.avd.replace('@', '');
      this.log.debug(`closing emulator '${avdName}'`);
      await this.adb?.killEmulator(avdName);
    }
  }

  /**
   *
   * @param {AndroidDriverOpts} [opts]
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async setSharedPreferences(opts: AndroidDriverOpts) {
    const sharedPrefs = this.opts.sharedPreferences!;
    this.log.info('Trying to set shared preferences');
    const name = sharedPrefs.name;
    if (_.isUndefined(name)) {
      this.log.warn(
        `Skipping setting Shared preferences, name is undefined: ${JSON.stringify(sharedPrefs)}`
      );
      return false;
    }
    const remotePath = `/data/data/${this.opts.appPackage}/shared_prefs`;
    const remoteFile = `${remotePath}/${name}.xml`;
    const localPath = `/tmp/${name}.xml`;
    const builder = this.getPrefsBuilder();
    builder.build(sharedPrefs.prefs);
    this.log.info(`Creating temporary shared preferences: ${localPath}`);
    builder.toFile(localPath);
    this.log.info(`Creating shared_prefs remote folder: ${remotePath}`);

    await this.adb!.shell(['mkdir', '-p', remotePath]);
    this.log.info(`Pushing shared_prefs to ${remoteFile}`);
    await this.adb!.push(localPath, remoteFile);
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
  validateDesiredCaps(caps: any): caps is AndroidDriverCaps {
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
  proxyActive(sessionId: string) {
    super.proxyActive(sessionId);

    return this.jwpProxyActive;
  }

  /**
   *
   * @param {string} sessionId
   */
  getProxyAvoidList(sessionId: string) {
    super.getProxyAvoidList(sessionId);

    return this.jwpProxyAvoid;
  }

  /**
   *
   * @param {string} sessionId
   */
  canProxy(sessionId: string) {
    super.canProxy(sessionId);

    // this will change depending on ChromeDriver status
    return _.isFunction(this.proxyReqRes);
  }
}

export {commands as androidCommands} from './commands';
export {AndroidDriver};
