import assert from 'node:assert/strict';
import {describe, it, beforeEach, afterEach} from 'node:test';

import {ADB} from 'appium-adb';
import {errors} from 'appium/driver.js';
import {SettingsApp} from 'io.appium.settings';
import sinon from 'sinon';

import {AndroidDriver} from '../../../lib/driver.js';

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
  });
  afterEach(function () {
    sandbox.restore();
  });
  describe('getNetworkConnection', function () {
    beforeEach(function () {
      adb.isAirplaneModeOn.resolves(false);
      adb.isDataOn.resolves(false);
      sandbox.stub(driver, 'isWifiOn').resolves(false);
    });
    it('should determine nothing enabled', async function () {
      assert.strictEqual(await driver.getNetworkConnection(), 0);
    });
    it('should determine airplane mode is on', async function () {
      adb.isAirplaneModeOn.resolves(true);
      assert.strictEqual(await driver.getNetworkConnection(), 1);
    });
    it('should determine wifi is on', async function () {
      (driver.isWifiOn as sinon.SinonStub).resolves(true);
      assert.strictEqual(await driver.getNetworkConnection(), 2);
    });
    it('should determine data is on', async function () {
      adb.isDataOn.resolves(true);
      assert.strictEqual(await driver.getNetworkConnection(), 4);
    });
    it('should determine wifi and data are on', async function () {
      (driver.isWifiOn as sinon.SinonStub).resolves(true);
      adb.isDataOn.resolves(true);
      assert.strictEqual(await driver.getNetworkConnection(), 6);
    });
  });
  describe('isWifiOn', function () {
    it('should return wifi state', async function () {
      adb.isWifiOn.resolves(true);
      assert.strictEqual(await driver.isWifiOn(), true);
    });
  });
  describe('setNetworkConnection', function () {
    beforeEach(function () {
      (driver.isEmulator as sinon.SinonStub).returns(false);
    });
    it('should turn off wifi and data', async function () {
      sandbox.stub(driver, 'getNetworkConnection').resolves(6);
      const setWifiStateStubA = sandbox.stub(driver, 'setWifiState');
      const setDataStateStubA = sandbox.stub(driver, 'setDataState');
      await driver.setNetworkConnection(0);
      assert.strictEqual(adb.setAirplaneMode.called, false);
      assert.strictEqual(adb.broadcastAirplaneMode.called, false);
      assert.strictEqual(setWifiStateStubA.calledWithExactly(false), true);
      assert.strictEqual(setDataStateStubA.calledWithExactly(false), true);
    });
    it('should turn on and broadcast airplane mode', async function () {
      sandbox.stub(driver, 'getNetworkConnection').resolves(0);
      adb.getApiLevel.resolves(29);
      const setWifiStateStubB = sandbox.stub(driver, 'setWifiState');
      const setDataStateStubB = sandbox.stub(driver, 'setDataState');
      await driver.setNetworkConnection(1);
      assert.strictEqual(adb.setAirplaneMode.calledWithExactly(true), true);
      assert.strictEqual(adb.broadcastAirplaneMode.calledWithExactly(true), true);
      assert.strictEqual(setWifiStateStubB.called, false);
      assert.strictEqual(setDataStateStubB.called, false);
    });
    it('should turn on wifi', async function () {
      sandbox.stub(driver, 'getNetworkConnection').resolves(0);
      const setWifiStateStub1 = sandbox.stub(driver, 'setWifiState');
      const setDataStateStub1 = sandbox.stub(driver, 'setDataState');
      await driver.setNetworkConnection(2);
      assert.strictEqual(adb.setAirplaneMode.called, false);
      assert.strictEqual(adb.broadcastAirplaneMode.called, false);
      assert.strictEqual(setWifiStateStub1.calledWithExactly(true), true);
      assert.strictEqual(setDataStateStub1.called, false);
    });
    it('should turn on data', async function () {
      sandbox.stub(driver, 'getNetworkConnection').resolves(0);
      const setDataStateStub3 = sandbox.stub(driver, 'setDataState');
      const setWifiStateStub4 = sandbox.stub(driver, 'setWifiState');
      await driver.setNetworkConnection(4);
      assert.strictEqual(adb.setAirplaneMode.called, false);
      assert.strictEqual(adb.broadcastAirplaneMode.called, false);
      assert.strictEqual(setWifiStateStub4.called, false);
      assert.strictEqual(setDataStateStub3.calledWithExactly(true), true);
    });
    it('should turn on data and wifi', async function () {
      sandbox.stub(driver, 'getNetworkConnection').resolves(0);
      const setWifiStateStub3 = sandbox.stub(driver, 'setWifiState');
      const setDataStateStub4 = sandbox.stub(driver, 'setDataState');
      await driver.setNetworkConnection(6);
      assert.strictEqual(adb.setAirplaneMode.called, false);
      assert.strictEqual(adb.broadcastAirplaneMode.called, false);
      assert.strictEqual(setWifiStateStub3.calledWithExactly(true), true);
      assert.strictEqual(setDataStateStub4.calledWithExactly(true), true);
    });
  });
  describe('mobileGetConnectivity', function () {
    it('should raise unsupported services in string', async function () {
      await assert.rejects(driver.mobileGetConnectivity('bad' as any), errors.InvalidArgumentError);
    });
    it('should raise unsupported services in array', async function () {
      await assert.rejects(driver.mobileGetConnectivity(['bad', 'array'] as any), errors.InvalidArgumentError);
    });
    it('should raise unsupported services with an empty array', async function () {
      assert.deepStrictEqual(await driver.mobileGetConnectivity(), {});
    });
    it('should return all supported services', async function () {
      adb.isWifiOn.resolves(true);
      adb.isDataOn.resolves(true);
      adb.isAirplaneModeOn.resolves(true);
      assert.deepStrictEqual(await driver.mobileGetConnectivity(), {
        wifi: true,
        data: true,
        airplaneMode: true,
      });
    });
    it('should return only wifi', async function () {
      adb.isWifiOn.resolves(true);
      adb.isDataOn.resolves(true);
      adb.isAirplaneModeOn.resolves(true);
      assert.deepStrictEqual(await driver.mobileGetConnectivity('wifi'), {wifi: true});
    });
    it('should return only data', async function () {
      adb.isWifiOn.resolves(true);
      adb.isDataOn.resolves(true);
      adb.isAirplaneModeOn.resolves(true);
      assert.deepStrictEqual(await driver.mobileGetConnectivity(['data']), {data: true});
    });
    it('should return only data and airplaneMode', async function () {
      adb.isWifiOn.resolves(true);
      adb.isDataOn.resolves(true);
      adb.isAirplaneModeOn.resolves(false);
      assert.deepStrictEqual(await driver.mobileGetConnectivity(['data', 'airplaneMode']), {
        data: true,
        airplaneMode: false,
      });
    });
  });
  describe('toggleData', function () {
    it('should toggle data', async function () {
      adb.isDataOn.resolves(false);
      (driver.isEmulator as sinon.SinonStub).returns('is_emu');
      (settingsApp.setDataState as sinon.SinonStub).resolves('');
      await driver.toggleData();
      assert.strictEqual((settingsApp.setDataState as sinon.SinonStub).calledWithExactly(true, 'is_emu'), true);
    });
  });
  describe('toggleWiFi', function () {
    it('should toggle wifi', async function () {
      adb.isWifiOn.resolves(false);
      (driver.isEmulator as sinon.SinonStub).returns('is_emu');
      (settingsApp.setWifiState as sinon.SinonStub).resolves('');
      await driver.toggleWiFi();
      assert.strictEqual((settingsApp.setWifiState as sinon.SinonStub).calledWithExactly(true, 'is_emu'), true);
    });
  });
  describe('toggleFlightMode', function () {
    it('should toggle flight mode on API < 30', async function () {
      adb.isAirplaneModeOn.resolves(false);
      adb.getApiLevel.resolves(29);
      adb.setAirplaneMode.resolves();
      adb.broadcastAirplaneMode.resolves();
      await driver.toggleFlightMode();
      assert.strictEqual(adb.setAirplaneMode.calledWithExactly(true), true);
      assert.strictEqual(adb.broadcastAirplaneMode.calledWithExactly(true), true);
    });
    it('should toggle flight mode on API > 29', async function () {
      adb.isAirplaneModeOn.resolves(false);
      adb.getApiLevel.resolves(30);
      adb.setAirplaneMode.resolves();
      await driver.toggleFlightMode();
      assert.strictEqual(adb.setAirplaneMode.calledWithExactly(true), true);
    });
  });
  describe('setGeoLocation', function () {
    it('should return location in use after setting', async function () {
      (settingsApp.setGeoLocation as sinon.SinonStub)
        .withArgs({latitude: 1.1, longitude: 2.2, altitude: 3.3} as any, 'is_emu')
        .resolves('res');
      (settingsApp.getGeoLocation as sinon.SinonStub).resolves({
        latitude: '1.1',
        longitude: '2.2',
        altitude: '3.3',
      });
      (driver.isEmulator as sinon.SinonStub).returns('is_emu');
      const {latitude, longitude, altitude} = await driver.setGeoLocation({
        latitude: 1.1,
        longitude: 2.2,
        altitude: 3.3,
      });
      assert.strictEqual(Number.isNaN(latitude), false);
      assert.strictEqual(Number.isNaN(longitude), false);
      assert.strictEqual(Number.isNaN(altitude), false);
    });
  });
  describe('getGeoLocation', function () {
    it('should get location', async function () {
      (settingsApp.getGeoLocation as sinon.SinonStub).resolves({
        latitude: '1.1',
        longitude: '2.2',
      });
      const {latitude, longitude, altitude} = await driver.getGeoLocation();
      assert.strictEqual(Number.isNaN(latitude), false);
      assert.strictEqual(Number.isNaN(longitude), false);
      assert.strictEqual(Number.isNaN(altitude), false);
    });
  });
});
