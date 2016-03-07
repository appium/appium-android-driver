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
      driver.adb.isSoftKeyboardPresent = function(){ return false; };
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
  describe('getStrings', withMocks({helpers}, (mocks) => {
    it('should return app strings', async () => {
      driver = new AndroidDriver();
      driver.bootstrap = {};
      driver.bootstrap.sendAction = function(){ return ''; };
      mocks.helpers.expects("pushStrings")
          .returns({'test': 'en_value'});
      let strings = await driver.getStrings('en');
      strings.test.should.equal('en_value');
      mocks.helpers.verify();
    });
    it('should return cached app strings for the specified language', async () => {
      driver = new AndroidDriver();
      driver.adb = {};
      driver.adb.getDeviceLanguage = function(){ return 'en'; };
      driver.apkStrings.en = {'test': 'en_value'};
      driver.apkStrings.fr = {'test': 'fr_value'};
      let strings = await driver.getStrings('fr');
      strings.test.should.equal('fr_value');
    });
    it('should return cached app strings for the device language', async () => {
      driver = new AndroidDriver();
      driver.adb = {};
      driver.adb.getDeviceLanguage = function(){ return 'en'; };
      driver.apkStrings.en = {'test': 'en_value'};
      driver.apkStrings.fr = {'test': 'fr_value'};
      let strings = await driver.getStrings();
      strings.test.should.equal('en_value');
    });
  }));
});
