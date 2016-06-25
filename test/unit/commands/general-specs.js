import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../..';
import helpers from '../../../lib/android-helpers';
import { withMocks } from 'appium-test-support';

let driver;
chai.should();
chai.use(chaiAsPromised);

describe('General', () => {
  describe('hideKeyboard', () => {
    it('should throw an error if no keyboard is present', async () => {
      driver = new AndroidDriver();
      driver.adb = {};
      driver.adb.isSoftKeyboardPresent = () => { return false; };
      await driver.hideKeyboard().should.be.rejectedWith(/not present/);
    });
    it('should throw an error if there is no selector', () => {
      driver.findElOrEls('xpath', null, false, 'some context').should.be.rejected;
    });
  });
  describe('Install App', () => {
    it('should throw an error if APK does not exist', async () => {
      driver = new AndroidDriver();
      await driver.installApp('non/existent/app.apk').should.be.rejectedWith(/Could not find/);
    });
  });
  describe('Run installed App', withMocks({helpers}, (mocks) => {
    it('should throw error if run with full reset', async () => {
      driver = new AndroidDriver();
      driver.opts = {appPackage: "app.package", appActivity: "act", fullReset: true};
      driver.caps = {};
      await driver.initAUT().should.be.rejectedWith(/Full reset requires an app capability/);
    });
    it('should reset if run with fast reset', async () => {
      driver = new AndroidDriver();
      driver.opts = {appPackage: "app.package", appActivity: "act", fullReset: false, fastReset: true};
      driver.caps = {};
      driver.adb = "mock_adb";
      mocks.helpers.expects("resetApp").withExactArgs("mock_adb", undefined, "app.package", true);
      await driver.initAUT();
      mocks.helpers.verify();
    });
    it('should keep data if run without reset', async () => {
      driver = new AndroidDriver();
      driver.opts = {appPackage: "app.package", appActivity: "act", fullReset: false, fastReset: false};
      driver.caps = {};
      mocks.helpers.expects("resetApp").never();
      await driver.initAUT();
      mocks.helpers.verify();
    });
  }));
  describe('getStrings', withMocks({helpers}, (mocks) => {
    it('should return app strings', async () => {
      driver = new AndroidDriver();
      driver.bootstrap = {};
      driver.bootstrap.sendAction = () => { return ''; };
      mocks.helpers.expects("pushStrings")
          .returns({'test': 'en_value'});
      let strings = await driver.getStrings('en');
      strings.test.should.equal('en_value');
      mocks.helpers.verify();
    });
    it('should return cached app strings for the specified language', async () => {
      driver = new AndroidDriver();
      driver.adb = {};
      driver.adb.getDeviceLanguage = () => { return 'en'; };
      driver.apkStrings.en = {'test': 'en_value'};
      driver.apkStrings.fr = {'test': 'fr_value'};
      let strings = await driver.getStrings('fr');
      strings.test.should.equal('fr_value');
    });
    it('should return cached app strings for the device language', async () => {
      driver = new AndroidDriver();
      driver.adb = {};
      driver.adb.getDeviceLanguage = () => { return 'en'; };
      driver.apkStrings.en = {'test': 'en_value'};
      driver.apkStrings.fr = {'test': 'fr_value'};
      let strings = await driver.getStrings();
      strings.test.should.equal('en_value');
    });
  }));
});
