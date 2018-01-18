import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import _ from 'lodash';
import ADB from 'appium-adb';
import AndroidDriver from '../..';
import DEFAULT_CAPS from './desired';


chai.should();
chai.use(chaiAsPromised);
let expect = chai.expect;

let defaultCaps = _.defaults({
  androidInstallTimeout: 90000
}, DEFAULT_CAPS);

describe('createSession', function () {
  let driver;
  before(function () {
    driver = new AndroidDriver();
  });
  afterEach(async function () {
    await driver.deleteSession();
  });

  async function getPackageAndActivity (driver) {
    let appPackage = await driver.getCurrentPackage();
    let appActivity = await driver.getCurrentActivity();
    return {appPackage, appActivity};
  }

  it('should start android session focusing on default pkg and act', async function () {
    await driver.createSession(defaultCaps);
    let {appPackage, appActivity} = await getPackageAndActivity(driver);
    appPackage.should.equal('io.appium.android.apis');
    appActivity.should.equal('.ApiDemos');
  });
  it('should start android session focusing on custom pkg and act', async function () {
    let caps = Object.assign({}, defaultCaps);
    caps.appPackage = 'io.appium.android.apis';
    caps.appActivity = '.view.SplitTouchView';
    await driver.createSession(caps);
    let {appPackage, appActivity} = await getPackageAndActivity(driver);
    appPackage.should.equal(caps.appPackage);
    appActivity.should.equal(caps.appActivity);
  });
  it('should error out for not apk extention', async function () {
    let caps = Object.assign({}, defaultCaps);
    caps.app = 'foo';
    caps.appPackage = 'io.appium.android.apis';
    caps.appActivity = '.view.SplitTouchView';
    await driver.createSession(caps).should.eventually.be.rejectedWith(/does not exist or is not accessible/);
  });
  it('should error out if neither an app or a browser is defined', async function () {
    let caps = Object.assign({}, defaultCaps);
    caps.app = '';
    await driver.createSession(caps).should.eventually.be.rejectedWith(/include/);
  });
  it('should error out for invalid app path', async function () {
    let caps = Object.assign({}, defaultCaps);
    caps.app = 'foo.apk';
    caps.appPackage = 'io.appium.android.apis';
    caps.appActivity = '.view.SplitTouchView';
    await driver.createSession(caps).should.eventually.be.rejectedWith(/Could not find/);
  });
  it('should be able to start session without launching or installing app', async function () {
    let caps = Object.assign({}, defaultCaps);
    caps.appPackage = 'io.appium.android.apis';
    caps.appActivity = '.view.SplitTouchView';
    caps.autoLaunch = false;
    await driver.createSession(caps);
    let {appPackage, appActivity} = await getPackageAndActivity(driver);
    expect(appPackage).to.not.equal(caps.appPackage);
    expect(appActivity).to.not.equal(caps.appActivity);
  });
  it('should be able to launch activity with custom intent parameter category', async function () {
    let caps = Object.assign({}, defaultCaps);
    caps.appPackage = 'io.appium.android.apis';
    caps.appActivity = 'io.appium.android.apis.app.HelloWorld';
    caps.intentCategory = 'appium.android.intent.category.SAMPLE_CODE';
    await driver.createSession(caps);
    let appActivity = await driver.getCurrentActivity();
    appActivity.should.include('HelloWorld');
  });
  it('should be able to load an app via package', async function () {
    let caps = Object.assign({}, defaultCaps);
    caps.app = '';
    caps.appPackage = 'io.appium.android.apis';
    caps.appActivity = '.ApiDemos';
    await driver.createSession(caps);
    let appPackage = await driver.getCurrentPackage();
    appPackage.should.include('io.appium.android.apis');
  });
  it('should error out if package is not on the device', async function () {
    let caps = Object.assign({}, defaultCaps);
    caps.app = '';
    caps.appPackage = 'sipa.diordna.muippa.oi';
    caps.appActivity = '.ApiDemos';
    await driver.createSession(caps).should.eventually.be.rejectedWith(/Could not find/);
  });
  it('should get updated capabilities', async function () {
    let caps = Object.assign({}, defaultCaps);
    caps.appPackage = 'io.appium.android.apis';
    caps.appActivity = '.view.SplitTouchView';
    await driver.createSession(caps);
    let serverCaps = await driver.getSession();
    serverCaps.takesScreenshot.should.exist;
  });
  it('should get device name, udid, model, manufacturer and screen size in session details', async function () {
    let caps = Object.assign({}, defaultCaps);
    caps.appPackage = 'io.appium.android.apis';
    caps.appActivity = '.view.SplitTouchView';
    let session = await driver.createSession(caps);
    session[1].deviceName.should.exist;
    session[1].deviceUDID.should.exist;

    let serverCaps = await driver.getSession();
    serverCaps.deviceName.should.exist;
    serverCaps.deviceUDID.should.exist;
    serverCaps.deviceScreenSize.should.exist;
    serverCaps.deviceModel.should.exist;
    serverCaps.deviceManufacturer.should.exist;
  });
  it('should error out for activity that fails to load after app wait activity timeout', async function () {
    let caps = Object.assign({}, defaultCaps);
    caps.appWaitActivity = 'non.existent.activity';
    caps.appWaitDuration = 1000; // 1 second
    await driver.createSession(caps).should.eventually.be.rejectedWith(/never started/);
  });
  it('should be able to grant permissions', async function () {
    // TODO: why is there no entry for 5.1?
    let adb = new ADB();
    let apiLevel = await adb.getApiLevel();
    if (apiLevel < 23) {
      return this.skip();
    }
    let caps = Object.assign({}, defaultCaps);
    caps.appPackage = 'io.appium.android.apis';
    caps.appActivity = 'io.appium.android.apis.app.HelloWorld';
    caps.intentCategory = 'appium.android.intent.category.SAMPLE_CODE';
    caps.autoGrantPermissions = true;
    await driver.createSession(caps);
    expect(await driver.adb.getGrantedPermissions('io.appium.android.apis')).to.include.members(['android.permission.RECEIVE_SMS']);
  });
  describe('W3C compliance', function () {
    it('should accept W3C parameters', async function () {
      const [sessionId, caps] = await driver.createSession(null, null, {
        alwaysMatch: Object.assign({}, defaultCaps),
        firstMatch: [{}],
      });
      sessionId.should.exist;
      caps.should.exist;
    });
  });
});

describe('close', function () {
  let driver;
  before(function () {
    driver = new AndroidDriver();
  });
  afterEach(async function () {
    await driver.deleteSession();
  });
  it('should close application', async function () {
    await driver.createSession(defaultCaps);
    await driver.closeApp();
    let appPackage = await driver.getCurrentPackage();
    if (appPackage) {
      appPackage.should.not.equal("io.appium.android.apis");
    }
  });
});
