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

    if (!this.opts.javaVersion) {
      this.opts.javaVersion = await helpers.getJavaVersion();
    }

    await this.startAndroidSession(this.opts);

    return [sessionId, caps];
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
    this.bootstrap = new Bootstrap(DEVICE_PORT);
    await this.bootstrap.start(this.opts.appPackage, false);
    // unlock
    await helpers.unlock(this.adb);
    // start app
    await this.startAUT();

  }

  async initDevice () {
    let {deviceId, emPort} = await helpers.getActiveDevice(this.adb, this.opts.udid);

    // TODO no active device, start an emulator? throw an error?

    this.adb.setDeviceId(deviceId);
    this.adb.setEmulatorPort(emPort);

    await this.adb.waitForDevice();


    await helpers.pushUnlock(this.adb);
    await helpers.pushSettingsApp(this.adb);
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
      action: "android.intent.action.MAIN",
      category: "android.intent.category.LAUNCHER",
      flags: "0x10200000"
    });
  }
}

for (let [cmd, fn] of _.pairs(commands)) {
  AndroidDriver.prototype[cmd] = fn;
}

export default AndroidDriver;
