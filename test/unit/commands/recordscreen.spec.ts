import assert from 'node:assert/strict';
import {describe, it, beforeEach, afterEach} from 'node:test';

import {ADB} from 'appium-adb';
import sinon from 'sinon';

import {AndroidDriver} from '../../../lib/driver.js';

describe('recording the screen', {timeout: 60000}, function () {
  let driver: AndroidDriver;
  let adb: ADB;
  const sandbox = sinon.createSandbox();

  beforeEach(function () {
    driver = new AndroidDriver();
    adb = new ADB();
    driver.adb = adb;
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('basic', function () {
    it('should fail to recording the screen on an older emulator', async function () {
      sandbox.stub(driver, 'isEmulator').returns(true);
      sandbox.stub(adb, 'getApiLevel').resolves(26);

      await assert.rejects(driver.startRecordingScreen(), /Screen recording does not work on emulators/);
    });
  });
});
