import sinon from 'sinon';
import {AndroidDriver} from '../../../lib/driver';
import {ADB} from 'appium-adb';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';

use(chaiAsPromised);

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
      expect(await driver.isKeyboardShown()).to.equal(true);
    });
    it('should return false if the keyboard is not shown', async function () {
      driver.adb.isSoftKeyboardPresent = function isSoftKeyboardPresent() {
        return Promise.resolve({isKeyboardShown: false, canCloseKeyboard: true});
      };
      expect(await driver.isKeyboardShown()).to.equal(false);
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
      await await expect(driver.hideKeyboard()).to.eventually.be.fulfilled;
      expect(keyeventStub1.calledWithExactly(111)).to.be.true;
    });
    it('should throw if cannot close keyboard', async function () {
      this.timeout(10000);
      driver.adb.isSoftKeyboardPresent = function isSoftKeyboardPresent() {
        return Promise.resolve({
          isKeyboardShown: true,
          canCloseKeyboard: false,
        });
      };
      const keyeventStub = sandbox.stub(driver.adb, 'keyevent');
      await await expect(driver.hideKeyboard()).to.eventually.be.rejected;
      expect(keyeventStub.notCalled).to.be.true;
    });
    it('should not throw if no keyboard is present', async function () {
      driver.adb.isSoftKeyboardPresent = function isSoftKeyboardPresent() {
        return Promise.resolve({
          isKeyboardShown: false,
          canCloseKeyboard: false,
        });
      };
      await await expect(driver.hideKeyboard()).to.eventually.be.fulfilled;
    });
  });
});

