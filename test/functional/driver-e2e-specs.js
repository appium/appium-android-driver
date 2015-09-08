import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import 'mochawait';
import { AndroidDriver } from '../../..';
import sampleApps from 'sample-apps';

chai.should();
chai.use(chaiAsPromised);

describe('createSession', function () {
  let driver;
  let defaultCaps = {
    app: sampleApps('ApiDemos-debug'),
    deviceName: 'Android',
    platformName: 'Android'
  };
  this.timeout(20000);
  before(() => {
    driver = new AndroidDriver();
  });
  it('should start android session focusing on default pkg and act', async () => {
    await driver.createSession(defaultCaps);
    let {appPackage, appActivity} = await driver.adb.getFocusedPackageAndActivity();
    appPackage.should.equal('io.appium.android.apis');
    appActivity.should.equal('.ApiDemos');
  });
  it('should start android session focusing on custom pkg and act', async () => {
    let caps = Object.assign({}, defaultCaps);
    caps.appPackage = 'io.appium.android.apis';
    caps.appActivity = '.view.SplitTouchView';
    await driver.createSession(caps);
    let {appPackage, appActivity} = await driver.adb.getFocusedPackageAndActivity();
    appPackage.should.equal(caps.appPackage);
    appActivity.should.equal(caps.appActivity);
  });
  it('should error out for not apk extention', async () => {
    let caps = Object.assign({}, defaultCaps);
    caps.app = 'foo';
    caps.appPackage = 'io.appium.android.apis';
    caps.appActivity = '.view.SplitTouchView';
    await driver.createSession(caps).should.eventually.be.rejectedWith(/apk/);
  });
  it('should error out for invalid app path', async () => {
    let caps = Object.assign({}, defaultCaps);
    caps.app = 'foo.apk';
    caps.appPackage = 'io.appium.android.apis';
    caps.appActivity = '.view.SplitTouchView';
    await driver.createSession(caps).should.eventually.be.rejectedWith(/Could not find app/);
  });
  it('should be able to start session without launching or installing app', async () => {
    let caps = Object.assign({}, defaultCaps);
    caps.appPackage = 'io.appium.android.apis';
    caps.appActivity = '.view.SplitTouchView';
    caps.autoLaunch = false;
    await driver.createSession(caps);
    await driver.adb.getFocusedPackageAndActivity().should.eventually.be.null;
  });
  it('should be able to launch activity with custom intent parameter category', async () => {
    let caps = Object.assign({}, defaultCaps);
    caps.appPackage = 'io.appium.android.apis';
    caps.appActivity = 'io.appium.android.apis.app.HelloWorld';
    caps.intentCategory = 'appium.android.intent.category.SAMPLE_CODE';
    await driver.createSession(caps);
    let {appPackage, appActivity} = await driver.adb.getFocusedPackageAndActivity();
    appActivity.should.include('HelloWorld');
  });
  it.skip('should be able to load an app via package', async () => {
    // TODO: 1.5 doesn't support this. Should it?
    let caps = Object.assign({}, defaultCaps);
    caps.app = 'io.appium.android.apis';
    caps.appActivity = '.ApiDemos';
    await driver.createSession(caps);
  });
  afterEach(async () => {
    await driver.deleteSession();
  });
});
