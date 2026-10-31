import assert from 'node:assert/strict';
import {describe, it, beforeEach, afterEach} from 'node:test';

import {ADB} from 'appium-adb';
import {errors} from 'appium/driver.js';
import sinon from 'sinon';

import {AndroidDriver} from '../../../lib/driver.js';

describe('IME', function () {
  let driver: AndroidDriver;
  const sandbox = sinon.createSandbox();

  beforeEach(function () {
    driver = new AndroidDriver();
    driver.adb = new ADB();
  });
  afterEach(function () {
    sandbox.restore();
  });
  describe('isIMEActivated', function () {
    it('should allways return true', async function () {
      assert.strictEqual(await driver.isIMEActivated(), true);
    });
  });
  describe('availableIMEEngines', function () {
    it('should return available IMEEngines', async function () {
      sandbox.stub(driver.adb, 'availableIMEs').resolves(['IME1', 'IME2']);
      assert.deepStrictEqual(await driver.availableIMEEngines(), ['IME1', 'IME2']);
    });
  });
  describe('getActiveIMEEngine', function () {
    it('should return active IME engine', async function () {
      sandbox.stub(driver.adb, 'defaultIME').resolves('default_ime_engine');
      assert.deepStrictEqual(await driver.getActiveIMEEngine(), 'default_ime_engine');
    });
  });
  describe('activateIMEEngine', function () {
    it('should activate IME engine', async function () {
      sandbox.stub(driver.adb, 'availableIMEs').resolves(['IME1', 'IME2']);
      const enableIMEStub = sandbox.stub(driver.adb, 'enableIME');
      const setIMEStub = sandbox.stub(driver.adb, 'setIME');
      await assert.doesNotReject(driver.activateIMEEngine('IME2'));
      assert.strictEqual(enableIMEStub.calledWithExactly('IME2'), true);
      assert.strictEqual(setIMEStub.calledWithExactly('IME2'), true);
    });
    it('should throws error if IME not found', async function () {
      sandbox.stub(driver.adb, 'availableIMEs').resolves(['IME1', 'IME2']);
      await assert.rejects(driver.activateIMEEngine('IME3'), errors.IMENotAvailableError);
    });
  });
  describe('deactivateIMEEngine', function () {
    it('should deactivate IME engine', async function () {
      sandbox.stub(driver, 'getActiveIMEEngine').resolves('active_ime_engine');
      const disableIMEStub = sandbox.stub(driver.adb, 'disableIME');
      await assert.doesNotReject(driver.deactivateIMEEngine());
      assert.strictEqual(disableIMEStub.calledWithExactly('active_ime_engine'), true);
    });
  });
  describe('setStylusHandwriting', function () {
    const cases = [
      [true, '1'],
      [false, '0'],
    ] as const;
    cases.forEach(([enabled, expectedValue]) => {
      it(`should set stylus handwriting input method to ${enabled}`, async function () {
        sandbox.stub(driver, 'assertFeatureEnabled').withArgs('set_stylus_handwriting').onFirstCall();
        const shellStub = sandbox.stub(driver.adb, 'shell');
        await assert.doesNotReject(driver.setStylusHandwriting(enabled));
        assert.strictEqual(
          shellStub.calledWithExactly(['settings', 'put', 'secure', 'stylus_handwriting_enabled', expectedValue]),
          true,
        );
      });
    });
  });
});
