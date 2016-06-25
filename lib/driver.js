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
    this.acceptSslCerts = !!opts.acceptSslCerts;
    this.bootstrapPort = opts.bootstrapPort || DEVICE_PORT;
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
        adbPort: DEFAULT_ADB_PORT
      };
      _.defaults(this.opts, defaultOpts);
      if (!this.opts.javaVersion) {
        this.opts.javaVersion = await helpers.getJavaVersion();
      }

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

      // get device udid for this session
      let {udid, emPort} = await helpers.getDeviceInfoFromCaps(this.opts);
      this.opts.udid = udid;
      this.opts.emPort = emPort;

      // set up an instance of ADB
      this.adb = await helpers.createADB(this.opts.javaVersion, this.opts.udid,
                                         this.opts.emPort,
                                         this.opts.adbPort);

      if (this.helpers.isPackageOrBundle(this.opts.app)){
        // user provided package instead of app for 'app' capability, massage options
        this.opts.appPackage = this.opts.app;
        this.opts.app = null;
      }

      if (this.opts.app) {
        // find and copy, or download and unzip an app url or path
        this.opts.app = await this.helpers.configureApp(this.opts.app, APP_EXTENSION);
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
      await this.deleteSession();
      throw e;
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

    // set actual device name, udid & platform version
    this.caps.deviceName = this.adb.curDeviceId;
    this.caps.deviceUDID = this.opts.udid;
    this.caps.platformVersion = await this.adb.getPlatformVersion();

    // Let's try to unlock before installing the app
    // unlock the device
    await helpers.unlock(this.adb);
    // If the user sets autoLaunch to false, they are responsible for initAUT() and startAUT()
    if (this.opts.autoLaunch) {
      // set up app under test
      await this.initAUT();
    }
    // start UiAutomator
    this.bootstrap = new helpers.bootstrap(this.adb, this.bootstrapPort, this.opts.websocket);
    await this.bootstrap.start(this.opts.appPackage, this.opts.disableAndroidWatchers);
    // handling unexpected shutdown
    this.bootstrap.onUnexpectedShutdown.catch(async (err) => {
      if (!this.bootstrap.ignoreUnexpectedShutdown) {
        await this.startUnexpectedShutdown(err);
      }
    });

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
    await this.initAutoWebview();
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
      return;
    }
    if (!this.opts.skipUninstall) {
      await this.adb.uninstallApk(this.opts.appPackage);
    }
    await helpers.installApkRemotely(this.adb, this.opts);
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
                           "org.chromium.chrome"];

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

  // Set CompressedLayoutHierarchy on the device
  async setCompressedLayoutHierarchy (compress) {
    await this.bootstrap.sendAction("compressedLayoutHierarchy", {compressLayout: compress});
  }

  async deleteSession () {
    log.debug("Shutting down Android driver");
    await super.deleteSession();
    if (this.bootstrap) {
      await this.stopChromedriverProxies();
      if (this.opts.unicodeKeyboard && this.opts.resetKeyboard && this.defaultIME) {
        log.debug(`Resetting IME to ${this.defaultIME}`);
        await this.adb.setIME(this.defaultIME);
      }
      if (!this.isChromeSession) {
        await this.adb.forceStop(this.opts.appPackage);
      }
      await this.adb.forceStop('io.appium.unlock');
      await this.adb.goToHome();
      if (this.opts.fullReset && !this.opts.skipUninstall && !this.appOnDevice) {
        await this.adb.uninstallApk(this.opts.appPackage);
      }
      await this.adb.stopLogcat();
      await this.bootstrap.shutdown();
      this.bootstrap = null;
    } else {
      log.warn("Cannot shut down Android driver; it has already shut down");
    }
  }

  validateDesiredCaps (caps) {
    // check with the base class, and return if it fails
    let res = super.validateDesiredCaps(caps);
    if (!res) return res;

    // make sure that the capabilities have one of `app`, `appPackage` or `browser`
    if ((!caps.browserName || !helpers.isChromeBrowser(caps.browserName)) &&
      !caps.app && !caps.appPackage) {
      let msg = 'The desired capabilities must include either an app, package or browser';
      log.errorAndThrow(msg);
    }
    // warn if the capabilities have both `app` and `browser, although this
    // is common with selenium grid
    if (caps.browserName && caps.app) {
      let msg = 'The desired capabilities should generally not include both an app and a browser';
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

for (let [cmd, fn] of _.pairs(commands)) {
  AndroidDriver.prototype[cmd] = fn;
}

export default AndroidDriver;
