import { BaseDriver, DeviceSettings } from 'appium-base-driver';
import ADB from 'appium-adb';
import Bootstrap from 'appium-android-bootstrap';
import desiredConstraints from './desired-caps';
import commands from './commands/index';
import helpers from './android-helpers';
import log from './logger';
import _ from 'lodash';
import { fs, tempDir } from 'appium-support';
import path from 'path';

const APP_EXTENSION = '.apk';
const DEVICE_PORT = 4724;

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
    this.settings = new DeviceSettings({ignoreUnimportantViews: false});
  }

  async createSession (caps) {
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
    // Add condition for chrome driver
    if (this.opts.app) {
      // download and unzip
      this.opts.app = await this.helpers.configureApp(this.opts.app, APP_EXTENSION);
    }
    await this.checkAppPresent();
    await this.startAndroidSession(this.opts);
    return [sessionId, caps];
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
    // set up app under test
    await this.initAUT();
    // start UiAutomator
    this.bootstrap = new Bootstrap(DEVICE_PORT, this.opts.websocket);
    await this.bootstrap.start(this.opts.appPackage, this.opts.disableAndroidWatchers);
    // unlock
    await helpers.unlock(this.adb);
    // start app
    await this.startAUT();

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
    await this.pushStrings();
    await this.setProcessFromManifest();
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
  async pushStrings () {
    let remotePath = '/data/local/tmp';
    let stringsJson = 'strings.json';
    let stringsTmpDir = path.resolve(this.opts.tmpDir, this.opts.appPackage);
    try {
      let {apkStrings, localPath} = await this.adb.extractStringsFromApk(
            this.opts.language, this.opts.app, stringsTmpDir);
      this.apkStrings[this.opts.language] = apkStrings;
      let jsonFile = path.join(localPath, stringsJson);
      await this.adb.push(jsonFile, remotePath);
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
    await this.bootstrap.sendCommand("compressedLayoutHierarchy", {compressLayout: compress});
  }
}

for (let [cmd, fn] of _.pairs(commands)) {
  AndroidDriver.prototype[cmd] = fn;
}

export default AndroidDriver;
