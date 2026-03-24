import sinon from 'sinon';
import {AndroidDriver} from '../../../lib/driver';
import {ADB} from 'appium-adb';
import {errors} from 'appium/driver';
import {expect, use} from 'chai';
import chaiAsPromised from 'chai-as-promised';

use(chaiAsPromised);

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
      await await expect(driver.isIMEActivated()).to.eventually.be.true;
    });
  });
  describe('availableIMEEngines', function () {
    it('should return available IMEEngines', async function () {
      sandbox.stub(driver.adb, 'availableIMEs').returns(['IME1', 'IME2']);
      await await expect(driver.availableIMEEngines()).to.eventually.be.deep.equal([
        'IME1',
        'IME2',
      ]);
    });
  });
  describe('getActiveIMEEngine', function () {
    it('should return active IME engine', async function () {
      sandbox.stub(driver.adb, 'defaultIME').returns('default_ime_engine');
      await expect(driver.getActiveIMEEngine()).to.become('default_ime_engine');
    });
  });
  describe('activateIMEEngine', function () {
    it('should activate IME engine', async function () {
      sandbox.stub(driver.adb, 'availableIMEs').returns(['IME1', 'IME2']);
      const enableIMEStub = sandbox.stub(driver.adb, 'enableIME');
      const setIMEStub = sandbox.stub(driver.adb, 'setIME');
      await expect(driver.activateIMEEngine('IME2')).to.be.fulfilled;
      expect(enableIMEStub.calledWithExactly('IME2')).to.be.true;
      expect(setIMEStub.calledWithExactly('IME2')).to.be.true;
    });
    it('should throws error if IME not found', async function () {
      sandbox.stub(driver.adb, 'availableIMEs').returns(['IME1', 'IME2']);
      await expect(driver.activateIMEEngine('IME3')).to.be.rejectedWith(
        errors.IMENotAvailableError,
      );
    });
  });
  describe('deactivateIMEEngine', function () {
    it('should deactivate IME engine', async function () {
      sandbox.stub(driver, 'getActiveIMEEngine').returns('active_ime_engine');
      const disableIMEStub = sandbox.stub(driver.adb, 'disableIME');
      await expect(driver.deactivateIMEEngine()).to.be.fulfilled;
      expect(disableIMEStub.calledWithExactly('active_ime_engine')).to.be.true;
    });
  });
  describe('setStylusHandwriting', function () {
    const cases = [
      [true, '1'],
      [false, '0'],
    ] as const;
    cases.forEach(([enabled, expectedValue]) => {
      it(`should set stylus handwriting input method to ${enabled}`, async function () {
        sandbox
          .stub(driver, 'assertFeatureEnabled')
          .withArgs('set_stylus_handwriting')
          .onFirstCall();
        const shellStub = sandbox.stub(driver.adb, 'shell');
        await expect(driver.setStylusHandwriting(enabled)).to.be.fulfilled;
        expect(
          shellStub.calledWithExactly([
            'settings',
            'put',
            'secure',
            'stylus_handwriting_enabled',
            expectedValue,
          ]),
        ).to.be.true;
      });
    });
  });
});
