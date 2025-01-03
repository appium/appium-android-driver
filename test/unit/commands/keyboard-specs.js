import sinon from 'sinon';
import {AndroidDriver} from '../../../lib/driver';
import {ADB} from 'appium-adb';

/** @type {AndroidDriver} */
let driver;
let sandbox = sinon.createSandbox();

describe('Keyboard', function () {
  let chai;

  before(async function () {
    chai = await import('chai');
    const chaiAsPromised = await import('chai-as-promised');

    chai.should();
    chai.use(chaiAsPromised.default);
  });

  beforeEach(function () {
    driver = new AndroidDriver();
    driver.adb = new ADB();
    driver.caps = {};
    driver.opts = {};
  });
  afterEach(function () {
    sandbox.restore();
  });
  describe('isKeyboardShown', function () {
    it('should return true if the keyboard is shown', async function () {
      driver.adb.isSoftKeyboardPresent = function isSoftKeyboardPresent() {
        return {isKeyboardShown: true, canCloseKeyboard: true};
      };
      (await driver.isKeyboardShown()).should.equal(true);
    });
    it('should return false if the keyboard is not shown', async function () {
      driver.adb.isSoftKeyboardPresent = function isSoftKeyboardPresent() {
        return {isKeyboardShown: false, canCloseKeyboard: true};
      };
      (await driver.isKeyboardShown()).should.equal(false);
    });
  });
  describe('hideKeyboard', function () {
    it('should hide keyboard with ESC command', async function () {
      sandbox.stub(driver.adb, 'keyevent');
      let callIdx = 0;
      driver.adb.isSoftKeyboardPresent = function isSoftKeyboardPresent() {
        callIdx++;
        return {
          isKeyboardShown: callIdx <= 1,
          canCloseKeyboard: callIdx <= 1,
        };
      };
      await driver.hideKeyboard().should.eventually.be.fulfilled;
      driver.adb.keyevent.calledWithExactly(111).should.be.true;
    });
    it('should throw if cannot close keyboard', async function () {
      this.timeout(10000);
      sandbox.stub(driver.adb, 'keyevent');
      driver.adb.isSoftKeyboardPresent = function isSoftKeyboardPresent() {
        return {
          isKeyboardShown: true,
          canCloseKeyboard: false,
        };
      };
      await driver.hideKeyboard().should.eventually.be.rejected;
      driver.adb.keyevent.notCalled.should.be.true;
    });
    it('should not throw if no keyboard is present', async function () {
      driver.adb.isSoftKeyboardPresent = function isSoftKeyboardPresent() {
        return {
          isKeyboardShown: false,
          canCloseKeyboard: false,
        };
      };
      await driver.hideKeyboard().should.eventually.be.fulfilled;
    });
  });
});
