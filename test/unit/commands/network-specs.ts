import sinon from 'sinon';
import {ADB} from 'appium-adb';
import {AndroidDriver} from '../../../lib/driver';
import B from 'bluebird';
import { SettingsApp } from 'io.appium.settings';
import { errors } from 'appium/driver';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';

use(chaiAsPromised);

let driver: AndroidDriver;
let adb: sinon.SinonStubbedInstance<ADB>;
let settingsApp: SettingsApp;
const sandbox = sinon.createSandbox();

describe('Network', function () {

  beforeEach(function () {
    driver = new AndroidDriver();
    const adbInstance = new ADB();
    driver.adb = adbInstance;
    adb = sandbox.stub(adbInstance);
    settingsApp = new SettingsApp({adb});
    driver._settingsApp = settingsApp;
    sandbox.stub(settingsApp);
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
      await expect(driver.getNetworkConnection()).to.eventually.equal(0);
    });
    it('should determine airplane mode is on', async function () {
      adb.isAirplaneModeOn.returns(true);
      await expect(driver.getNetworkConnection()).to.eventually.equal(1);
    });
    it('should determine wifi is on', async function () {
      (driver.isWifiOn as sinon.SinonStub).returns(true);
      await expect(driver.getNetworkConnection()).to.eventually.equal(2);
    });
    it('should determine data is on', async function () {
      adb.isDataOn.returns(true);
      await expect(driver.getNetworkConnection()).to.eventually.equal(4);
    });
    it('should determine wifi and data are on', async function () {
      (driver.isWifiOn as sinon.SinonStub).returns(true);
      adb.isDataOn.returns(true);
      await expect(driver.getNetworkConnection()).to.eventually.equal(6);
    });
  });
  describe('isWifiOn', function () {
    it('should return wifi state', async function () {
      adb.isWifiOn.returns('wifi_state');
      await expect(driver.isWifiOn()).to.become('wifi_state');
    });
  });
  describe('setNetworkConnection', function () {
    beforeEach(function () {
      (driver.isEmulator as sinon.SinonStub).returns(false);
    });
    it('should turn off wifi and data', async function () {
      sandbox.stub(driver, 'getNetworkConnection').returns(6);
      const setWifiStateStubA = sandbox.stub(driver, 'setWifiState');
      const setDataStateStubA = sandbox.stub(driver, 'setDataState');
      await driver.setNetworkConnection(0);
      expect(adb.setAirplaneMode.called).to.be.false;
      expect(adb.broadcastAirplaneMode.called).to.be.false;
      expect(setWifiStateStubA.calledWithExactly(false)).to.be.true;
      expect(setDataStateStubA.calledWithExactly(false)).to.be.true;
    });
    it('should turn on and broadcast airplane mode', async function () {
      sandbox.stub(driver, 'getNetworkConnection').returns(0);
      adb.getApiLevel.returns(29);
      const setWifiStateStubB = sandbox.stub(driver, 'setWifiState');
      const setDataStateStubB = sandbox.stub(driver, 'setDataState');
      await driver.setNetworkConnection(1);
      expect(adb.setAirplaneMode.calledWithExactly(true)).to.be.true;
      expect(adb.broadcastAirplaneMode.calledWithExactly(true)).to.be.true;
      expect(setWifiStateStubB.called).to.be.false;
      expect(setDataStateStubB.called).to.be.false;
    });
    it('should turn on wifi', async function () {
      sandbox.stub(driver, 'getNetworkConnection').returns(0);
      const setWifiStateStub1 = sandbox.stub(driver, 'setWifiState');
      const setDataStateStub1 = sandbox.stub(driver, 'setDataState');
      await driver.setNetworkConnection(2);
      expect(adb.setAirplaneMode.called).to.be.false;
      expect(adb.broadcastAirplaneMode.called).to.be.false;
      expect(setWifiStateStub1.calledWithExactly(true)).to.be.true;
      expect(setDataStateStub1.called).to.be.false;
    });
    it('should turn on data', async function () {
      sandbox.stub(driver, 'getNetworkConnection').returns(0);
      const setDataStateStub3 = sandbox.stub(driver, 'setDataState');
      const setWifiStateStub4 = sandbox.stub(driver, 'setWifiState');
      await driver.setNetworkConnection(4);
      expect(adb.setAirplaneMode.called).to.be.false;
      expect(adb.broadcastAirplaneMode.called).to.be.false;
      expect(setWifiStateStub4.called).to.be.false;
      expect(setDataStateStub3.calledWithExactly(true)).to.be.true;
    });
    it('should turn on data and wifi', async function () {
      sandbox.stub(driver, 'getNetworkConnection').returns(0);
      const setWifiStateStub3 = sandbox.stub(driver, 'setWifiState');
      const setDataStateStub4 = sandbox.stub(driver, 'setDataState');
      await driver.setNetworkConnection(6);
      expect(adb.setAirplaneMode.called).to.be.false;
      expect(adb.broadcastAirplaneMode.called).to.be.false;
      expect(setWifiStateStub3.calledWithExactly(true)).to.be.true;
      expect(setDataStateStub4.calledWithExactly(true)).to.be.true;
    });
  });
  describe('mobileGetConnectivity', function () {
    it('should raise unsupported services in string', async function () {
      await expect(driver.mobileGetConnectivity('bad' as any)).to.eventually.be.rejectedWith(errors.InvalidArgumentError);
    });
    it('should raise unsupported services in array', async function () {
      await expect(driver.mobileGetConnectivity(['bad', 'array'] as any)).to.eventually.be.rejectedWith(errors.InvalidArgumentError);
    });
    it('should raise unsupported services with an empty array', async function () {
      await expect(driver.mobileGetConnectivity()).to.eventually.eql({});
    });
    it('should return all supported services', async function () {
      adb.isWifiOn.returns(true);
      adb.isDataOn.returns(true);
      adb.isAirplaneModeOn.returns(true);
      await expect(driver.mobileGetConnectivity()).to.eventually.eql({ wifi: true, data: true, airplaneMode: true });
    });
    it('should return only wifi', async function () {
      adb.isWifiOn.returns(true);
      adb.isDataOn.returns(true);
      adb.isAirplaneModeOn.returns(true);
      await expect(driver.mobileGetConnectivity('wifi')).to.eventually.eql({ wifi: true });
    });
    it('should return only data', async function () {
      adb.isWifiOn.returns(true);
      adb.isDataOn.returns(true);
      adb.isAirplaneModeOn.returns(true);
      await expect(driver.mobileGetConnectivity(['data'])).to.eventually.eql({ data: true });
    });
    it('should return only data and airplaneMode', async function () {
      adb.isWifiOn.returns(true);
      adb.isDataOn.returns(true);
      adb.isAirplaneModeOn.returns(false);
      await expect(driver.mobileGetConnectivity(['data', 'airplaneMode'])).to.eventually.eql({ data: true, airplaneMode: false});
    });
  });
  describe('toggleData', function () {
    it('should toggle data', async function () {
      adb.isDataOn.returns(false);
      (driver.isEmulator as sinon.SinonStub).returns('is_emu');
      (settingsApp.setDataState as sinon.SinonStub).returns('');
      await driver.toggleData();
      expect((settingsApp.setDataState as sinon.SinonStub).calledWithExactly(true, 'is_emu')).to.be.true;
    });
  });
  describe('toggleWiFi', function () {
    it('should toggle wifi', async function () {
      adb.isWifiOn.returns(false);
      (driver.isEmulator as sinon.SinonStub).returns('is_emu');
      (settingsApp.setWifiState as sinon.SinonStub).returns('');
      await driver.toggleWiFi();
      expect((settingsApp.setWifiState as sinon.SinonStub).calledWithExactly(true, 'is_emu')).to.be.true;
    });
  });
  describe('toggleFlightMode', function () {
    it('should toggle flight mode on API < 30', async function () {
      adb.isAirplaneModeOn.returns(false);
      adb.getApiLevel.returns(29);
      adb.setAirplaneMode.returns('');
      adb.broadcastAirplaneMode.returns('');
      await driver.toggleFlightMode();
      expect(adb.setAirplaneMode.calledWithExactly(true)).to.be.true;
      expect(adb.broadcastAirplaneMode.calledWithExactly(true)).to.be.true;
    });
    it('should toggle flight mode on API > 29', async function () {
      adb.isAirplaneModeOn.returns(false);
      adb.getApiLevel.returns(30);
      adb.setAirplaneMode.returns('');
      await driver.toggleFlightMode();
      expect(adb.setAirplaneMode.calledWithExactly(true)).to.be.true;
    });
  });
  describe('setGeoLocation', function () {
    it('should return location in use after setting', async function () {
      (settingsApp.setGeoLocation as sinon.SinonStub).withArgs({latitude: 1.1, longitude: 2.2, altitude: 3.3} as any, 'is_emu').returns('res');
      (settingsApp.getGeoLocation as sinon.SinonStub).returns({
        latitude: '1.1',
        longitude: '2.2',
        altitude: '3.3',
      });
      (driver.isEmulator as sinon.SinonStub).returns('is_emu');
      const {latitude, longitude, altitude} = await driver.setGeoLocation({latitude: 1.1, longitude: 2.2, altitude: 3.3});
      expect(Number.isNaN(latitude)).to.be.false;
      expect(Number.isNaN(longitude)).to.be.false;
      expect(Number.isNaN(altitude)).to.be.false;
    });
  });
  describe('getGeoLocation', function () {
    it('should get location', async function () {
      (settingsApp.getGeoLocation as sinon.SinonStub).returns({
        latitude: '1.1',
        longitude: '2.2',
      });
      const {latitude, longitude, altitude} = await driver.getGeoLocation();
      expect(Number.isNaN(latitude)).to.be.false;
      expect(Number.isNaN(longitude)).to.be.false;
      expect(Number.isNaN(altitude)).to.be.false;
    });
  });
});
