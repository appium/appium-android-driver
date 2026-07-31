import assert from 'node:assert/strict';
import {describe, it, beforeEach, afterEach, before, after} from 'node:test';
import type {TestContext} from 'node:test';

import {ADB} from 'appium-adb';
import sinon from 'sinon';

import * as deviceUtils from '../../../lib/commands/device/utils.js';
import {prepareAvdArgs, prepareEmulator} from '../../../lib/commands/device/utils.js';
import * as geolocation from '../../../lib/commands/geolocation.js';
import * as keyboardHelpers from '../../../lib/commands/keyboard.js';
import {AndroidDriver} from '../../../lib/driver.js';

const DEVICE_COMMON_PATH = '../../../lib/commands/device/common.js';
const DEVICE_UTILS_PATH = '../../../lib/commands/device/utils.js';
const GEOLOCATION_PATH = '../../../lib/commands/geolocation.js';
const KEYBOARD_PATH = '../../../lib/commands/keyboard.js';

let importCounter = 0;
function importFresh(specifier: string) {
  return import(`${specifier}?mock=${importCounter++}`);
}

describe('Device Helpers', function () {
  let driver: AndroidDriver;
  let adb: ADB;
  const sandbox = sinon.createSandbox();

  beforeEach(function () {
    adb = new ADB();
    driver = new AndroidDriver();
    driver.adb = adb;
  });
  afterEach(function () {
    sandbox.restore();
  });

  describe('isEmulator', function () {
    it('should be true if driver opts contain avd', function () {
      const driver = new AndroidDriver();
      driver.opts = {avd: 'yolo'} as any;
      assert.strictEqual(driver.isEmulator(), true);
    });
    it('should be true if driver opts contain emulator udid', function () {
      const driver = new AndroidDriver();
      driver.opts = {udid: 'Emulator-5554'} as any;
      assert.strictEqual(driver.isEmulator(), true);
    });
    it('should be false if driver opts do not contain emulator udid', function () {
      const driver = new AndroidDriver();
      driver.opts = {udid: 'ABCD1234'} as any;
      assert.strictEqual(driver.isEmulator(), false);
    });
    it('should be true if device id in adb contains emulator', function () {
      const driver = new AndroidDriver();
      driver.adb = {curDeviceId: 'emulator-5554'} as any;
      assert.strictEqual(driver.isEmulator(), true);
    });
    it('should be false if device id in adb does not contain emulator', function () {
      const driver = new AndroidDriver();
      driver.adb = {curDeviceId: 'ABCD1234'} as any;
      assert.strictEqual(driver.isEmulator(), false);
    });
  });
  describe('prepareEmulator', function () {
    beforeEach(function () {
      driver.opts = {avd: 'foo@bar', avdArgs: '', language: 'en', locale: 'us'} as any;
    });
    afterEach(function () {
      sandbox.verify();
    });

    it('should not launch avd if one is already running', async function () {
      sandbox
        .stub(adb, 'getRunningAVDWithRetry')
        .withArgs('foobar')
        .resolves({} as any);
      sandbox.stub(adb, 'launchAVD').throws();
      sandbox.stub(adb, 'killEmulator').throws();
      await prepareEmulator.bind(driver)(adb);
    });
    it('should launch avd if one is not running', async function () {
      sandbox.stub(adb, 'getRunningAVDWithRetry').withArgs('foobar').throws();
      sandbox
        .stub(adb, 'launchAVD')
        .withArgs('foo@bar', {
          args: [],
          env: undefined,
          language: 'en',
          country: 'us',
          launchTimeout: undefined,
          readyTimeout: undefined,
        })
        .resolves({} as any);
      await prepareEmulator.bind(driver)(adb);
    });
    it('should parse avd string command line args', async function () {
      driver.opts = {
        avd: 'foobar',
        avdArgs: '--arg1 "value 1" --arg2 "value 2"',
        avdEnv: {
          k1: 'v1',
          k2: 'v2',
        },
      } as any;
      sandbox.stub(adb, 'getRunningAVDWithRetry').withArgs('foobar').throws();
      sandbox
        .stub(adb, 'launchAVD')
        .withArgs('foobar', {
          args: ['--arg1', 'value 1', '--arg2', 'value 2'],
          env: {
            k1: 'v1',
            k2: 'v2',
          },
          language: undefined,
          country: undefined,
          launchTimeout: undefined,
          readyTimeout: undefined,
        })
        .resolves({} as any);
      await prepareEmulator.bind(driver)(adb);
    });
    it('should parse avd array command line args', async function () {
      driver.opts = {
        avd: 'foobar',
        avdArgs: ['--arg1', 'value 1', '--arg2', 'value 2'],
      } as any;
      sandbox.stub(adb, 'getRunningAVDWithRetry').withArgs('foobar').throws();
      sandbox
        .stub(adb, 'launchAVD')
        .withArgs('foobar', {
          args: ['--arg1', 'value 1', '--arg2', 'value 2'],
          env: undefined,
          language: undefined,
          country: undefined,
          launchTimeout: undefined,
          readyTimeout: undefined,
        })
        .resolves({} as any);
      await prepareEmulator.bind(driver)(adb);
    });
    it('should kill emulator if avdArgs contains -wipe-data', async function () {
      driver.opts = {avd: 'foo@bar', avdArgs: '-wipe-data'} as any;
      sandbox
        .stub(adb, 'getRunningAVDWithRetry')
        .withArgs('foobar')
        .resolves({} as any);
      sandbox.stub(adb, 'killEmulator').withArgs('foobar').onFirstCall();
      sandbox.stub(adb, 'launchAVD').onFirstCall();
      await prepareEmulator.bind(driver)(adb);
    });
    it('should fail if avd name is not specified', async function () {
      driver.opts = {} as any;
      await assert.rejects(prepareEmulator.bind(driver)(adb));
    });
  });
  describe('prepareAvdArgs', function () {
    it('should set the correct avdArgs', function () {
      driver.opts = {avdArgs: '-wipe-data'} as any;
      assert.deepStrictEqual(prepareAvdArgs.bind(driver)(), ['-wipe-data']);
    });
    it('should add headless arg', function () {
      driver.opts = {avdArgs: '-wipe-data', isHeadless: true} as any;
      const args = prepareAvdArgs.bind(driver)();
      assert.deepStrictEqual(args, ['-wipe-data', '-no-window']);
    });
    it('should add network speed arg', function () {
      driver.opts = {avdArgs: '-wipe-data', networkSpeed: 'edge'} as any;
      const args = prepareAvdArgs.bind(driver)();
      assert.deepStrictEqual(args, ['-wipe-data', '-netspeed', 'edge']);
    });
    it('should not include empty avdArgs', function () {
      driver.opts = {avdArgs: '', isHeadless: true} as any;
      const args = prepareAvdArgs.bind(driver)();
      assert.deepStrictEqual(args, ['-no-window']);
    });
  });

  describe('getDeviceInfoFromCaps', function () {
    // list of device/emu udids to their os versions
    // using list instead of map to preserve order
    const devices = [
      {udid: 'emulator-1234', os: '4.9.2'},
      {udid: 'rotalume-1339', os: '5.1.5'},
      {udid: 'rotalume-1338', os: '5.0.1'},
      {udid: 'rotalume-1337', os: '5.0.1'},
      {udid: 'roamulet-9000', os: '6.0'},
      {udid: 'roamulet-0', os: '2.3'},
      {udid: 'roamulet-2019', os: '9'},
      {udid: '0123456789', os: 'wellhellothere'},
    ];
    let curDeviceId = '';

    before(function () {
      sinon.stub(ADB, 'createADB').callsFake(async function () {
        return {
          getDevicesWithRetry() {
            return devices.map((device) => ({udid: device.udid}));
          },

          getPortFromEmulatorString() {
            return 1234;
          },

          getRunningAVDWithRetry() {
            return {udid: 'emulator-1234', port: 1234};
          },

          setDeviceId(udid: string) {
            curDeviceId = udid;
          },

          getPlatformVersion() {
            return devices.find((device) => device.udid === curDeviceId)?.os;
          },
          curDeviceId: 'emulator-1234',
          emulatorPort: 1234,
        } as any;
      });
    });

    after(function () {
      (ADB.createADB as sinon.SinonStub).restore();
    });

    it('should throw error when udid not in list', async function () {
      const driver = new AndroidDriver();
      driver.opts = {
        udid: 'foomulator',
      } as any;
      driver.adb = await ADB.createADB();
      await assert.rejects(driver.getDeviceInfoFromCaps(), /foomulator/);
    });
    it('should get deviceId and emPort when udid is present', async function () {
      const driver = new AndroidDriver();
      driver.opts = {
        udid: 'emulator-1234',
      } as any;
      driver.adb = await ADB.createADB();
      const {udid, emPort} = await driver.getDeviceInfoFromCaps();
      assert.strictEqual(udid, 'emulator-1234');
      assert.strictEqual(emPort, 1234);
    });
    it('should get first deviceId and emPort if avd, platformVersion, and udid are not given', async function () {
      const driver = new AndroidDriver();
      driver.adb = await ADB.createADB();
      const {udid, emPort} = await driver.getDeviceInfoFromCaps();
      assert.strictEqual(udid, 'emulator-1234');
      assert.strictEqual(emPort, 1234);
    });
    it('should get deviceId and emPort when avd is present', async function () {
      const driver = new AndroidDriver();
      driver.opts = {
        avd: 'AVD_NAME',
      } as any;
      driver.adb = await ADB.createADB();
      const {udid, emPort} = await driver.getDeviceInfoFromCaps();
      assert.strictEqual(udid, 'emulator-1234');
      assert.strictEqual(emPort, 1234);
    });
    it('should fail if the given platformVersion is not found', async function () {
      const driver = new AndroidDriver();
      driver.opts = {
        platformVersion: '1234567890',
      } as any;
      driver.adb = await ADB.createADB();
      await assert.rejects(
        driver.getDeviceInfoFromCaps(),
        /Unable to find an active device or emulator with OS 1234567890/,
      );
    });
    it('should get deviceId and emPort if platformVersion is found and unique', async function () {
      const driver = new AndroidDriver();
      driver.opts = {
        platformVersion: '6.0',
      } as any;
      driver.adb = await ADB.createADB();
      const {udid, emPort} = await driver.getDeviceInfoFromCaps();
      assert.strictEqual(udid, 'roamulet-9000');
      assert.strictEqual(emPort, 1234);
    });
    it('should get deviceId and emPort if platformVersion is shorter than os version', async function () {
      const driver = new AndroidDriver();
      driver.opts = {
        platformVersion: 9,
      } as any;
      driver.adb = await ADB.createADB();
      const {udid, emPort} = await driver.getDeviceInfoFromCaps();
      assert.strictEqual(udid, 'roamulet-2019');
      assert.strictEqual(emPort, 1234);
    });
    it('should get the first deviceId and emPort if platformVersion is found multiple times', async function () {
      const driver = new AndroidDriver();
      driver.opts = {
        platformVersion: '5.0.1',
      } as any;
      driver.adb = await ADB.createADB();
      const {udid, emPort} = await driver.getDeviceInfoFromCaps();
      assert.strictEqual(udid, 'rotalume-1338');
      assert.strictEqual(emPort, 1234);
    });
    it('should get the deviceId and emPort of most recent version if we have partial match', async function () {
      const driver = new AndroidDriver();
      driver.opts = {
        platformVersion: '5.0',
      } as any;
      driver.adb = await ADB.createADB();
      const {udid, emPort} = await driver.getDeviceInfoFromCaps();
      assert.strictEqual(udid, 'rotalume-1338');
      assert.strictEqual(emPort, 1234);
    });
    it('should get deviceId and emPort by udid if udid and platformVersion are given', async function () {
      const driver = new AndroidDriver();
      driver.opts = {
        udid: '0123456789',
        platformVersion: '2.3',
      } as any;
      driver.adb = await ADB.createADB();
      const {udid, emPort} = await driver.getDeviceInfoFromCaps();
      assert.strictEqual(udid, '0123456789');
      assert.strictEqual(emPort, 1234);
    });
    it('should require adb_listen_all_network with adbListenAllNetwork', async function () {
      const driver = new AndroidDriver();
      driver.opts = {
        udid: 'foomulator',
        adbListenAllNetwork: true,
      } as any;
      driver.adb = await ADB.createADB();
      await assert.rejects(driver.getDeviceInfoFromCaps());
    });
    it('should get deviceId and emPort when udid is present with adbListenAllNetwork', async function () {
      const driver = new AndroidDriver();
      driver.opts = {
        udid: 'emulator-1234',
        adbListenAllNetwork: true,
      } as any;
      sandbox.stub(driver, 'assertFeatureEnabled').withArgs('adb_listen_all_network').onFirstCall();
      driver.adb = await ADB.createADB();
      const {udid, emPort} = await driver.getDeviceInfoFromCaps();
      assert.strictEqual(udid, 'emulator-1234');
      assert.strictEqual(emPort, 1234);
    });
  });
  describe('createADB', function () {
    let curDeviceId = '';
    let emulatorPort = -1;
    before(function () {
      sinon.stub(ADB, 'createADB').callsFake(async function () {
        return {
          setDeviceId: (udid: string) => {
            curDeviceId = udid;
          },

          setEmulatorPort: (emPort: number) => {
            emulatorPort = emPort;
          },
        } as any;
      });
    });
    after(function () {
      (ADB.createADB as sinon.SinonStub).restore();
    });
    it('should create adb and set device id and emulator port', async function () {
      driver.opts = {
        udid: '111222',
        emPort: 111,
        adbPort: '222',
        suppressKillServer: true,
        remoteAdbHost: 'remote_host',
        clearDeviceLogsOnStart: true,
        adbExecTimeout: 50,
        useKeystore: true,
        keystorePath: '/some/path',
        keystorePassword: '123456',
        keyAlias: 'keyAlias',
        keyPassword: 'keyPassword',
        remoteAppsCacheLimit: 5,
        buildToolsVersion: '1.2.3',
        allowOfflineDevices: true,
      } as any;
      await driver.createADB();
      assert.strictEqual(
        (ADB.createADB as sinon.SinonStub).calledWithExactly({
          adbPort: '222',
          suppressKillServer: true,
          remoteAdbHost: 'remote_host',
          clearDeviceLogsOnStart: true,
          adbExecTimeout: 50,
          useKeystore: true,
          keystorePath: '/some/path',
          keystorePassword: '123456',
          keyAlias: 'keyAlias',
          keyPassword: 'keyPassword',
          remoteAppsCacheLimit: 5,
          buildToolsVersion: '1.2.3',
          allowOfflineDevices: true,
          allowDelayAdb: undefined,
          listenAllNetwork: undefined,
        }),
        true,
      );
      assert.strictEqual(curDeviceId, '111222');
      assert.strictEqual(emulatorPort, 111);
    });
    it('should not set emulator port if emPort is undefined', async function () {
      emulatorPort = 5555;
      await driver.createADB();
      assert.strictEqual(emulatorPort, 5555);
    });

    describe('adbListenAllNetwork', function () {
      it('should require adb_listen_all_network', async function () {
        driver.opts = {
          adbListenAllNetwork: true,
        } as any;
        await assert.rejects(driver.createADB());
      });
      it('should succeeded in creating adb', async function () {
        driver.opts = {
          adbListenAllNetwork: true,
        } as any;
        sandbox.stub(driver, 'assertFeatureEnabled').withArgs('adb_listen_all_network').onFirstCall();
        await driver.createADB();
      });
    });
  });
  describe('initDevice', function () {
    async function mockInitDevice(
      t: TestContext,
      overrides: {
        pushSettingsApp?: sinon.SinonStub;
        setMockLocationApp?: sinon.SinonStub;
        hideKeyboardCompletely?: sinon.SinonStub;
      },
    ) {
      if (overrides.pushSettingsApp) {
        t.mock.module(DEVICE_UTILS_PATH, {
          namedExports: {...deviceUtils, pushSettingsApp: overrides.pushSettingsApp},
        });
      }
      if (overrides.setMockLocationApp) {
        t.mock.module(GEOLOCATION_PATH, {
          namedExports: {...geolocation, setMockLocationApp: overrides.setMockLocationApp},
        });
      }
      if (overrides.hideKeyboardCompletely) {
        t.mock.module(KEYBOARD_PATH, {
          namedExports: {...keyboardHelpers, hideKeyboardCompletely: overrides.hideKeyboardCompletely},
        });
      }
      return (await importFresh(DEVICE_COMMON_PATH)).initDevice;
    }

    it('should init a real device', async function (t) {
      const driver = new AndroidDriver();
      driver.adb = new ADB();
      driver.opts = {language: 'en', locale: 'us', localeScript: 'Script'} as any;
      sandbox.stub(driver.adb, 'waitForDevice').throws();
      sandbox.stub(driver.adb, 'startLogcat').onFirstCall();
      sandbox
        .stub(driver, 'ensureDeviceLocale')
        .withArgs(driver.opts.language, driver.opts.locale, driver.opts.localeScript)
        .onFirstCall();
      const initDevice = await mockInitDevice(t, {
        pushSettingsApp: sandbox.stub(),
        setMockLocationApp: sandbox.stub().withArgs('io.appium.settings'),
      });
      await initDevice.bind(driver)();
    });
    it('should init device without locale and language', async function (t) {
      const driver = new AndroidDriver();
      driver.adb = new ADB();
      driver.opts = {} as any;
      sandbox.stub(driver.adb, 'waitForDevice').throws();
      sandbox.stub(driver.adb, 'startLogcat').onFirstCall();
      sandbox.stub(driver, 'ensureDeviceLocale').throws();
      const initDevice = await mockInitDevice(t, {
        pushSettingsApp: sandbox.stub(),
        setMockLocationApp: sandbox.stub().withArgs('io.appium.settings'),
      });
      await initDevice.bind(driver)();
    });
    it('should init device with either locale or language', async function (t) {
      const driver = new AndroidDriver();
      driver.adb = new ADB();
      driver.opts = {language: 'en'} as any;
      sandbox.stub(driver.adb, 'waitForDevice').throws();
      sandbox.stub(driver.adb, 'startLogcat').onFirstCall();
      sandbox
        .stub(driver, 'ensureDeviceLocale')
        .withArgs(driver.opts.language, driver.opts.locale, driver.opts.localeScript)
        .onFirstCall();
      const initDevice = await mockInitDevice(t, {
        pushSettingsApp: sandbox.stub(),
        setMockLocationApp: sandbox.stub().withArgs('io.appium.settings'),
      });
      await initDevice.bind(driver)();
    });
    it('should not install mock location on emulator', async function (t) {
      const driver = new AndroidDriver();
      driver.adb = new ADB();
      driver.opts = {avd: 'avd'} as any;
      sandbox.stub(driver.adb, 'waitForDevice').onFirstCall();
      sandbox.stub(driver.adb, 'startLogcat').onFirstCall();
      sandbox.stub(driver, 'ensureDeviceLocale').throws();
      const initDevice = await mockInitDevice(t, {
        pushSettingsApp: sandbox.stub(),
        setMockLocationApp: sandbox.stub().throws(),
      });
      await initDevice.bind(driver)();
    });
    it('should set empty IME if hideKeyboard is set to true', async function (t) {
      const driver = new AndroidDriver();
      driver.adb = new ADB();
      driver.opts = {hideKeyboard: true} as any;
      sandbox.stub(driver.adb, 'waitForDevice').throws();
      sandbox.stub(driver.adb, 'startLogcat').onFirstCall();
      sandbox.stub(driver, 'ensureDeviceLocale').throws();
      const initDevice = await mockInitDevice(t, {
        pushSettingsApp: sandbox.stub(),
        setMockLocationApp: sandbox.stub(),
        hideKeyboardCompletely: sandbox.stub(),
      });
      await initDevice.bind(driver)();
    });
    it('should init device without starting logcat', async function (t) {
      const driver = new AndroidDriver();
      driver.adb = new ADB();
      driver.opts = {skipLogcatCapture: true} as any;
      sandbox.stub(driver.adb, 'waitForDevice').throws();
      sandbox.stub(driver.adb, 'startLogcat').throws();
      sandbox.stub(driver, 'ensureDeviceLocale').throws();
      const initDevice = await mockInitDevice(t, {
        pushSettingsApp: sandbox.stub(),
        setMockLocationApp: sandbox.stub().withArgs('io.appium.settings'),
      });
      await initDevice.bind(driver)();
    });
    it('should not reinstall the Settings app when skipSettingsAppReinstall is set and the app is present', async function (t) {
      const driver = new AndroidDriver();
      driver.adb = new ADB();
      driver.opts = {skipSettingsAppReinstall: true} as any;
      sandbox.stub(driver.adb, 'waitForDevice').throws();
      sandbox.stub(driver.adb, 'startLogcat').onFirstCall();
      sandbox.stub(driver.adb, 'isAppInstalled').withArgs('io.appium.settings').resolves(true);
      sandbox.stub(driver, 'ensureDeviceLocale').throws();
      const pushStub = sandbox.stub();
      const initDevice = await mockInitDevice(t, {
        pushSettingsApp: pushStub,
        setMockLocationApp: sandbox.stub().withArgs('io.appium.settings'),
      });
      await initDevice.bind(driver)();
      assert.strictEqual(pushStub.called, false);
    });
    it('should throw if skipSettingsAppReinstall is set but the Settings app is not installed', async function (t) {
      const driver = new AndroidDriver();
      driver.adb = new ADB();
      driver.opts = {skipSettingsAppReinstall: true} as any;
      sandbox.stub(driver.adb, 'waitForDevice').throws();
      sandbox.stub(driver.adb, 'startLogcat').onFirstCall();
      sandbox.stub(driver.adb, 'isAppInstalled').withArgs('io.appium.settings').resolves(false);
      const pushStub = sandbox.stub();
      const initDevice = await mockInitDevice(t, {pushSettingsApp: pushStub});
      await assert.rejects(initDevice.bind(driver)(), /not installed/);
      assert.strictEqual(pushStub.called, false);
    });
  });
});
