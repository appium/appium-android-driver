import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import ADB from 'appium-adb';
import B from 'bluebird';
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
      sandbox.stub(driver.adb, 'getApiLevel').returns(B.resolve(18));
      sandbox.stub(driver.adb, 'shell')
        .withExactArgs(['settings', 'put', 'secure', 'mock_location', '1'])
        .once()
        .returns('');
      sandbox.stub(driver.adb, 'fileExists').throws();
      await setMockLocationApp.bind(driver)('io.appium.settings');
    });
    it('should enable mock location for api level 23 and above', async function () {
      sandbox.stub(driver.adb, 'getApiLevel').returns(B.resolve(23));
      sandbox.stub(driver.adb, 'shell')
        .withExactArgs(['appops', 'set', 'io.appium.settings', 'android:mock_location', 'allow'])
        .once()
        .returns('');
      sandbox.stub(driver.adb, 'fileExists').throws();
      await setMockLocationApp.bind(driver)('io.appium.settings');
    });
  });

});
