import sinon from 'sinon';
import {ADB} from 'appium-adb';
import _ from 'lodash';
import {AndroidDriver} from '../../../lib/driver';
import {prepareAvdArgs, prepareEmulator} from '../../../lib/commands/device/utils';
import * as deviceUtils from '../../../lib/commands/device/utils';
import * as geolocationHelpers from '../../../lib/commands/geolocation';
import * as keyboardHelpers from '../../../lib/commands/keyboard';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';

use(chaiAsPromised);

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
      expect(driver.isEmulator()).to.be.true;
    });
    it('should be true if driver opts contain emulator udid', function () {
      const driver = new AndroidDriver();
      driver.opts = {udid: 'Emulator-5554'} as any;
      expect(driver.isEmulator()).to.be.true;
    });
    it('should be false if driver opts do not contain emulator udid', function () {
      const driver = new AndroidDriver();
      driver.opts = {udid: 'ABCD1234'} as any;
      expect(driver.isEmulator()).to.be.false;
    });
    it('should be true if device id in adb contains emulator', function () {
      const driver = new AndroidDriver();
      driver.adb = {curDeviceId: 'emulator-5554'} as any;
      expect(driver.isEmulator()).to.be.true;
    });
    it('should be false if device id in adb does not contain emulator', function () {
      const driver = new AndroidDriver();
      driver.adb = {curDeviceId: 'ABCD1234'} as any;
      expect(driver.isEmulator()).to.be.false;
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
      sandbox.stub(adb, 'getRunningAVDWithRetry').withArgs('foobar').returns('foo');
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
        .returns('');
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
        .returns('');
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
        .returns('');
      await prepareEmulator.bind(driver)(adb);
    });
    it('should kill emulator if avdArgs contains -wipe-data', async function () {
      driver.opts = {avd: 'foo@bar', avdArgs: '-wipe-data'} as any;
      sandbox.stub(adb, 'getRunningAVDWithRetry').withArgs('foobar').returns('foo');
      sandbox.stub(adb, 'killEmulator').withArgs('foobar').onFirstCall();
      sandbox.stub(adb, 'launchAVD').onFirstCall();
      await prepareEmulator.bind(driver)(adb);
    });
    it('should fail if avd name is not specified', async function () {
      driver.opts = {} as any;
      await expect(prepareEmulator.bind(driver)(adb)).to.eventually.be.rejected;
    });
  });
  describe('prepareAvdArgs', function () {
    it('should set the correct avdArgs', function () {
      driver.opts = {avdArgs: '-wipe-data'} as any;
      expect(prepareAvdArgs.bind(driver)()).to.eql(['-wipe-data']);
    });
    it('should add headless arg', function () {
      driver.opts = {avdArgs: '-wipe-data', isHeadless: true} as any;
      const args = prepareAvdArgs.bind(driver)();
      expect(args).to.eql(['-wipe-data', '-no-window']);
    });
    it('should add network speed arg', function () {
      driver.opts = {avdArgs: '-wipe-data', networkSpeed: 'edge'} as any;
      const args = prepareAvdArgs.bind(driver)();
      expect(args).to.eql(['-wipe-data', '-netspeed', 'edge']);
    });
    it('should not include empty avdArgs', function () {
      driver.opts = {avdArgs: '', isHeadless: true} as any;
      const args = prepareAvdArgs.bind(driver)();
      expect(args).to.eql(['-no-window']);
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
      sinon.stub(ADB, 'createADB').callsFake(function () {
        return {
          getDevicesWithRetry() {
            return _.map(devices, function getDevice(device) {
              return {udid: device.udid};
            });
          },

          getPortFromEmulatorString() {
            return 1234;
          },

          getRunningAVDWithRetry() {
            return {udid: 'emulator-1234', port: 1234};
          },

          setDeviceId(udid) {
            curDeviceId = udid;
          },

          getPlatformVersion() {
            return _.filter(devices, {udid: curDeviceId})[0].os;
          },
          curDeviceId: 'emulator-1234',
          emulatorPort: 1234,
        };
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
      await expect(driver.getDeviceInfoFromCaps()).to.be.rejectedWith('foomulator');
    });
    it('should get deviceId and emPort when udid is present', async function () {
      const driver = new AndroidDriver();
      driver.opts = {
        udid: 'emulator-1234',
      } as any;
      driver.adb = await ADB.createADB();
      const {udid, emPort} = await driver.getDeviceInfoFromCaps();
      expect(udid).to.equal('emulator-1234');
      expect(emPort).to.equal(1234);
    });
    it('should get first deviceId and emPort if avd, platformVersion, and udid are not given', async function () {
      const driver = new AndroidDriver();
      driver.adb = await ADB.createADB();
      const {udid, emPort} = await driver.getDeviceInfoFromCaps();
      expect(udid).to.equal('emulator-1234');
      expect(emPort).to.equal(1234);
    });
    it('should get deviceId and emPort when avd is present', async function () {
      const driver = new AndroidDriver();
      driver.opts = {
        avd: 'AVD_NAME',
      } as any;
      driver.adb = await ADB.createADB();
      const {udid, emPort} = await driver.getDeviceInfoFromCaps();
      expect(udid).to.equal('emulator-1234');
      expect(emPort).to.equal(1234);
    });
    it('should fail if the given platformVersion is not found', async function () {
      const driver = new AndroidDriver();
      driver.opts = {
        platformVersion: '1234567890',
      } as any;
      driver.adb = await ADB.createADB();
      await expect(driver.getDeviceInfoFromCaps()).to.be.rejectedWith('Unable to find an active device or emulator with OS 1234567890');
    });
    it('should get deviceId and emPort if platformVersion is found and unique', async function () {
      const driver = new AndroidDriver();
      driver.opts = {
        platformVersion: '6.0',
      } as any;
      driver.adb = await ADB.createADB();
      const {udid, emPort} = await driver.getDeviceInfoFromCaps();
      expect(udid).to.equal('roamulet-9000');
      expect(emPort).to.equal(1234);
    });
    it('should get deviceId and emPort if platformVersion is shorter than os version', async function () {
      const driver = new AndroidDriver();
      driver.opts = {
        platformVersion: 9,
      } as any;
      driver.adb = await ADB.createADB();
      const {udid, emPort} = await driver.getDeviceInfoFromCaps();
      expect(udid).to.equal('roamulet-2019');
      expect(emPort).to.equal(1234);
    });
    it('should get the first deviceId and emPort if platformVersion is found multiple times', async function () {
      const driver = new AndroidDriver();
      driver.opts = {
        platformVersion: '5.0.1',
      } as any;
      driver.adb = await ADB.createADB();
      const {udid, emPort} = await driver.getDeviceInfoFromCaps();
      expect(udid).to.equal('rotalume-1338');
      expect(emPort).to.equal(1234);
    });
    it('should get the deviceId and emPort of most recent version if we have partial match', async function () {
      const driver = new AndroidDriver();
      driver.opts = {
        platformVersion: '5.0',
      } as any;
      driver.adb = await ADB.createADB();
      const {udid, emPort} = await driver.getDeviceInfoFromCaps();
      expect(udid).to.equal('rotalume-1338');
      expect(emPort).to.equal(1234);
    });
    it('should get deviceId and emPort by udid if udid and platformVersion are given', async function () {
      const driver = new AndroidDriver();
      driver.opts = {
        udid: '0123456789',
        platformVersion: '2.3',
      } as any;
      driver.adb = await ADB.createADB();
      const {udid, emPort} = await driver.getDeviceInfoFromCaps();
      expect(udid).to.equal('0123456789');
      expect(emPort).to.equal(1234);
    });
  });
  describe('createADB', function () {
    let curDeviceId = '';
    let emulatorPort = -1;
    before(function () {
      sinon.stub(ADB, 'createADB').callsFake(function () {
        return {
          setDeviceId: (udid) => {
            curDeviceId = udid;
          },

          setEmulatorPort: (emPort) => {
            emulatorPort = emPort;
          },
        };
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
      expect((ADB.createADB as sinon.SinonStub).calledWithExactly({
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
      })).to.be.true;
      expect(curDeviceId).to.equal('111222');
      expect(emulatorPort).to.equal(111);
    });
    it('should not set emulator port if emPort is undefined', async function () {
      emulatorPort = 5555;
      await driver.createADB();
      expect(emulatorPort).to.equal(5555);
    });
  });
  describe('initDevice', function () {
    it('should init a real device', async function () {
      const driver = new AndroidDriver();
      driver.adb = new ADB();
      driver.opts = {language: 'en', locale: 'us', localeScript: 'Script'} as any;
      sandbox.stub(driver.adb, 'waitForDevice').throws();
      sandbox.stub(driver.adb, 'startLogcat').onFirstCall();
      sandbox.stub(deviceUtils, 'pushSettingsApp').onFirstCall();
      sandbox
        .stub(driver, 'ensureDeviceLocale')
        .withArgs(driver.opts.language, driver.opts.locale, driver.opts.localeScript)
        .onFirstCall();
      sandbox
        .stub(geolocationHelpers, 'setMockLocationApp')
        .withArgs('io.appium.settings')
        .onFirstCall();
      await driver.initDevice();
    });
    it('should init device without locale and language', async function () {
      const driver = new AndroidDriver();
      driver.adb = new ADB();
      driver.opts = {} as any;
      sandbox.stub(driver.adb, 'waitForDevice').throws();
      sandbox.stub(driver.adb, 'startLogcat').onFirstCall();
      sandbox.stub(deviceUtils, 'pushSettingsApp').onFirstCall();
      sandbox.stub(driver, 'ensureDeviceLocale').throws();
      sandbox
        .stub(geolocationHelpers, 'setMockLocationApp')
        .withArgs('io.appium.settings')
        .onFirstCall();
      await driver.initDevice();
    });
    it('should init device with either locale or language', async function () {
      const driver = new AndroidDriver();
      driver.adb = new ADB();
      driver.opts = {language: 'en'} as any;
      sandbox.stub(driver.adb, 'waitForDevice').throws();
      sandbox.stub(driver.adb, 'startLogcat').onFirstCall();
      sandbox.stub(deviceUtils, 'pushSettingsApp').onFirstCall();
      sandbox
        .stub(driver, 'ensureDeviceLocale')
        .withArgs(driver.opts.language, driver.opts.locale, driver.opts.localeScript)
        .onFirstCall();
      sandbox
        .stub(geolocationHelpers, 'setMockLocationApp')
        .withArgs('io.appium.settings')
        .onFirstCall();
      await driver.initDevice();
    });
    it('should not install mock location on emulator', async function () {
      const driver = new AndroidDriver();
      driver.adb = new ADB();
      driver.opts = {avd: 'avd'} as any;
      sandbox.stub(driver.adb, 'waitForDevice').onFirstCall();
      sandbox.stub(driver.adb, 'startLogcat').onFirstCall();
      sandbox.stub(deviceUtils, 'pushSettingsApp').onFirstCall();
      sandbox.stub(driver, 'ensureDeviceLocale').throws();
      sandbox.stub(geolocationHelpers, 'setMockLocationApp').throws();
      await driver.initDevice();
    });
    it('should set empty IME if hideKeyboard is set to true', async function () {
      const driver = new AndroidDriver();
      driver.adb = new ADB();
      driver.opts = {hideKeyboard: true} as any;
      sandbox.stub(driver.adb, 'waitForDevice').throws();
      sandbox.stub(driver.adb, 'startLogcat').onFirstCall();
      sandbox.stub(deviceUtils, 'pushSettingsApp').onFirstCall();
      sandbox.stub(driver, 'ensureDeviceLocale').throws();
      sandbox.stub(geolocationHelpers, 'setMockLocationApp').onFirstCall();
      sandbox.stub(keyboardHelpers, 'hideKeyboardCompletely').onFirstCall();
      await driver.initDevice();
    });
    it('should init device without starting logcat', async function () {
      const driver = new AndroidDriver();
      driver.adb = new ADB();
      driver.opts = {skipLogcatCapture: true} as any;
      sandbox.stub(driver.adb, 'waitForDevice').throws();
      sandbox.stub(driver.adb, 'startLogcat').throws();
      sandbox.stub(deviceUtils, 'pushSettingsApp').onFirstCall();
      sandbox.stub(driver, 'ensureDeviceLocale').throws();
      sandbox
        .stub(geolocationHelpers, 'setMockLocationApp')
        .withArgs('io.appium.settings')
        .onFirstCall();
      await driver.initDevice();
    });
  });
});
