import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { AndroidDriver } from '../..';
import sampleApps from 'sample-apps';

chai.should();
chai.use(chaiAsPromised);

let driver;
let defaultCaps = {
  app: sampleApps('ApiDemos-debug'),
  deviceName: 'Android',
  platformName: 'Android'
};

describe('createSession', function () {
  before(() => {
    driver = new AndroidDriver();
  });
  afterEach(async () => {
    await driver.deleteSession();
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
  it('should error out if neither an app or a browser is defined', async () => {
    let caps = Object.assign({}, defaultCaps);
    caps.app = '';
    await driver.createSession(caps).should.eventually.be.rejectedWith(/include/);
  });
  it('should error out if both an app and a browser is defined', async () => {
    let caps = Object.assign({}, defaultCaps);
    caps.browserName = 'Chrome';
    await driver.createSession(caps).should.eventually.be.rejectedWith(/both/);
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
    let {appPackage, appActivity} = await driver.adb.getFocusedPackageAndActivity();
    appPackage.should.not.equal(caps.appPackage);
    appActivity.should.not.equal(caps.appActivity);
  });
  it('should be able to launch activity with custom intent parameter category', async () => {
    let caps = Object.assign({}, defaultCaps);
    caps.appPackage = 'io.appium.android.apis';
    caps.appActivity = 'io.appium.android.apis.app.HelloWorld';
    caps.intentCategory = 'appium.android.intent.category.SAMPLE_CODE';
    await driver.createSession(caps);
    let {appActivity} = await driver.adb.getFocusedPackageAndActivity();
    appActivity.should.include('HelloWorld');
  });
  it('should be able to load an app via package', async () => {
    let caps = Object.assign({}, defaultCaps);
    caps.app = '';
    caps.appPackage = 'io.appium.android.apis';
    caps.appActivity = '.ApiDemos';
    await driver.createSession(caps);
    let {appPackage} = await driver.adb.getFocusedPackageAndActivity();
    appPackage.should.include('io.appium.android.apis');
  });
  it('should error out if package is not on the device', async () => {
    let caps = Object.assign({}, defaultCaps);
    caps.app = '';
    caps.appPackage = 'sipa.diordna.muippa.oi';
    caps.appActivity = '.ApiDemos';
    await driver.createSession(caps).should.eventually.be.rejectedWith(/Could not find package/);
  });
});

describe('Commands', function () {
  before(() => {
    driver = new AndroidDriver();
  });
  afterEach(async () => {
    await driver.deleteSession();
  });
  describe('Alerts', function () {
    it('should throw a notYetImplemented error for alert methods', async () => {
      await driver.createSession(defaultCaps);
      await driver.getAlertText().should.eventually.be.rejectedWith(/implemented/);
      await driver.setAlertText('new text').should.eventually.be.rejectedWith(/implemented/);
      await driver.postAcceptAlert().should.eventually.be.rejectedWith(/implemented/);
      await driver.postDismissAlert().should.eventually.be.rejectedWith(/implemented/);
    });
  });
});
