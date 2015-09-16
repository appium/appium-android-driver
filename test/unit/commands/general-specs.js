import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { AndroidDriver } from '../../..';

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
});
