import { BaseDriver, DeviceSettings } from 'appium-base-driver';
import Chromedriver from 'appium-chromedriver';
import desiredConstraints from './desired-caps';
import commands from './commands/index';
import { setupNewChromedriver } from './commands/context';
import helpers from './android-helpers';
import { CHROMIUM_WIN } from './webview-helpers';
import log from './logger';
import _ from 'lodash';
import { DEFAULT_ADB_PORT } from 'appium-adb';
import { fs, tempDir } from 'appium-support';
import { retryInterval } from 'asyncbox';
import { version } from '../../package.json'; // eslint-disable-line import/no-unresolved


const APP_EXTENSION = '.apk';
const DEVICE_PORT = 4724;

// This is a set of methods and paths that we never want to proxy to
// Chromedriver
const NO_PROXY = [
  ['POST', new RegExp('^/session/[^/]+/context')],
  ['GET', new RegExp('^/session/[^/]+/context')],
  ['POST', new RegExp('^/session/[^/]+/appium')],
  ['GET', new RegExp('^/session/[^/]+/appium')],
  ['POST', new RegExp('^/session/[^/]+/touch/perform')],
  ['POST', new RegExp('^/session/[^/]+/touch/multi/perform')],
  ['POST', new RegExp('^/session/[^/]+/orientation')],
  ['GET', new RegExp('^/session/[^/]+/orientation')],
];

class AndroidDriver extends BaseDriver {
  constructor (opts = {}, shouldValidateCaps = true) {
    super(opts, shouldValidateCaps);

    log.debug(`AndroidDriver version: ${version}`);

    this.locatorStrategies = [
      'xpath',
      'id',
      'class name',
      'accessibility id',
      '-android uiautomator'
    ];
    this.desiredCapConstraints = desiredConstraints;
    this.sessionChromedrivers = {};
    this.jwpProxyActive = false;
    this.jwpProxyAvoid = _.clone(NO_PROXY);
    this.settings = new DeviceSettings({ignoreUnimportantViews: false},
                                       this.onSettingsUpdate.bind(this));
    this.chromedriver = null;
    this.apkStrings = {};
    this.bootstrapPort = opts.bootstrapPort || DEVICE_PORT;
    this.unlocker = helpers.unlocker;

    for (let [cmd, fn] of _.pairs(commands)) {
      AndroidDriver.prototype[cmd] = fn;
    }
  }

  async createSession (caps) {
    // the whole createSession flow is surrounded in a try-catch statement
    // if creating a session fails at any point, we teardown everything we
    // set up before throwing the error.
    try {
      let sessionId;
      [sessionId] = await super.createSession(caps);

      let serverDetails = {platform: 'LINUX',
                           webStorageEnabled: false,
                           takesScreenshot: true,
                           javascriptEnabled: true,
                           databaseEnabled: false,
                           networkConnectionEnabled: true,
                           locationContextEnabled: false,
                           warnings: {},
                           desired: this.caps};

      this.caps = Object.assign(serverDetails, this.caps);

      // assigning defaults
      let defaultOpts = {
        action: "android.intent.action.MAIN",
        category: "android.intent.category.LAUNCHER",
        flags: "0x10200000",
        disableAndroidWatchers: false,
        tmpDir: await tempDir.staticDir(),
        fullReset: false,
        autoLaunch: true,
        adbPort: DEFAULT_ADB_PORT,
        androidInstallTimeout: 90000
      };
      _.defaults(this.opts, defaultOpts);
      if (!this.opts.javaVersion) {
        this.opts.javaVersion = await helpers.getJavaVersion();
      }
      this.useUnlockHelperApp = _.isUndefined(this.caps.unlockType);

      // not user visible via caps
      if (this.opts.noReset === true) this.opts.fullReset = false;
      if (this.opts.fullReset === true) this.opts.noReset = false;
      this.opts.fastReset = !this.opts.fullReset && !this.opts.noReset;
      this.opts.skipUninstall = this.opts.fastReset || this.opts.noReset;

      this.curContext = this.defaultContextName();

      if (this.isChromeSession) {
        log.info("We're going to run a Chrome-based session");
        let {pkg, activity} = helpers.getChromePkg(this.opts.browserName);
        this.opts.appPackage = pkg;
        this.opts.appActivity = activity;
        log.info(`Chrome-type package and activity are ${pkg} and ${activity}`);
      }

      if (this.opts.nativeWebScreenshot) {
        this.jwpProxyAvoid.push(['GET', new RegExp('^/session/[^/]+/screenshot')]);
      }

      if (this.opts.reboot) {
        this.setAvdFromCapabilities(caps);
        this.addWipeDataToAvdArgs();
      }

      // get device udid for this session
      let {udid, emPort} = await helpers.getDeviceInfoFromCaps(this.opts);
      this.opts.udid = udid;
      this.opts.emPort = emPort;

      // set up an instance of ADB
      this.adb = await helpers.createADB(this.opts.javaVersion,
                                         this.opts.udid,
                                         this.opts.emPort,
                                         this.opts.adbPort,
                                         this.opts.suppressKillServer);

      if (this.helpers.isPackageOrBundle(this.opts.app)){
        // user provided package instead of app for 'app' capability, massage options
        this.opts.appPackage = this.opts.app;
        this.opts.app = null;
      }

      if (this.opts.app) {
        // find and copy, or download and unzip an app url or path
        this.opts.app = await this.helpers.configureApp(this.opts.app, APP_EXTENSION);
        this.opts.appIsTemp = caps.app !== this.opts.app; // did we make a temporary copy?
        await this.checkAppPresent();
      } else if (this.appOnDevice) {
        // the app isn't an actual app file but rather something we want to
        // assume is on the device and just launch via the appPackage
        log.info(`App file was not listed, instead we're going to run ` +
                 `${this.opts.appPackage} directly on the device`);
        await this.checkPackagePresent();
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

  isEmulator () {
    return !!(this.opts.avd || /emulator/.test(this.opts.udid));
  }

  setAvdFromCapabilities (caps) {
    if (this.opts.avd) {
      log.info('avd name defined, ignoring device name and platform version');
    } else {
      if (!caps.deviceName) {
        log.errorAndThrow('avd or deviceName should be specified when reboot option is enables');
      }
      if (!caps.platformVersion) {
        log.errorAndThrow('avd or platformVersion should be specified when reboot option is enabled');
      }
      let avdDevice = caps.deviceName.replace(/[^a-zA-Z0-9_.]/g, "-");
      this.opts.avd = `${avdDevice}__${caps.platformVersion}`;
    }
  }

  addWipeDataToAvdArgs () {
    if (!this.opts.avdArgs) {
      this.opts.avdArgs = '-wipe-data';
    } else  if (this.opts.avdArgs.toLowerCase().indexOf("-wipe-data") === -1) {
      this.opts.avdArgs += ' -wipe-data';
    }
  }

  get appOnDevice () {
    return this.helpers.isPackageOrBundle(this.opts.app) || (!this.opts.app &&
           this.helpers.isPackageOrBundle(this.opts.appPackage));
  }

  get isChromeSession () {
    return helpers.isChromeBrowser(this.opts.browserName);
  }

  async onSettingsUpdate (key, value) {
    if (key === "ignoreUnimportantViews") {
      await this.setCompressedLayoutHierarchy(value);
    }
  }

  async startAndroidSession () {
    log.info(`Starting Android session`);
    // set up the device to run on (real or emulator, etc)
    this.defaultIME = await helpers.initDevice(this.adb, this.opts);

    // set actual device name, udid, platform version, screen size, model and manufacturer details
    this.caps.deviceName = this.adb.curDeviceId;
    this.caps.deviceUDID = this.opts.udid;
    this.caps.platformVersion = await this.adb.getPlatformVersion();
    this.caps.deviceScreenSize = await this.adb.getScreenSize();
    this.caps.deviceModel = await this.adb.getModel();
    this.caps.deviceManufacturer = await this.adb.getManufacturer();

    // If the user sets autoLaunch to false, they are responsible for initAUT() and startAUT()
    if (this.opts.autoLaunch) {
      // set up app under test
      await this.initAUT();
    }
    // start UiAutomator
    this.bootstrap = new helpers.bootstrap(this.adb, this.bootstrapPort, this.opts.websocket);
    await this.bootstrap.start(this.opts.appPackage, this.opts.disableAndroidWatchers, this.opts.acceptSslCerts);
    // handling unexpected shutdown
    this.bootstrap.onUnexpectedShutdown.catch(async (err) => {
      if (!this.bootstrap.ignoreUnexpectedShutdown) {
        await this.startUnexpectedShutdown(err);
      }
    });

    // Let's try to unlock the device
    await helpers.unlock(this, this.adb, this.caps);

    // Set CompressedLayoutHierarchy on the device based on current settings object
    // this has to happen _after_ bootstrap is initialized
    if (this.opts.ignoreUnimportantViews) {
      await this.settings.update({ignoreUnimportantViews: this.opts.ignoreUnimportantViews});
    }

    if (this.isChromeSession) {
      // start a chromedriver session and proxy to it
      await this.startChromeSession();
      if (this.shouldDismissChromeWelcome()) {
        // dismiss Chrome welcome dialog
        await this.dismissChromeWelcome();
      }
    } else {
      if (this.opts.autoLaunch) {
        // start app
        await this.startAUT();
      }
    }
    await this.initAutoWebview();
  }

  shouldDismissChromeWelcome () {
    return !_.isUndefined(this.opts.chromeOptions) &&
      _.isArray(this.opts.chromeOptions.args) &&
      this.opts.chromeOptions.args.indexOf('--no-first-run') !== -1;
  }

  async dismissChromeWelcome () {
    log.info("Trying to dismiss Chrome welcome");
    let activity = await this.getCurrentActivity();
    if (activity !== "org.chromium.chrome.browser.firstrun.FirstRunActivity") {
      log.info("Chrome welcome dialog never showed up! Continuing");
      return;
    }
    let el = await this.findElOrEls('id', 'com.android.chrome:id/terms_accept', false);
    await this.click(el.ELEMENT);
    try {
      let el = await this.findElOrEls('id', 'com.android.chrome:id/negative_button', false);
      await this.click(el.ELEMENT);
    } catch (e) {
      // DO NOTHING, THIS DEVICE DIDNT LAUNCH THE SIGNIN DIALOG
      // IT MUST BE A NON GMS DEVICE
      log.warn(`This device didnt show Chrome SignIn dialog, ${e.message}`);
    }
  }

  async initAutoWebview () {
    if (this.opts.autoWebview) {
      let viewName = this.defaultWebviewName();
      let timeout = (this.opts.autoWebviewTimeout) || 2000;

      log.info(`Setting auto webview to context '${viewName}' with timeout ${timeout}ms`);

      // try every 500ms until timeout is over
      await retryInterval(timeout / 500, 500, async () => {
        await this.setContext(viewName);
      });
    }
  }

  async initAUT () {
    // populate appPackage, appActivity, appWaitPackage, appWaitActivity,
    // and the device being used
    // in the opts and caps (so it gets back to the user on session creation)
    let launchInfo = await helpers.getLaunchInfo(this.adb, this.opts);
    Object.assign(this.opts, launchInfo);
    Object.assign(this.caps, launchInfo);
    // install app
    if (!this.opts.app) {
      if (this.opts.fullReset) {
        log.errorAndThrow('Full reset requires an app capability, use fastReset if app is not provided');
      }
      log.debug('No app capability. Assuming it is already on the device');
      if (this.opts.fastReset) {
        await helpers.resetApp(this.adb, this.opts.app, this.opts.appPackage, this.opts.fastReset);
      }
      await this.grantPermissions();
      return;
    }
    if (!this.opts.skipUninstall) {
      await this.adb.uninstallApk(this.opts.appPackage);
    }
    await helpers.installApkRemotely(this.adb, this.opts);
    await this.grantPermissions();
    this.apkStrings[this.opts.language] = await helpers.pushStrings(
        this.opts.language, this.adb, this.opts);
  }

  async startChromeSession () {
    log.info("Starting a chrome-based browser session");
    let opts = _.cloneDeep(this.opts);
    opts.chromeUseRunningApp = false;

    const knownPackages = ["org.chromium.chrome.shell",
                           "com.android.chrome",
                           "com.chrome.beta",
                           "org.chromium.chrome",
                           "org.chromium.webview_shell"];

    if (!_.contains(knownPackages, this.opts.appPackage)) {
      opts.chromeAndroidActivity = this.opts.appActivity;
    }
    this.chromedriver = await setupNewChromedriver(opts, this.adb.curDeviceId,
                                                   this.adb.getAdbServerPort());
    this.chromedriver.on(Chromedriver.EVENT_CHANGED, (msg) => {
      if (msg.state === Chromedriver.STATE_STOPPED) {
        this.onChromedriverStop(CHROMIUM_WIN);
      }
    });

    // Now that we have a Chrome session, we ensure that the context is
    // appropriately set and that this chromedriver is added to the list
    // of session chromedrivers so we can switch back and forth
    this.curContext = CHROMIUM_WIN;
    this.sessionChromedrivers[CHROMIUM_WIN] = this.chromedriver;
    this.proxyReqRes = this.chromedriver.proxyReq.bind(this.chromedriver);
    this.jwpProxyActive = true;
  }

  async checkAppPresent () {
    log.debug("Checking whether app is actually present");
    if (!(await fs.exists(this.opts.app))) {
      log.errorAndThrow(`Could not find app apk at ${this.opts.app}`);
    }
  }

  async checkPackagePresent () {
    log.debug("Checking whether package is present on the device");
    if (!(await this.adb.shell(['pm', 'list', 'packages', this.opts.appPackage]))) {
      log.errorAndThrow(`Could not find package ${this.opts.appPackage} on the device`);
    }
  }

  async grantPermissions () {
    if (this.opts.autoGrantPermissions) {
      try {
        await this.adb.grantAllPermissions(this.opts.appPackage, this.opts.app);
      } catch (error) {
        log.error(`Unable to grant permissions requested. Original error: ${error.message}`);
      }
    }
  }
  // Set CompressedLayoutHierarchy on the device
  async setCompressedLayoutHierarchy (compress) {
    await this.bootstrap.sendAction("compressedLayoutHierarchy", {compressLayout: compress});
  }

  async deleteSession () {
    log.debug("Shutting down Android driver");
    await super.deleteSession();
    if (this.bootstrap) {
      // certain cleanup we only care to do if the bootstrap was ever run
      await this.stopChromedriverProxies();
      if (this.opts.unicodeKeyboard && this.opts.resetKeyboard && this.defaultIME) {
        log.debug(`Resetting IME to ${this.defaultIME}`);
        await this.adb.setIME(this.defaultIME);
      }
      if (!this.isChromeSession) {
        await this.adb.forceStop(this.opts.appPackage);
      }
      await this.adb.goToHome();
      if (this.opts.fullReset && !this.opts.skipUninstall && !this.appOnDevice) {
        await this.adb.uninstallApk(this.opts.appPackage);
      }
      await this.bootstrap.shutdown();
      this.bootstrap = null;
    } else {
      log.debug("Called deleteSession but bootstrap wasn't active");
    }
    // some cleanup we want to do regardless, in case we are shutting down
    // mid-startup
    await this.adb.stopLogcat();
    if (this.useUnlockHelperApp) {
      await this.adb.forceStop('io.appium.unlock');
    }
    if (this.opts.reboot) {
      let avdName = this.opts.avd.replace('@', '');
      log.debug(`closing emulator '${avdName}'`);
      await this.adb.killEmulator(avdName);
    }
    if (this.opts.clearSystemFiles) {
      if (this.opts.appIsTemp) {
        log.debug(`Temporary copy of app was made: deleting '${this.opts.app}'`);
        try {
          await fs.rimraf(this.opts.app);
        } catch (err) {
          log.warn(`Unable to delete temporary app: ${err.message}`);
        }
      } else {
        log.debug('App was not copied, so not deleting');
      }
    } else {
      log.debug('Not cleaning generated files. Add `clearSystemFiles` capability if wanted.');
    }
  }

  validateDesiredCaps (caps) {
    // check with the base class, and return if it fails
    let res = super.validateDesiredCaps(caps);
    if (!res) return res;

    // make sure that the capabilities have one of `app`, `appPackage` or `browser`
    if ((!caps.browserName || !helpers.isChromeBrowser(caps.browserName)) &&
      !caps.app && !caps.appPackage) {
      let msg = 'The desired capabilities must include either an app, appPackage or browserName';
      log.errorAndThrow(msg);
    }
    // warn if the capabilities have both `app` and `browser, although this
    // is common with selenium grid
    if (caps.browserName && caps.app) {
      let msg = 'The desired capabilities should generally not include both an app and a browserName';
      log.warn(msg);
    }
  }

  proxyActive (sessionId) {
    super.proxyActive(sessionId);

    return this.jwpProxyActive;
  }

  getProxyAvoidList (sessionId) {
    super.getProxyAvoidList(sessionId);

    return this.jwpProxyAvoid;
  }

  canProxy (sessionId) {
    super.canProxy(sessionId);

    // this will change depending on ChromeDriver status
    return _.isFunction(this.proxyReqRes);
  }
}

export default AndroidDriver;
