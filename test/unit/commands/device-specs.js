import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import ADB from 'appium-adb';
import {withMocks} from '@appium/test-support';
import _ from 'lodash';
import { AndroidDriver } from '../../../lib/driver';
import { prepareAvdArgs, prepareEmulator } from '../../../lib/commands/device/utils';

const should = chai.should();
chai.use(chaiAsPromised);

describe('Device Helpers', function () {
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
      let caps = {
        udid: 'foomulator',
      };

      await helpers.getDeviceInfoFromCaps(caps).should.be.rejectedWith('foomulator');
    });
    it('should get deviceId and emPort when udid is present', async function () {
      let caps = {
        udid: 'emulator-1234',
      };

      let {udid, emPort} = await helpers.getDeviceInfoFromCaps(caps);
      udid.should.equal('emulator-1234');
      emPort.should.equal(1234);
    });
    it('should get first deviceId and emPort if avd, platformVersion, and udid are not given', async function () {
      let {udid, emPort} = await helpers.getDeviceInfoFromCaps();
      udid.should.equal('emulator-1234');
      emPort.should.equal(1234);
    });
    it('should get deviceId and emPort when avd is present', async function () {
      let caps = {
        avd: 'AVD_NAME',
      };
      let {udid, emPort} = await helpers.getDeviceInfoFromCaps(caps);
      udid.should.equal('emulator-1234');
      emPort.should.equal(1234);
    });
    it('should fail if the given platformVersion is not found', async function () {
      let caps = {
        platformVersion: '1234567890',
      };
      await helpers
        .getDeviceInfoFromCaps(caps)
        .should.be.rejectedWith('Unable to find an active device or emulator with OS 1234567890');
    });
    it('should get deviceId and emPort if platformVersion is found and unique', async function () {
      let caps = {
        platformVersion: '6.0',
      };
      let {udid, emPort} = await helpers.getDeviceInfoFromCaps(caps);
      udid.should.equal('roamulet-9000');
      emPort.should.equal(1234);
    });
    it('should get deviceId and emPort if platformVersion is shorter than os version', async function () {
      let caps = {
        platformVersion: 9,
      };
      let {udid, emPort} = await helpers.getDeviceInfoFromCaps(caps);
      udid.should.equal('roamulet-2019');
      emPort.should.equal(1234);
    });
    it('should get the first deviceId and emPort if platformVersion is found multiple times', async function () {
      let caps = {
        platformVersion: '5.0.1',
      };
      let {udid, emPort} = await helpers.getDeviceInfoFromCaps(caps);
      udid.should.equal('rotalume-1338');
      emPort.should.equal(1234);
    });
    it('should get the deviceId and emPort of most recent version if we have partial match', async function () {
      let caps = {
        platformVersion: '5.0',
      };
      let {udid, emPort} = await helpers.getDeviceInfoFromCaps(caps);
      udid.should.equal('rotalume-1338');
      emPort.should.equal(1234);
    });
    it('should get deviceId and emPort by udid if udid and platformVersion are given', async function () {
      let caps = {
        udid: '0123456789',
        platformVersion: '2.3',
      };
      let {udid, emPort} = await helpers.getDeviceInfoFromCaps(caps);
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
      await helpers.createADB({
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
      await helpers.createADB();
      emulatorPort.should.equal(5555);
    });
  });
  describe(
    'getLaunchInfoFromManifest',
    withMocks({adb}, (mocks) => {
      it('should return when no app present', async function () {
        mocks.adb.expects('packageAndLaunchActivityFromManifest').never();
        await helpers.getLaunchInfo(adb, {});
        mocks.adb.verify();
      });
      it('should return when appPackage & appActivity are already present', async function () {
        mocks.adb.expects('packageAndLaunchActivityFromManifest').never();
        await helpers.getLaunchInfo(adb, {
          app: 'foo',
          appPackage: 'bar',
          appActivity: 'act',
        });
        mocks.adb.verify();
      });
      it('should return when all parameters are already present', async function () {
        mocks.adb.expects('packageAndLaunchActivityFromManifest').never();
        await helpers.getLaunchInfo(adb, {
          app: 'foo',
          appPackage: 'bar',
          appWaitPackage: '*',
          appActivity: 'app.activity',
          appWaitActivity: 'app.nameA,app.nameB',
        });
        mocks.adb.verify();
      });
      it('should print warn when all parameters are already present but the format is odd', async function () {
        // It only prints warn message
        mocks.adb.expects('packageAndLaunchActivityFromManifest').never();
        await helpers.getLaunchInfo(adb, {
          app: 'foo',
          appPackage: 'bar ',
          appWaitPackage: '*',
          appActivity: 'a_act',
          appWaitActivity: '. ',
        });
        mocks.adb.verify();
      });
      it('should print warn when appPackage & appActivity are already present but the format is odd', async function () {
        // It only prints warn message
        mocks.adb.expects('packageAndLaunchActivityFromManifest').never();
        await helpers.getLaunchInfo(adb, {app: 'foo', appPackage: 'bar', appActivity: 'a_act '});
        mocks.adb.verify();
      });
      it('should return package and launch activity from manifest', async function () {
        mocks.adb
          .expects('packageAndLaunchActivityFromManifest')
          .withExactArgs('foo')
          .returns({apkPackage: 'pkg', apkActivity: 'ack'});
        const result = {
          appPackage: 'pkg',
          appWaitPackage: 'pkg',
          appActivity: 'ack',
          appWaitActivity: 'ack',
        };
        (await helpers.getLaunchInfo(adb, {app: 'foo'})).should.deep.equal(result);
        mocks.adb.verify();
      });
      it(
        'should not override appPackage, appWaitPackage, appActivity, appWaitActivity ' +
          'from manifest if they are allready defined in opts',
        async function () {
          let optsFromManifest = {apkPackage: 'mpkg', apkActivity: 'mack'};
          mocks.adb
            .expects('packageAndLaunchActivityFromManifest')
            .withExactArgs('foo')
            .twice()
            .returns(optsFromManifest);

          let inOpts = {
            app: 'foo',
            appActivity: 'ack',
            appWaitPackage: 'wpkg',
            appWaitActivity: 'wack',
          };
          let outOpts = {
            appPackage: 'mpkg',
            appActivity: 'ack',
            appWaitPackage: 'wpkg',
            appWaitActivity: 'wack',
          };
          (await helpers.getLaunchInfo(adb, inOpts)).should.deep.equal(outOpts);

          inOpts = {app: 'foo', appPackage: 'pkg', appWaitPackage: 'wpkg', appWaitActivity: 'wack'};
          outOpts = {
            appPackage: 'pkg',
            appActivity: 'mack',
            appWaitPackage: 'wpkg',
            appWaitActivity: 'wack',
          };
          (await helpers.getLaunchInfo(adb, inOpts)).should.deep.equal(outOpts);
          mocks.adb.verify();
        }
      );
    })
  );

  describe(
    'initDevice',
    withMocks({helpers, adb}, (mocks) => {
      it('should init a real device', async function () {
        const opts = {language: 'en', locale: 'us', localeScript: 'Script'};
        mocks.adb.expects('waitForDevice').never();
        mocks.adb.expects('startLogcat').once();
        mocks.helpers.expects('pushSettingsApp').once();
        mocks.helpers
          .expects('ensureDeviceLocale')
          .withExactArgs(adb, opts.language, opts.locale, opts.localeScript)
          .once();
        mocks.helpers.expects('setMockLocationApp').withExactArgs(adb, 'io.appium.settings').once();
        await helpers.initDevice(adb, opts);
        mocks.helpers.verify();
        mocks.adb.verify();
      });
      it('should init device without locale and language', async function () {
        const opts = {};
        mocks.adb.expects('waitForDevice').never();
        mocks.adb.expects('startLogcat').once();
        mocks.helpers.expects('pushSettingsApp').once();
        mocks.helpers.expects('ensureDeviceLocale').never();
        mocks.helpers.expects('setMockLocationApp').withExactArgs(adb, 'io.appium.settings').once();
        await helpers.initDevice(adb, opts);
        mocks.helpers.verify();
        mocks.adb.verify();
      });
      it('should init device with either locale or language', async function () {
        const opts = {language: 'en'};
        mocks.adb.expects('waitForDevice').never();
        mocks.adb.expects('startLogcat').once();
        mocks.helpers.expects('pushSettingsApp').once();
        mocks.helpers
          .expects('ensureDeviceLocale')
          .withExactArgs(adb, opts.language, opts.locale, opts.localeScript)
          .once();
        mocks.helpers.expects('setMockLocationApp').withExactArgs(adb, 'io.appium.settings').once();
        await helpers.initDevice(adb, opts);
        mocks.helpers.verify();
        mocks.adb.verify();
      });
      it('should not install mock location on emulator', async function () {
        const opts = {avd: 'avd'};
        mocks.adb.expects('waitForDevice').once();
        mocks.adb.expects('startLogcat').once();
        mocks.helpers.expects('pushSettingsApp').once();
        mocks.helpers.expects('ensureDeviceLocale').never();
        mocks.helpers.expects('setMockLocationApp').never();
        await helpers.initDevice(adb, opts);
        mocks.helpers.verify();
        mocks.adb.verify();
      });
      it('should set empty IME if hideKeyboard is set to true', async function () {
        const opts = {hideKeyboard: true};
        mocks.adb.expects('waitForDevice').never();
        mocks.adb.expects('startLogcat').once();
        mocks.helpers.expects('pushSettingsApp').once();
        mocks.helpers.expects('ensureDeviceLocale').never();
        mocks.helpers.expects('setMockLocationApp').once();
        mocks.helpers
          .expects('hideKeyboard')
          .withExactArgs(adb)
          .once();
        await helpers.initDevice(adb, opts);
        mocks.helpers.verify();
        mocks.adb.verify();
      });
      it('should return defaultIME if unicodeKeyboard is set to true', async function () {
        const opts = {unicodeKeyboard: true};
        mocks.adb.expects('waitForDevice').never();
        mocks.adb.expects('startLogcat').once();
        mocks.helpers.expects('pushSettingsApp').once();
        mocks.helpers.expects('ensureDeviceLocale').never();
        mocks.helpers.expects('setMockLocationApp').once();
        mocks.helpers
          .expects('initUnicodeKeyboard')
          .withExactArgs(adb)
          .once()
          .returns('defaultIME');
        await helpers.initDevice(adb, opts).should.become('defaultIME');
        mocks.helpers.verify();
        mocks.adb.verify();
      });
      it('should return undefined if unicodeKeyboard is set to false', async function () {
        const opts = {unicodeKeyboard: false};
        mocks.adb.expects('waitForDevice').never();
        mocks.adb.expects('startLogcat').once();
        mocks.helpers.expects('pushSettingsApp').once();
        mocks.helpers.expects('ensureDeviceLocale').never();
        mocks.helpers.expects('setMockLocationApp').once();
        mocks.helpers.expects('initUnicodeKeyboard').never();
        should.not.exist(await helpers.initDevice(adb, opts));
        mocks.helpers.verify();
        mocks.adb.verify();
      });
      it('should not push unlock app if unlockType is defined', async function () {
        const opts = {unlockType: 'unlock_type'};
        mocks.adb.expects('waitForDevice').never();
        mocks.adb.expects('startLogcat').once();
        mocks.helpers.expects('pushSettingsApp').once();
        mocks.helpers.expects('ensureDeviceLocale').never();
        mocks.helpers.expects('setMockLocationApp').once();
        mocks.helpers.expects('initUnicodeKeyboard').never();
        await helpers.initDevice(adb, opts);
        mocks.helpers.verify();
        mocks.adb.verify();
      });
      it('should init device without starting logcat', async function () {
        const opts = {skipLogcatCapture: true};
        mocks.adb.expects('waitForDevice').never();
        mocks.adb.expects('startLogcat').never();
        mocks.helpers.expects('pushSettingsApp').once();
        mocks.helpers.expects('ensureDeviceLocale').never();
        mocks.helpers.expects('setMockLocationApp').withExactArgs(adb, 'io.appium.settings').once();
        await helpers.initDevice(adb, opts);
        mocks.helpers.verify();
        mocks.adb.verify();
      });
    })
  );

});
