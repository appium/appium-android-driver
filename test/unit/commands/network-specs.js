import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import ADB from 'appium-adb';
import AndroidDriver from '../../..';
import B from 'bluebird';

let driver;
let adb;
let sandbox = sinon.sandbox.create();
chai.should();
chai.use(chaiAsPromised);

describe('Network', function () {
  beforeEach(async function () {
    driver = new AndroidDriver();
    adb = new ADB();
    driver.adb = adb;
    sandbox.stub(adb);
    sandbox.stub(driver, 'isEmulator');
    sandbox.stub(driver, 'wrapBootstrapDisconnect', async (fn) => {
      await fn();
    });
    sandbox.stub(B, 'delay');
  });
  afterEach(function () {
    sandbox.restore();
  });
  describe('getNetworkConnection', function () {
    beforeEach(function () {
      adb.isAirplaneModeOn.returns(false);
      adb.isDataOn.returns(false);
      sandbox.stub(driver, 'isWifiOn').returns(false);
    });
    it('should determine nothing enabled', async function () {
      await driver.getNetworkConnection().should.eventually.equal(0);
    });
    it('should determine airplane mode is on', async function () {
      adb.isAirplaneModeOn.returns(true);
      await driver.getNetworkConnection().should.eventually.equal(1);
    });
    it('should determine wifi is on', async function () {
      driver.isWifiOn.returns(true);
      await driver.getNetworkConnection().should.eventually.equal(2);
    });
    it('should determine data is on', async function () {
      adb.isDataOn.returns(true);
      await driver.getNetworkConnection().should.eventually.equal(4);
    });
    it('should determine wifi and data are on', async function () {
      driver.isWifiOn.returns(true);
      adb.isDataOn.returns(true);
      await driver.getNetworkConnection().should.eventually.equal(6);
    });
  });
  describe('isWifiOn', function () {
    it('should return wifi state', async function () {
      adb.isWifiOn.returns('wifi_state');
      await driver.isWifiOn().should.become('wifi_state');
    });
  });
  describe('setNetworkConnection', function () {
    beforeEach(async function () {
      sandbox.stub(driver, 'setWifiState');
      driver.isEmulator.returns(false);
    });
    it('should turn off wifi and data', async function () {
      sandbox.stub(driver, 'getNetworkConnection').returns(6);
      await driver.setNetworkConnection(0);
      adb.setAirplaneMode.called.should.be.false;
      adb.broadcastAirplaneMode.called.should.be.false;
      driver.setWifiState.calledWithExactly(false).should.be.true;
      adb.setDataState.calledWithExactly(false, false).should.be.true;
    });
    it('should turn on and broadcast airplane mode', async function () {
      sandbox.stub(driver, 'getNetworkConnection').returns(0);
      await driver.setNetworkConnection(1);
      adb.setAirplaneMode.calledWithExactly(true).should.be.true;
      adb.broadcastAirplaneMode.calledWithExactly(true).should.be.true;
      driver.setWifiState.called.should.be.false;
      adb.setDataState.called.should.be.false;
    });
    it('should turn on wifi', async function () {
      sandbox.stub(driver, 'getNetworkConnection').returns(0);
      await driver.setNetworkConnection(2);
      adb.setAirplaneMode.called.should.be.false;
      adb.broadcastAirplaneMode.called.should.be.false;
      driver.setWifiState.calledWithExactly(true).should.be.true;
      adb.setDataState.called.should.be.false;
    });
    it('should turn on data', async function () {
      sandbox.stub(driver, 'getNetworkConnection').returns(0);
      await driver.setNetworkConnection(4);
      adb.setAirplaneMode.called.should.be.false;
      adb.broadcastAirplaneMode.called.should.be.false;
      driver.setWifiState.called.should.be.false;
      adb.setDataState.calledWithExactly(true, false).should.be.true;
    });
    it('should turn on data and wifi', async function () {
      sandbox.stub(driver, 'getNetworkConnection').returns(0);
      await driver.setNetworkConnection(6);
      adb.setAirplaneMode.called.should.be.false;
      adb.broadcastAirplaneMode.called.should.be.false;
      driver.setWifiState.calledWithExactly(true).should.be.true;
      adb.setDataState.calledWithExactly(true, false).should.be.true;
    });
  });
  describe('setWifiState', function () {
    it('should set wifi state', async function () {
      driver.isEmulator.returns('is_emu');
      await driver.setWifiState('wifi_state');
      adb.setWifiState.calledWithExactly('wifi_state', 'is_emu').should.be.true;
    });
  });
  describe('toggleData', function () {
    it('should toggle data', async function () {
      adb.isDataOn.returns(false);
      driver.isEmulator.returns('is_emu');
      adb.setWifiAndData.returns('');
      await driver.toggleData();
      adb.setWifiAndData.calledWithExactly({data: true}, 'is_emu')
        .should.be.true;
    });
  });
  describe('toggleWiFi', function () {
    it('should toggle wifi', async function () {
      adb.isWifiOn.returns(false);
      driver.isEmulator.returns('is_emu');
      adb.setWifiAndData.returns('');
      await driver.toggleWiFi();
      adb.setWifiAndData.calledWithExactly({wifi: true}, 'is_emu')
        .should.be.true;
    });
  });
  describe('toggleFlightMode', function () {
    it('should toggle flight mode', async function () {
      adb.isAirplaneModeOn.returns(false);
      adb.setAirplaneMode.returns('');
      adb.broadcastAirplaneMode.returns('');
      await driver.toggleFlightMode();
      adb.setAirplaneMode.calledWithExactly(true).should.be.true;
      adb.broadcastAirplaneMode.calledWithExactly(true).should.be.true;
    });
  });
  describe('setGeoLocation', function () {
    it('should set location', async function () {
      adb.setGeoLocation.withArgs('location', 'is_emu').returns('res');
      driver.isEmulator.returns('is_emu');
      await driver.setGeoLocation('location').should.become('res');
    });
  });
  describe('toggleLocationSettings', function () {
    beforeEach(async function () {
      sandbox.stub(driver, 'toggleSetting');
    });
    it('should throw an error for API<16', async function () {
      adb.getApiLevel.returns(15);
      driver.isEmulator.returns(false);
      await driver.toggleLocationServices().should.eventually.be.rejectedWith(/implemented/);
    });
    it('should generate the correct sequence of keys for API 16', async function () {
      let sequence = [19, 19, 20];
      adb.getApiLevel.returns(16);
      driver.isEmulator.returns(false);
      await driver.toggleLocationServices();
      driver.toggleSetting.calledWith('LOCATION_SOURCE_SETTINGS', sequence).should.be.true;
    });
    it('should generate the correct sequence of keys for API >= 19', async function () {
      let sequence = [22, 22, 19];
      adb.getApiLevel.returns(19);
      driver.isEmulator.returns(false);
      await driver.toggleLocationServices();
      adb.keyevent.calledWithExactly(19).should.be.true;
      driver.toggleSetting.calledWith('LOCATION_SOURCE_SETTINGS', sequence)
        .should.be.true;
    });
    it('should set gps for emulators', async function () {
      adb.getApiLevel.returns(19);
      driver.isEmulator.returns(true);
      adb.getLocationProviders.returns(['wifi']);
      await driver.toggleLocationServices();
      adb.toggleGPSLocationProvider.calledWithExactly(true).should.be.true;
    });
  });
  describe('toggleSetting', function () {
    beforeEach(function () {
      sandbox.stub(driver, 'doKey').returns('');
      sandbox.stub(driver, 'openSettingsActivity').returns('');
      adb.getFocusedPackageAndActivity
        .returns({appPackage: 'fpkg', appActivity:'fact'});
    });
    it('should toggle setting', async function () {
      await driver.toggleSetting('set', [61, 72]);
      driver.doKey.getCall(0).args[0].should.be.equal(61);
      driver.doKey.getCall(1).args[0].should.be.equal(72);
      driver.doKey.getCall(2).args[0].should.be.equal(23);
      driver.doKey.getCall(3).args[0].should.be.equal(22);
      driver.doKey.getCall(4).args[0].should.be.equal(23);
      driver.openSettingsActivity.calledWithExactly('set').should.be.true;
      adb.waitForNotActivity.calledTwice.should.be.true;
      adb.waitForNotActivity.alwaysCalledWith('fpkg', 'fact').should.be.true;
      adb.back.calledOnce.should.be.true;
    });
    it('should use default key sequence', async function () {
      await driver.toggleSetting('set', null);
      driver.doKey.getCall(0).args[0].should.be.equal(19);
      driver.doKey.getCall(1).args[0].should.be.equal(19);
      driver.doKey.getCall(2).args[0].should.be.equal(20);
    });
    it('should skip errors from adb.waitForNotActivity', async function () {
      adb.waitForNotActivity.throws();
      await driver.toggleSetting('set', null).should.be.fulfilled;
    });
  });
  describe('doKey', function () {
    it('should send key event', async function () {
      await driver.doKey(55);
      adb.keyevent.calledWithExactly(55).should.be.true;
    });
  });
  describe('wrapBootstrapDisconnect', function () {
    it('should restart adb and start bootstrap', async function () {
      driver.wrapBootstrapDisconnect.restore();
      let fn = sandbox.stub();
      driver.bootstrap = sandbox.stub();
      driver.bootstrap.start = sandbox.stub();
      driver.opts = {appPackage: 'pkg', disableAndroidWatchers: 'daw', acceptSslCerts: 'acert'};
      await driver.wrapBootstrapDisconnect(fn);
      sinon.assert.callOrder(fn, adb.restart, driver.bootstrap.start);
      driver.bootstrap.calledWithExactly('pkg', 'daw', 'acert');
      driver.bootstrap.ignoreUnexpectedShutdown.should.be.false;
    });
  });
});
