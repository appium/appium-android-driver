import sinon from 'sinon';
import {ADB} from 'appium-adb';
import {AndroidDriver} from '../../../lib/driver';
import {setMockLocationApp} from '../../../lib/commands/geolocation';
import {use} from 'chai';
import chaiAsPromised from 'chai-as-promised';

use(chaiAsPromised);

describe('Geolocation', function () {
  let driver: AndroidDriver;
  const sandbox = sinon.createSandbox();

  beforeEach(function () {
    const adb = new ADB();
    driver = new AndroidDriver();
    driver.adb = adb;
  });
  afterEach(function () {
    sandbox.verifyAndRestore();
  });

  describe('setMockLocationApp', function () {
    it('should enable mock location', async function () {
      sandbox
        .stub(driver.adb, 'shell')
        .withArgs(['appops', 'set', 'io.appium.settings', 'android:mock_location', 'allow'])
        .onFirstCall()
        .returns('');
      sandbox.stub(driver.adb, 'fileExists').throws();
      await setMockLocationApp.bind(driver)('io.appium.settings');
    });
  });
});
