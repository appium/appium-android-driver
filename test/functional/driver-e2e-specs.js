import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import 'mochawait';
import { AndroidDriver } from '../../..';
import sampleApps from 'sample-apps';
//import ADB from 'appium-adb';

let apiDemos = sampleApps('ApiDemos-debug');

chai.should();
chai.use(chaiAsPromised);

describe('createSession', function () {
  let driver;
  this.timeout(20000);
  before(() => {
    driver = new AndroidDriver();
  });
  it('should start android session focusing on default pkg and act ', async () => {
    let caps = {
      app: apiDemos,
      deviceName: 'Android',
      platformName: 'Android'
    };
    await driver.createSession(caps);
    let {appPackage, appActivity} = await driver.adb.getFocusedPackageAndActivity();
    appPackage.should.equal('io.appium.android.apis');
    appActivity.should.equal('.ApiDemos');
  });
  it('should start android session focusing on custom pkg and act ', async () => {
    let pkg = 'io.appium.android.apis';
    let act = '.view.SplitTouchView';
    let caps = {
      app: apiDemos,
      deviceName: 'Android',
      platformName: 'Android',
      appPackage: pkg,
      appActivity: act
    };
    await driver.createSession(caps);
    let {appPackage, appActivity} = await driver.adb.getFocusedPackageAndActivity();
    appPackage.should.equal(pkg);
    appActivity.should.equal(act);
  });
  it('should error out for not apk extention', async () => {
    let pkg = 'io.appium.android.apis';
    let act = '.view.SplitTouchView';
    let caps = {
      app: "foo",
      deviceName: 'Android',
      platformName: 'Android',
      appPackage: pkg,
      appActivity: act
    };
    await driver.createSession(caps).should.eventually.be.rejectedWith(/apk/);
  });
  it('should error out for invalid app path', async () => {
    let pkg = 'io.appium.android.apis';
    let act = '.view.SplitTouchView';
    let caps = {
      app: "foo.apk",
      deviceName: 'Android',
      platformName: 'Android',
      appPackage: pkg,
      appActivity: act
    };
    await driver.createSession(caps).should.eventually.be.rejectedWith(/Could not find app/);
  });
  afterEach(async () => {
    await driver.deleteSession();
  });
});
