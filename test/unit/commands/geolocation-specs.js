import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import ADB from 'appium-adb';
import { AndroidDriver } from '../../../lib/driver';
import { setMockLocationApp } from '../../../lib/commands/geolocation';

chai.use(chaiAsPromised);

describe('Geolocation', function () {
  let driver;
  let sandbox = sinon.createSandbox();

  beforeEach(function () {
    const adb = new ADB();
    driver = new AndroidDriver();
    driver.adb = adb;
  });
  afterEach(function () {
    sandbox.verifyAndRestore();
  });

  describe('setMockLocationApp', function () {
    it('should enable mock location for api level below 23', async function () {
      sandbox.stub(driver.adb, 'getApiLevel').resolves(18);
      sandbox.stub(driver.adb, 'shell')
        .withArgs(['settings', 'put', 'secure', 'mock_location', '1'])
        .onFirstCall()
        .returns('');
      sandbox.stub(driver.adb, 'fileExists').throws();
      await setMockLocationApp.bind(driver)('io.appium.settings');
    });
    it('should enable mock location for api level 23 and above', async function () {
      sandbox.stub(driver.adb, 'getApiLevel').resolves(23);
      sandbox.stub(driver.adb, 'shell')
        .withArgs(['appops', 'set', 'io.appium.settings', 'android:mock_location', 'allow'])
        .onFirstCall()
        .returns('');
      sandbox.stub(driver.adb, 'fileExists').throws();
      await setMockLocationApp.bind(driver)('io.appium.settings');
    });
  });

});
