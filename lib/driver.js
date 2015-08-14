import { BaseDriver } from 'appium-base-driver';
import ADB from 'appium-adb';
import Bootstrap from 'appium-android-bootstrap';
import desiredConstraints from './desired-caps';
import commands from './commands/index';
import helpers from './android-helpers';
import log from './logger';
import _ from 'lodash';

const APP_EXTENSION = '.apk';
const DEVICE_PORT = 4724;

class AndroidDriver extends BaseDriver {
  constructor (opts = {}, shouldValidateCaps = true) {
    super(opts, shouldValidateCaps);
    this.desiredConstraints = desiredConstraints;
    this.locatorStrategies = [
      'xpath',
      'id',
      'class name',
      'tag name',
      'accessibility id',
      '-android uiautomator'
    ];
  }

  async createSession (caps) {
    let sessionId;
    [sessionId] = await super.createSession(caps);

    // TODO fail if app file is missing, or if app is not on the device?
    // assigning defaults
    let defaultOpts = {action: "android.intent.action.MAIN",
                       category: "android.intent.category.LAUNCHER",
                       flags: "0x10200000",
                       disableAndroidWatchers: false};
    _.defaults(this.opts, defaultOpts);
    if (!this.opts.javaVersion) {
      this.opts.javaVersion = await helpers.getJavaVersion();
    }
    // Add condition for chrome driver
    await this.checkAppPresent();
    await this.startAndroidSession(this.opts);


    return [sessionId, caps];
  }

  async startAndroidSession () {
    log.info(`Starting Android session`);

    // set up an instance of ADB
    this.adb = await ADB.createADB();

    // set up the device to run on (real or emulator, etc)
    this.defaultIME = await helpers.initDeviceAndGetDefaultIME(this.adb, this.opts);
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

  async initAUT () {
    if (this.opts.app) {
      // download and unzip
      this.opts.app = await this.helpers.configureApp(this.opts.app, APP_EXTENSION);
    }

    // populate appPackage, appActivity, appWaitPackage, appWaitActivity
    let launchInfo = await helpers.getLaunchInfo(this.adb, this.opts);
    Object.assign(this.opts, launchInfo);

    // install app
    await helpers.installApkRemotely(this.adb, this.opts.app, this.opts.appPackage, this.opts.fastReset);

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
      stopApp: this.opts.stopAppOnReset || !this.opts.dontStopAppOnReset
      pkg: this.opts.appPackage,
      activity: this.opts.appActivity,
    });
  }

  async checkAppPresent () {
    logger.debug("Checking whether app is actually present");
    if (!(await fs.exists(this.opts.app))) {
      logger.errorAndThrow(`Could not find app apk at ${this.opts.app}`);
    }
  }

  async pushStrings (language) {
    let remotePath = '/data/local/tmp';
    let stringsJson = 'strings.json';
    let stringsTmpDir = path.resolve(this.opts.tmpDir, this.opts.appPackage);
    try {
      let {apkStrings, localPath} = await this.adb.extractStringsFromApk(
            this.opts.language, this.opts.app, stringsTmpDir);
      this.apkStrings[this.opts.language] = apkStrings;
      await this.adb.push(jsonFile, remotePath);
    } catch (err) {
      if (!(await fs.exists(this.opts.app))) {
        // delete remote string.json if present
        await this.adb.rimraf(`${remotePath}/${stringsJson}`);
      } else {
        log.warn("Could not get strings, continuing anyway");
        let remoteFile = remotePath + '/' + stringsJson;
        await this.adb.shell(`echo '{}' > ${remoteFile}`);
      }
    }
  }
}

for (let [cmd, fn] of _.pairs(commands)) {
  AndroidDriver.prototype[cmd] = fn;
}

export default AndroidDriver;
