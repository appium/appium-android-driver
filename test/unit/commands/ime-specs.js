import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import AndroidDriver from '../../..';
import ADB from 'appium-adb';
import { errors } from 'appium-base-driver';

chai.should();
chai.use(chaiAsPromised);

describe('IME', () => {
  let driver;
  let sandbox = sinon.sandbox.create();
  beforeEach(() => {
    driver = new AndroidDriver();
    driver.adb = new ADB();
  });
  afterEach(() => {
    sandbox.restore();
  });
  describe('isIMEActivated', () => {
    it('should allways return true', async () => {
      await driver.isIMEActivated().should.eventually.be.true;
    });
  });
  describe('availableIMEEngines', () => {
    it('should return available IMEEngines', async () => {
      sandbox.stub(driver.adb, 'availableIMEs').returns(['IME1', 'IME2']);
      await driver.availableIMEEngines()
        .should.eventually.be.deep.equal(['IME1', 'IME2']);
    });
  });
  describe('getActiveIMEEngine', () => {
    it('should return active IME engine', async () => {
      sandbox.stub(driver.adb, 'defaultIME').returns('default_ime_engine');
      await driver.getActiveIMEEngine().should.become('default_ime_engine');
    });
  });
  describe('activateIMEEngine', () => {
    it('should activate IME engine', async () => {
      sandbox.stub(driver.adb, 'availableIMEs').returns(['IME1', 'IME2']);
      sandbox.stub(driver.adb, 'enableIME');
      sandbox.stub(driver.adb, 'setIME');
      await driver.activateIMEEngine('IME2').should.be.fulfilled;
      driver.adb.enableIME.calledWithExactly('IME2').should.be.true;
      driver.adb.setIME.calledWithExactly('IME2').should.be.true;
    });
    it('should throws error if IME not found', async () => {
      sandbox.stub(driver.adb, 'availableIMEs').returns(['IME1', 'IME2']);
      await driver.activateIMEEngine ('IME3')
        .should.be.rejectedWith(errors.IMENotAvailableError);
    });
  });
  describe('deactivateIMEEngine', () => {
    it('should deactivate IME engine', async () => {
      sandbox.stub(driver, 'getActiveIMEEngine').returns('active_ime_engine');
      sandbox.stub(driver.adb, 'disableIME');
      await driver.deactivateIMEEngine().should.be.fulfilled;
      driver.adb.disableIME.calledWithExactly('active_ime_engine');
    });
  });
});
