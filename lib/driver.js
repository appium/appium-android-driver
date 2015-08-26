import { BaseDriver, DeviceSettings } from 'appium-base-driver';
import ADB from 'appium-adb';
import Chromedriver from 'appium-chromedriver';
import Bootstrap from 'appium-android-bootstrap';
import desiredConstraints from './desired-caps';
import commands from './commands/index';
import { setupNewChromedriver } from './commands/context';
import helpers from './android-helpers';
import { CHROMIUM_WIN } from './webview-helpers';
import log from './logger';
import _ from 'lodash';
import { fs, tempDir } from 'appium-support';
import path from 'path';

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
      'tag name',
      'accessibility id',
      '-android uiautomator'
    ];
    this.desiredCapConstraints = desiredConstraints;
    this.curContext = this.defaultContextName();
    this.sessionChromedrivers = {};
    this.jwpProxyAvoid = NO_PROXY;
    this.settings = new DeviceSettings({ignoreUnimportantViews: false},
                                       this.onSettingsUpdate.bind(this));
    this.apkStrings = [];
  }

  async createSession (caps) {
    // the whole createSession flow is surrounded in a try-catch statement
    // if creating a session fails at any point, we teardown everything we
    // set up before throwing the error.
    try {

      let sessionId;
      [sessionId] = await super.createSession(caps);

      // TODO fail if app file is missing, or if app is not on the device?
      // assigning defaults
      let defaultOpts = {action: "android.intent.action.MAIN",
                         category: "android.intent.category.LAUNCHER",
                         flags: "0x10200000",
                         disableAndroidWatchers: false,
                         tmpDir: await tempDir.staticDir(),
                         fullReset: false};
      _.defaults(this.opts, defaultOpts);
      if (!this.opts.javaVersion) {
        this.opts.javaVersion = await helpers.getJavaVersion();
      }

      // TODO extend the validation function to prove that we always either have
      // browserName or app, so we don't have to throw an error if neither of
      // these conditions is met. Also need to make sure we don't have BOTH
      // app and browserName!
      if (this.isChromeSession) {
        log.info("We're going to run a Chrome-based session");
        let {pkg, activity} = helpers.getChromePkg(this.opts.browserName);
        this.opts.appPackage = pkg;
        this.opts.appActivity = activity;
        log.info(`Chrome-type package and activity are ${pkg} and ${activity}`);
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
      }

      await this.startAndroidSession(this.opts);
      return [sessionId, caps];

    } catch(e) {
      await this.deleteSession();
      throw e;
    }
  }

  get appOnDevice () {
    return !this.opts.app &&
           this.helpers.isPackageOrBundle(this.opts.appPackage);
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
    // set up an instance of ADB
    this.adb = await ADB.createADB();
    // set up the device to run on (real or emulator, etc)
    await this.initDevice();
    if (!this.appOnDevice) {
      // set up app under test
      await this.initAUT();
    }
    // start UiAutomator
    this.bootstrap = new Bootstrap(DEVICE_PORT, this.opts.websocket);
    await this.bootstrap.start(this.opts.appPackage, this.opts.disableAndroidWatchers);
    // handling unexpected shutdown
    this.bootstrap.onUnexpectedShutdown.catch(async (err) => {
      await this.startUnexpectedShutdown(err);
    });
    if (this.isChromeSession) {
      // start a chromedriver session and proxy to it
      await this.startChromeSession();
    } else {
      // unlock---don't need to do this for chrome
      await helpers.unlock(this.adb);
      // start app
      await this.startAUT();
    }
  }

  async initDevice () {
    if (this.opts.avd) {
      await helpers.prepareEmulator(this.adb, this.opts);
    }
    let {deviceId, emPort} = await helpers.getActiveDevice(this.adb, this.opts.udid);
    this.adb.setDeviceId(deviceId);
    if (emPort) {
      this.adb.setEmulatorPort(emPort);
    }

    await this.adb.waitForDevice();
    await helpers.ensureDeviceLocale(this.adb, this.opts.language,
                                     this.opts.locale);
    await this.adb.startLogcat();
    if (this.opts.unicodeKeyboard) {
      this.defaultIME = await helpers.initUnicode(this.adb);
    }
    await helpers.pushSettingsApp(this.adb);
    await helpers.pushUnlock(this.adb);
    // Set CompressedLayoutHierarchy on the device based on current settings object
    if (this.opts.ignoreUnimportantViews) {
      await this.settings.update({ignoreUnimportantViews: this.opts.ignoreUnimportantViews});
    }
  }

  async initAUT () {
    // populate appPackage, appActivity, appWaitPackage, appWaitActivity
    let launchInfo = await helpers.getLaunchInfo(this.adb, this.opts);
    Object.assign(this.opts, launchInfo);
    if (!this.opts.skipUninstall) {
        await this.adb.uninstallApk(this.opts.appPackage);
    }
    // install app
    await helpers.installApkRemotely(this.adb, this.opts.app, this.opts.appPackage, this.opts.fastReset);
    await this.pushStrings(this.opts.language);
    return launchInfo;
  }

  async startAUT () {
    await this.adb.startApp({
      pkg: this.opts.appPackage,
      activity: this.opts.appActivity,
      action: this.opts.intentAction,
      category: this.opts.intentCategory,
      flags: this.opts.intentFlags,
      waitPkg: this.opts.appWaitPackage,
      waitActivity: this.opts.appWaitActivity,
      optionalIntentArguments: this.opts.optionalIntentArguments,
      stopApp: this.opts.stopAppOnReset || !this.opts.dontStopAppOnReset,
    });
  }

  async startChromeSession () {
    log.info("Starting a chrome-based browser session");
    let opts = _.cloneDeep(this.opts);
    opts.chromeUseRunningApp = false;

    const knownPackages = ["org.chromium.chrome.shell",
                           "com.android.chrome",
                           "com.chrome.beta"];

    if (!_.contains(knownPackages, this.opts.appPackage)) {
      opts.chromeAndroidActivity = this.opts.appActivity;
    }
    this.chromedriver = await setupNewChromedriver(opts, this.adb.curDeviceId);
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

  // pushStings method extracts string.xml and converts it to string.json and pushes
  // it to /data/local/tmp/string.json on for use of bootstrap
  // if app is not present to extract string.xml it deletes remote strings.json
  // if app does not have strings.xml we push an empty json object to remote
  async pushStrings (language) {
    let remotePath = '/data/local/tmp';
    let stringsJson = 'strings.json';
    let stringsTmpDir = path.resolve(this.opts.tmpDir, this.opts.appPackage);
    try {
      log.debug('Extracting strings from apk', this.opts.app, language, stringsTmpDir);
      let {apkStrings, localPath} = await this.adb.extractStringsFromApk(
            this.opts.app, language, stringsTmpDir);
      this.apkStrings[language] = apkStrings;
      await this.adb.push(localPath, remotePath);
    } catch (err) {
      if (!(await fs.exists(this.opts.app))) {
        // delete remote string.json if present
        await this.adb.rimraf(`${remotePath}/${stringsJson}`);
      } else {
        log.warn("Could not get strings, continuing anyway");
        let remoteFile = `${remotePath}/${stringsJson}`;
        await this.adb.shell('echo', [`'{}' > ${remoteFile}`]);
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
      await this.adb.stopLogcat();
      await this.bootstrap.shutdown();
      this.bootstrap = null;
    } else {
      log.warn("Cannot shut down Android driver; it has already shut down");
    }
  }
}

for (let [cmd, fn] of _.pairs(commands)) {
  AndroidDriver.prototype[cmd] = fn;
}

export default AndroidDriver;
