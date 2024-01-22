import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import ADB from 'appium-adb';
import _ from 'lodash';
import { AndroidDriver } from '../../../lib/driver';
import { prepareAvdArgs, prepareEmulator } from '../../../lib/commands/device/utils';
import * as deviceUtils from '../../../lib/commands/device/utils';
import * as geolocationHelpers from '../../../lib/commands/geolocation';

chai.use(chaiAsPromised);

describe('Device Helpers', function () {
  /** @type {AndroidDriver} */
  let driver;
  let sandbox = sinon.createSandbox();

  beforeEach(function () {
    const adb = new ADB();
    driver = new AndroidDriver();
    driver.adb = adb;
  });
  afterEach(function () {
    sandbox.restore();
  });

  describe('isEmulator', function () {
    it('should be true if driver opts contain avd', function () {
      driver.isEmulator(null, {avd: 'yolo'}).should.be.true;
    });
    it('should be true if driver opts contain emulator udid', function () {
      driver.isEmulator({}, {udid: 'Emulator-5554'}).should.be.true;
    });
    it('should be false if driver opts do not contain emulator udid', function () {
      driver.isEmulator({}, {udid: 'ABCD1234'}).should.be.false;
    });
    it('should be true if device id in adb contains emulator', function () {
      driver.isEmulator({curDeviceId: 'emulator-5554'}, {}).should.be.true;
    });
    it('should be false if device id in adb does not contain emulator', function () {
      driver.isEmulator({curDeviceId: 'ABCD1234'}, {}).should.be.false;
    });
  });
  describe('prepareEmulator', function () {
    beforeEach(function () {
      const opts = {avd: 'foo@bar', avdArgs: '', language: 'en', locale: 'us'};
      driver.opts = opts;
    });
    this.afterEach(function () {
      sandbox.verify();
    });

    it('should not launch avd if one is already running', async function () {
      sandbox.stub(driver.adb, 'getRunningAVDWithRetry').withArgs('foobar').returns('foo');
      sandbox.stub(driver.adb, 'launchAVD').never();
      sandbox.stub(driver.adb, 'killEmulator').never();
      await prepareEmulator.bind(driver)();
    });
    it('should launch avd if one is not running', async function () {
      sandbox.stub(driver.adb, 'getRunningAVDWithRetry').withArgs('foobar').throws();
      sandbox.stub(driver.adb, 'launchAVD')
        .withExactArgs('foo@bar', {
          args: [],
          env: undefined,
          language: 'en',
          country: 'us',
          launchTimeout: undefined,
          readyTimeout: undefined,
        })
        .returns('');
      await prepareEmulator.bind(driver)();
    });
    it('should parse avd string command line args', async function () {
      const opts = {
        avd: 'foobar',
        avdArgs: '--arg1 "value 1" --arg2 "value 2"',
        avdEnv: {
          k1: 'v1',
          k2: 'v2',
        },
      };
      driver.opts = opts;
      sandbox.stub(driver.adb, 'getRunningAVDWithRetry').withArgs('foobar').throws();
      sandbox.stub(driver.adb, 'launchAVD')
        .withExactArgs('foobar', {
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
      await prepareEmulator.bind(driver)();
    });
    it('should parse avd array command line args', async function () {
      const opts = {
        avd: 'foobar',
        avdArgs: ['--arg1', 'value 1', '--arg2', 'value 2'],
      };
      driver.opts = opts;
      sandbox.stub(driver.adb, 'getRunningAVDWithRetry').withArgs('foobar').throws();
      sandbox.stub(driver.adb, 'launchAVD')
        .withExactArgs('foobar', {
          args: ['--arg1', 'value 1', '--arg2', 'value 2'],
          env: undefined,
          language: undefined,
          country: undefined,
          launchTimeout: undefined,
          readyTimeout: undefined,
        })
        .returns('');
      await prepareEmulator.bind(driver)();
    });
    it('should kill emulator if avdArgs contains -wipe-data', async function () {
      const opts = {avd: 'foo@bar', avdArgs: '-wipe-data'};
      driver.opts = opts;
      sandbox.stub(driver.adb, 'getRunningAVDWithRetry').withArgs('foobar').returns('foo');
      sandbox.stub(driver.adb, 'killEmulator').withExactArgs('foobar').once();
      sandbox.stub(driver.adb, 'launchAVD').once();
      await prepareEmulator.bind(driver)();
    });
    it('should fail if avd name is not specified', async function () {
      driver.opts = {};
      await prepareEmulator.bind(driver)().should.eventually.be.rejected;
    });
  });
  describe('prepareAvdArgs', function () {
    it('should set the correct avdArgs', function () {
      let avdArgs = '-wipe-data';
      prepareAvdArgs.bind(driver)({avdArgs}).should.eql([avdArgs]);
    });
    it('should add headless arg', function () {
      let avdArgs = '-wipe-data';
      let args = prepareAvdArgs.bind(driver)({isHeadless: true, avdArgs});
      args.should.eql(['-wipe-data', '-no-window']);
    });
    it('should add network speed arg', function () {
      let avdArgs = '-wipe-data';
      let args = prepareAvdArgs.bind(driver)({networkSpeed: 'edge', avdArgs});
      args.should.eql(['-wipe-data', '-netspeed', 'edge']);
    });
    it('should not include empty avdArgs', function () {
      let avdArgs = '';
      let args = prepareAvdArgs.bind(driver)({isHeadless: true, avdArgs});
      args.should.eql(['-no-window']);
    });
  });

  describe('getDeviceInfoFromCaps', function () {
    // list of device/emu udids to their os versions
    // using list instead of map to preserve order
    let devices = [
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
      ADB.createADB.restore();
    });

    it('should throw error when udid not in list', async function () {
      const driver = new AndroidDriver();
      driver.opts = {
        udid: 'foomulator',
      };

      await driver.getDeviceInfoFromCaps().should.be.rejectedWith('foomulator');
    });
    it('should get deviceId and emPort when udid is present', async function () {
      const driver = new AndroidDriver();
      driver.opts = {
        udid: 'emulator-1234',
      };

      let {udid, emPort} = await driver.getDeviceInfoFromCaps();
      udid.should.equal('emulator-1234');
      emPort.should.equal(1234);
    });
    it('should get first deviceId and emPort if avd, platformVersion, and udid are not given', async function () {
      const driver = new AndroidDriver();
      let {udid, emPort} = await driver.getDeviceInfoFromCaps();
      udid.should.equal('emulator-1234');
      emPort.should.equal(1234);
    });
    it('should get deviceId and emPort when avd is present', async function () {
      const driver = new AndroidDriver();
      driver.opts = {
        avd: 'AVD_NAME',
      };
      let {udid, emPort} = await driver.getDeviceInfoFromCaps();
      udid.should.equal('emulator-1234');
      emPort.should.equal(1234);
    });
    it('should fail if the given platformVersion is not found', async function () {
      const driver = new AndroidDriver();
      driver.opts = {
        platformVersion: '1234567890',
      };
      await driver
        .getDeviceInfoFromCaps()
        .should.be.rejectedWith('Unable to find an active device or emulator with OS 1234567890');
    });
    it('should get deviceId and emPort if platformVersion is found and unique', async function () {
      const driver = new AndroidDriver();
      driver.opts = {
        platformVersion: '6.0',
      };
      let {udid, emPort} = await driver.getDeviceInfoFromCaps();
      udid.should.equal('roamulet-9000');
      emPort.should.equal(1234);
    });
    it('should get deviceId and emPort if platformVersion is shorter than os version', async function () {
      const driver = new AndroidDriver();
      driver.opts = {
        platformVersion: 9,
      };
      let {udid, emPort} = await driver.getDeviceInfoFromCaps();
      udid.should.equal('roamulet-2019');
      emPort.should.equal(1234);
    });
    it('should get the first deviceId and emPort if platformVersion is found multiple times', async function () {
      const driver = new AndroidDriver();
      driver.opts = {
        platformVersion: '5.0.1',
      };
      let {udid, emPort} = await driver.getDeviceInfoFromCaps();
      udid.should.equal('rotalume-1338');
      emPort.should.equal(1234);
    });
    it('should get the deviceId and emPort of most recent version if we have partial match', async function () {
      const driver = new AndroidDriver();
      driver.opts = {
        platformVersion: '5.0',
      };
      let {udid, emPort} = await driver.getDeviceInfoFromCaps();
      udid.should.equal('rotalume-1338');
      emPort.should.equal(1234);
    });
    it('should get deviceId and emPort by udid if udid and platformVersion are given', async function () {
      const driver = new AndroidDriver();
      driver.opts = {
        udid: '0123456789',
        platformVersion: '2.3',
      };
      let {udid, emPort} = await driver.getDeviceInfoFromCaps();
      udid.should.equal('0123456789');
      emPort.should.equal(1234);
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
      ADB.createADB.restore();
    });
    it('should create adb and set device id and emulator port', async function () {
      await driver.createADB({
        udid: '111222',
        emPort: '111',
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
      });
      ADB.createADB.calledWithExactly({
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
      }).should.be.true;
      curDeviceId.should.equal('111222');
      emulatorPort.should.equal('111');
    });
    it('should not set emulator port if emPort is undefined', async function () {
      emulatorPort = 5555;
      await driver.createADB();
      emulatorPort.should.equal(5555);
    });
  });
  describe('initDevice', function () {
    it('should init a real device', async function () {
      const driver = new AndroidDriver();
      driver.opts = {language: 'en', locale: 'us', localeScript: 'Script'};
      sandbox.stub(driver.adb, 'waitForDevice').never();
      sandbox.stub(driver.adb, 'startLogcat').once();
      sandbox.stub(deviceUtils, 'pushSettingsApp').once();
      sandbox.stub(driver, 'ensureDeviceLocale')
        .withExactArgs(driver.opts.language, driver.opts.locale, driver.opts.localeScript)
        .once();
      sandbox.stub(geolocationHelpers, 'setMockLocationApp').withExactArgs('io.appium.settings').once();
      await driver.initDevice();
    });
    it('should init device without locale and language', async function () {
      const driver = new AndroidDriver();
      driver.opts = {};
      sandbox.stub(driver.adb, 'waitForDevice').never();
      sandbox.stub(driver.adb, 'startLogcat').once();
      sandbox.stub(deviceUtils, 'pushSettingsApp').once();
      sandbox.stub(driver, 'ensureDeviceLocale').never();
      sandbox.stub(geolocationHelpers, 'setMockLocationApp').withExactArgs('io.appium.settings').once();
      await driver.initDevice();
    });
    it('should init device with either locale or language', async function () {
      const driver = new AndroidDriver();
      driver.opts = {language: 'en'};
      sandbox.stub(driver.adb, 'waitForDevice').never();
      sandbox.stub(driver.adb, 'startLogcat').once();
      sandbox.stub(deviceUtils, 'pushSettingsApp').once();
      sandbox.stub(driver, 'ensureDeviceLocale')
        .withExactArgs(driver.opts.language, driver.opts.locale, driver.opts.localeScript)
        .once();
      sandbox.stub(geolocationHelpers, 'setMockLocationApp').withExactArgs('io.appium.settings').once();
      await driver.initDevice();
    });
    it('should not install mock location on emulator', async function () {
      const driver = new AndroidDriver();
      driver.opts = {avd: 'avd'};
      sandbox.stub(driver.adb, 'waitForDevice').once();
      sandbox.stub(driver.adb, 'startLogcat').once();
      sandbox.stub(deviceUtils, 'pushSettingsApp').once();
      sandbox.stub(driver, 'ensureDeviceLocale').never();
      sandbox.stub(geolocationHelpers, 'setMockLocationApp').never();
      await driver.initDevice();
    });
    it('should set empty IME if hideKeyboard is set to true', async function () {
      const driver = new AndroidDriver();
      driver.opts = {hideKeyboard: true};
      sandbox.stub(driver.adb, 'waitForDevice').never();
      sandbox.stub(driver.adb, 'startLogcat').once();
      sandbox.stub(deviceUtils, 'pushSettingsApp').once();
      sandbox.stub(driver, 'ensureDeviceLocale').never();
      sandbox.stub(geolocationHelpers, 'setMockLocationApp').once();
      sandbox.stub(driver, 'hideKeyboard').once();
      await driver.initDevice();
    });
    it('should init device without starting logcat', async function () {
      const driver = new AndroidDriver();
      driver.opts = {skipLogcatCapture: true};
      sandbox.stub(driver.adb, 'waitForDevice').never();
      sandbox.stub(driver.adb, 'startLogcat').never();
      sandbox.stub(deviceUtils, 'pushSettingsApp').once();
      sandbox.stub(driver, 'ensureDeviceLocale').never();
      sandbox.stub(geolocationHelpers, 'setMockLocationApp').withExactArgs('io.appium.settings').once();
      await driver.initDevice();
    });
  });

});
