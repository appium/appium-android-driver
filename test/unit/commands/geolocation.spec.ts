import assert from 'node:assert/strict';
import {describe, it, beforeEach, afterEach} from 'node:test';

import {ADB} from 'appium-adb';
import sinon from 'sinon';

import {setMockLocationApp} from '../../../lib/commands/geolocation.js';
import {AndroidDriver} from '../../../lib/driver.js';

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

  describe('mobileResetGeolocation', function () {
    it('should deny mock location for the settings app', async function () {
      const shellStub = sandbox
        .stub(driver.adb, 'shell')
        .callsFake(async (args) => ((args as string[]).includes('packages') ? 'package:com.example.app' : ''));
      sandbox.stub(driver.adb, 'fileExists').resolves(false);
      await driver.mobileResetGeolocation();
      sinon.assert.calledWith(shellStub, ['appops', 'set', 'io.appium.settings', 'android:mock_location', 'deny']);
    });
    it('should throw on emulators', async function () {
      driver.opts.avd = 'Pixel';
      await assert.rejects(() => driver.mobileResetGeolocation(), /emulators/);
    });
  });
});
