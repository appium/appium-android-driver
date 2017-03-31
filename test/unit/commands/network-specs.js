import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import ADB from 'appium-adb';
import AndroidDriver from '../../..';

let driver;
let sandbox = sinon.sandbox.create();
chai.should();
chai.use(chaiAsPromised);

describe('Network', () => {
  describe('getNetworkConnection', () => {
    beforeEach(async () => {
      driver = new AndroidDriver();
      driver.adb = new ADB();
    });
    afterEach(() => {
      sandbox.restore();
    });
    it('should determine nothing enabled', async () => {
      sandbox.stub(driver.adb, 'isAirplaneModeOn');
      sandbox.stub(driver.adb, 'isWifiOn');
      sandbox.stub(driver.adb, 'isDataOn');
      await driver.getNetworkConnection().should.eventually.equal(0);
    });
    it('should determine airplane mode is on', async () => {
      sandbox.stub(driver.adb, 'isAirplaneModeOn').returns(true);
      sandbox.stub(driver.adb, 'isWifiOn');
      sandbox.stub(driver.adb, 'isDataOn');
      await driver.getNetworkConnection().should.eventually.equal(1);
    });
    it('should determine wifi is on', async () => {
      sandbox.stub(driver.adb, 'isAirplaneModeOn');
      sandbox.stub(driver.adb, 'isWifiOn').returns(true);
      sandbox.stub(driver.adb, 'isDataOn');
      await driver.getNetworkConnection().should.eventually.equal(2);
    });
    it('should determine data is on', async () => {
      sandbox.stub(driver.adb, 'isAirplaneModeOn');
      sandbox.stub(driver.adb, 'isWifiOn');
      sandbox.stub(driver.adb, 'isDataOn').returns(true);
      await driver.getNetworkConnection().should.eventually.equal(4);
    });
    it('should determine wifi and data are on', async () => {
      sandbox.stub(driver.adb, 'isAirplaneModeOn');
      sandbox.stub(driver.adb, 'isWifiOn').returns(true);
      sandbox.stub(driver.adb, 'isDataOn').returns(true);
      await driver.getNetworkConnection().should.eventually.equal(6);
    });
  });
  describe('SetNetworkConnection', () => {
    beforeEach(async () => {
      driver = new AndroidDriver();
      driver.adb = new ADB();
      sandbox.stub(driver, 'getNetworkConnection');
      sandbox.stub(driver, 'wrapBootstrapDisconnect', async (fn) => {
        await fn();
      });
      sandbox.stub(driver.adb, 'setAirplaneMode');
      sandbox.stub(driver.adb, 'broadcastAirplaneMode');
      sandbox.stub(driver.adb, 'setWifiState');
      sandbox.stub(driver.adb, 'setDataState');
    });
    afterEach(() => {
      sandbox.restore();
    });
    it('should turn off wifi and data', async () => {
      await driver.setNetworkConnection(0);
      driver.adb.setAirplaneMode.calledWithExactly(0).should.be.true;
      driver.adb.broadcastAirplaneMode.calledWithExactly(0).should.be.true;
      driver.adb.setWifiState.calledWithExactly(0, false).should.be.true;
      driver.adb.setDataState.calledWithExactly(0, false).should.be.true;
    });
    it('should turn on and broadcast airplane mode', async () => {
      await driver.setNetworkConnection(1);
      driver.adb.setAirplaneMode.calledWithExactly(1).should.be.true;
      driver.adb.broadcastAirplaneMode.calledWithExactly(1).should.be.true;
      driver.adb.setWifiState.called.should.be.false;
      driver.adb.setDataState.called.should.be.false;
    });
    it('should turn on wifi', async () => {
      await driver.setNetworkConnection(2);
      driver.adb.setAirplaneMode.calledWithExactly(0).should.be.true;
      driver.adb.broadcastAirplaneMode.calledWithExactly(0).should.be.true;
      driver.adb.setWifiState.calledWithExactly(1, false).should.be.true;
      driver.adb.setDataState.calledWithExactly(0, false).should.be.true;
    });
    it('should turn on data', async () => {
      await driver.setNetworkConnection(4);
      driver.adb.setAirplaneMode.calledWithExactly(0).should.be.true;
      driver.adb.broadcastAirplaneMode.calledWithExactly(0).should.be.true;
      driver.adb.setWifiState.calledWithExactly(0, false).should.be.true;
      driver.adb.setDataState.calledWithExactly(1, false).should.be.true;
    });
    it('should turn on data and wifi', async () => {
      await driver.setNetworkConnection(6);
      driver.adb.setAirplaneMode.calledWithExactly(0).should.be.true;
      driver.adb.broadcastAirplaneMode.calledWithExactly(0).should.be.true;
      driver.adb.setWifiState.calledWithExactly(1, false).should.be.true;
      driver.adb.setDataState.calledWithExactly(1, false).should.be.true;
    });
  });
  describe('ToggleLocationSettings', () => {
    beforeEach(async () => {
      driver = new AndroidDriver();
      driver.adb = new ADB();
      sandbox.stub(driver, 'toggleSetting');
    });
    afterEach(() => {
      sandbox.restore();
    });
    it('should throw an error for API<16', async () => {
      sandbox.stub(driver.adb, 'getApiLevel').returns(15);
      await driver.toggleLocationServices().should.eventually.be.rejectedWith(/implemented/);
    });
    it('should generate the correct sequence of keys for API 16', async () => {
      let sequence = [19, 19, 20];
      sandbox.stub(driver.adb, 'getApiLevel').returns(16);
      await driver.toggleLocationServices();
      driver.toggleSetting.calledWith('LOCATION_SOURCE_SETTINGS', sequence).should.be.true;
    });
    it('should generate the correct sequence of keys for API >= 19', async () => {
      let sequence = [22, 22, 19];
      sandbox.stub(driver.adb, 'getApiLevel').returns(19);
      sandbox.stub(driver.adb, 'keyevent');
      await driver.toggleLocationServices();
      driver.adb.keyevent.calledWithExactly(19).should.be.true;
      driver.toggleSetting.calledWith('LOCATION_SOURCE_SETTINGS', sequence).should.be.true;
    });
  });
});
