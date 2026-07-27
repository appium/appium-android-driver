import {describe, it, beforeEach, afterEach} from 'node:test';

import {ADB} from 'appium-adb';
import {use} from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';

import {setMockLocationApp} from '../../../lib/commands/geolocation.js';
import {AndroidDriver} from '../../../lib/driver.js';

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
        .resolves('');
      sandbox.stub(driver.adb, 'fileExists').throws();
      await setMockLocationApp.bind(driver)('io.appium.settings');
    });
  });
});
