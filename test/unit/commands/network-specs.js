import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import ADB from 'appium-adb';
import {AndroidDriver} from '../../../lib/driver';
import B from 'bluebird';

let driver;
let adb;
let sandbox = sinon.createSandbox();
chai.should();
chai.use(chaiAsPromised);

describe('Network', function () {
  beforeEach(function () {
    driver = new AndroidDriver();
    adb = new ADB();
    driver.adb = adb;
    sandbox.stub(adb);
    sandbox.stub(driver, 'isEmulator');
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
    beforeEach(function () {
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
      adb.getApiLevel.returns(29);
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
      adb.setWifiAndData.calledWithExactly({data: true}, 'is_emu').should.be.true;
    });
  });
  describe('toggleWiFi', function () {
    it('should toggle wifi', async function () {
      adb.isWifiOn.returns(false);
      driver.isEmulator.returns('is_emu');
      adb.setWifiAndData.returns('');
      await driver.toggleWiFi();
      adb.setWifiAndData.calledWithExactly({wifi: true}, 'is_emu').should.be.true;
    });
  });
  describe('toggleFlightMode', function () {
    it('should toggle flight mode on API < 30', async function () {
      adb.isAirplaneModeOn.returns(false);
      adb.getApiLevel.returns(29);
      adb.setAirplaneMode.returns('');
      adb.broadcastAirplaneMode.returns('');
      await driver.toggleFlightMode();
      adb.setAirplaneMode.calledWithExactly(true).should.be.true;
      adb.broadcastAirplaneMode.calledWithExactly(true).should.be.true;
    });
    it('should toggle flight mode on API > 29', async function () {
      adb.isAirplaneModeOn.returns(false);
      adb.getApiLevel.returns(30);
      adb.setAirplaneMode.returns('');
      await driver.toggleFlightMode();
      adb.setAirplaneMode.calledWithExactly(true).should.be.true;
    });
  });
  describe('setGeoLocation', function () {
    it('should return location in use after setting', async function () {
      adb.setGeoLocation.withArgs('location', 'is_emu').returns('res');
      adb.getGeoLocation.returns({
        latitude: '1.1',
        longitude: '2.2',
        altitude: '3.3',
      });
      driver.isEmulator.returns('is_emu');
      const {latitude, longitude, altitude} = await driver.setGeoLocation('location');
      Number.isNaN(latitude).should.be.false;
      Number.isNaN(longitude).should.be.false;
      Number.isNaN(altitude).should.be.false;
    });
  });
  describe('getGeoLocation', function () {
    it('should get location', async function () {
      adb.getGeoLocation.returns({
        latitude: '1.1',
        longitude: '2.2',
      });
      const {latitude, longitude, altitude} = await driver.getGeoLocation();
      Number.isNaN(latitude).should.be.false;
      Number.isNaN(longitude).should.be.false;
      Number.isNaN(altitude).should.be.false;
    });
  });
});
