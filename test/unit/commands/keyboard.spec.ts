import assert from 'node:assert/strict';
import {describe, it, beforeEach, afterEach} from 'node:test';

import {ADB} from 'appium-adb';
import sinon from 'sinon';

import {AndroidDriver} from '../../../lib/driver.js';

let driver: AndroidDriver;
const sandbox = sinon.createSandbox();

describe('Keyboard', function () {
  beforeEach(function () {
    driver = new AndroidDriver();
    driver.adb = new ADB();
    driver.caps = {} as any;
    driver.opts = {} as any;
  });
  afterEach(function () {
    sandbox.restore();
  });
  describe('isKeyboardShown', function () {
    it('should return true if the keyboard is shown', async function () {
      driver.adb.isSoftKeyboardPresent = function isSoftKeyboardPresent() {
        return Promise.resolve({isKeyboardShown: true, canCloseKeyboard: true});
      };
      assert.strictEqual(await driver.isKeyboardShown(), true);
    });
    it('should return false if the keyboard is not shown', async function () {
      driver.adb.isSoftKeyboardPresent = function isSoftKeyboardPresent() {
        return Promise.resolve({isKeyboardShown: false, canCloseKeyboard: true});
      };
      assert.strictEqual(await driver.isKeyboardShown(), false);
    });
  });
  describe('hideKeyboard', function () {
    it('should hide keyboard with ESC command', async function () {
      const keyeventStub1 = sandbox.stub(driver.adb, 'keyevent');
      let callIdx = 0;
      driver.adb.isSoftKeyboardPresent = function isSoftKeyboardPresent() {
        callIdx++;
        return Promise.resolve({
          isKeyboardShown: callIdx <= 1,
          canCloseKeyboard: callIdx <= 1,
        });
      };
      await assert.doesNotReject(driver.hideKeyboard());
      assert.strictEqual(keyeventStub1.calledWithExactly(111), true);
    });
    it('should throw if cannot close keyboard', {timeout: 10000}, async function () {
      driver.adb.isSoftKeyboardPresent = function isSoftKeyboardPresent() {
        return Promise.resolve({
          isKeyboardShown: true,
          canCloseKeyboard: false,
        });
      };
      const keyeventStub = sandbox.stub(driver.adb, 'keyevent');
      await assert.rejects(driver.hideKeyboard());
      assert.strictEqual(keyeventStub.notCalled, true);
    });
    it('should not throw if no keyboard is present', async function () {
      driver.adb.isSoftKeyboardPresent = function isSoftKeyboardPresent() {
        return Promise.resolve({
          isKeyboardShown: false,
          canCloseKeyboard: false,
        });
      };
      await assert.doesNotReject(driver.hideKeyboard());
    });
  });
});
