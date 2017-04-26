import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import helpers from '../../lib/android-helpers';
import ADB from 'appium-adb';
import { withMocks } from 'appium-test-support';
import * as teen_process from 'teen_process';
import { fs } from 'appium-support';
import { path as unlockApkPath } from 'appium-unlock';
import unlocker from '../../lib/unlock-helpers';
import _ from 'lodash';

const should = chai.should();
const REMOTE_TEMP_PATH = "/data/local/tmp";
chai.use(chaiAsPromised);

describe('Android Helpers', () => {
  let adb = new ADB();

  describe('parseJavaVersion', () => {
    it('should correctly parse java version', () => {
      helpers.parseJavaVersion(`java version "1.8.0_40"
        Java(TM) SE Runtime Environment (build 1.8.0_40-b27)`).should
        .be.equal("1.8.0_40");
    });
    it('should return null if it cannot parse java verstion', () => {
      should.not.exist(helpers.parseJavaVersion('foo bar'));
    });
    it('should parse OpenJDK versioning', function () {
      helpers.parseJavaVersion('openjdk version 1.8').should.be.equal('1.8');
    });
  });

  describe('getJavaVersion', withMocks({teen_process}, (mocks) => {
    it('should correctly get java version', async () => {
      mocks.teen_process.expects('exec').withExactArgs('java', ['-version'])
        .returns({stderr: 'java version "1.8.0_40"'});
      (await helpers.getJavaVersion()).should.equal('1.8.0_40');
      mocks.teen_process.verify();
    });
    it('should return null if it cannot parse java verstion', async () => {
      mocks.teen_process.expects('exec').withExactArgs('java', ['-version'])
        .returns({stderr: 'foo bar'});
      await helpers.getJavaVersion().should.eventually.be.rejectedWith('Java');
      mocks.teen_process.verify();
    });
  }));
  describe('prepareEmulator', withMocks({adb}, (mocks) => {
    const opts = {avd: "foo@bar", avdArgs: "", language: "en", locale: "us"};
    it('should not launch avd if one is already running', async () => {
      mocks.adb.expects('getRunningAVD').withExactArgs('foobar')
        .returns("foo");
      await helpers.prepareEmulator(adb, opts);
      mocks.adb.verify();
    });
    it('should launch avd if one is already running', async () => {
      mocks.adb.expects('getRunningAVD').withExactArgs('foobar')
        .returns(null);
      mocks.adb.expects('launchAVD').withExactArgs('foo@bar', '', 'en', 'us',
        undefined, undefined)
        .returns("");
      await helpers.prepareEmulator(adb, opts);
      mocks.adb.verify();
    });
  }));
  describe('ensureDeviceLocale', withMocks({adb}, (mocks) => {
    it('should return if language and country are not passed', async () => {
      mocks.adb.expects('getDeviceLanguage').never();
      mocks.adb.expects('getDeviceCountry').never();
      mocks.adb.expects('getDeviceLocale').never();
      mocks.adb.expects('setDeviceLanguage').never();
      mocks.adb.expects('setDeviceCountry').never();
      mocks.adb.expects('setDeviceLocale').never();
      mocks.adb.expects('reboot').never();
      await helpers.ensureDeviceLocale(adb);
      mocks.adb.verify();
    });
    it('should not set language and country if it does not change when API < 23', async () => {
      mocks.adb.expects('getApiLevel').returns("18");
      mocks.adb.expects('getDeviceLanguage').returns('en');
      mocks.adb.expects('getDeviceCountry').returns('us');
      mocks.adb.expects('getDeviceLocale').never();
      mocks.adb.expects('setDeviceLanguage').never();
      mocks.adb.expects('setDeviceCountry').never();
      mocks.adb.expects('setDeviceLocale').never();
      mocks.adb.expects('reboot').never();
      await helpers.ensureDeviceLocale(adb, 'en', 'us');
      mocks.adb.verify();
    });
    it('should set language and country if they are different when API < 23', async () => {
      mocks.adb.expects('getApiLevel').returns("18");
      mocks.adb.expects('getDeviceLanguage').returns('fr');
      mocks.adb.expects('getDeviceCountry').returns('FR');
      mocks.adb.expects('getDeviceLocale').never();
      mocks.adb.expects('setDeviceLanguage').withExactArgs('en')
        .returns("");
      mocks.adb.expects('setDeviceCountry').withExactArgs('us')
        .returns("");
      mocks.adb.expects('setDeviceLocale').never();
      mocks.adb.expects('reboot').returns(null);
      await helpers.ensureDeviceLocale(adb, 'en', 'us');
      mocks.adb.verify();
    });
    it('should not set locale if it does not change when API = 23', async () => {
      mocks.adb.expects('getApiLevel').returns("23");
      mocks.adb.expects('getDeviceLanguage').never();
      mocks.adb.expects('getDeviceCountry').never();
      mocks.adb.expects('getDeviceLocale').returns('en-US');
      mocks.adb.expects('setDeviceLanguage').never();
      mocks.adb.expects('setDeviceCountry').never();
      mocks.adb.expects('setDeviceLocale').never();
      mocks.adb.expects('reboot').never();
      await helpers.ensureDeviceLocale(adb, 'en', 'us');
      mocks.adb.verify();
    });
    it('should set locale if it is different when API = 23', async () => {
      mocks.adb.expects('getApiLevel').returns("23");
      mocks.adb.expects('getDeviceLanguage').never();
      mocks.adb.expects('getDeviceCountry').never();
      mocks.adb.expects('getDeviceLocale').returns('fr-FR');
      mocks.adb.expects('setDeviceLanguage').never();
      mocks.adb.expects('setDeviceCountry').never();
      mocks.adb.expects('setDeviceLocale').withExactArgs('en-US')
        .returns("");
      mocks.adb.expects('reboot').returns(null);
      await helpers.ensureDeviceLocale(adb, 'en', 'us');
      mocks.adb.verify();
    });
  }));

  describe('getDeviceInfoFromCaps', () => {
    // list of device/emu udids to their os versions
    // using list instead of map to preserve order
    let devices = [
      {udid: 'emulator-1234', os: '4.9.2'},
      {udid: 'rotalume-1339', os: '5.1.5'},
      {udid: 'rotalume-1338', os: '5.0.1'},
      {udid: 'rotalume-1337', os: '5.0.1'},
      {udid: 'roamulet-9000', os: '6.0'},
      {udid: 'roamulet-0', os: '2.3'},
      {udid: '0123456789', os: 'wellhellothere'}
    ];
    let curDeviceId = '';

    before(() => {
      sinon.stub(ADB, 'createADB', async () => {
        return {
          getDevicesWithRetry: async () => {
            return _.map(devices, (device) => { return {udid: device.udid}; });
          },
          getPortFromEmulatorString: () => {
            return 1234;
          },
          getRunningAVD: () => {
            return {'udid': 'emulator-1234', 'port': 1234};
          },
          setDeviceId: (udid) => {
            curDeviceId = udid;
          },
          getPlatformVersion: () => {
            return _.filter(devices, {udid: curDeviceId})[0].os;
          },
          curDeviceId: 'emulator-1234',
          emulatorPort: 1234
        };
      });
    });

    after(() => {
      ADB.createADB.restore();
    });

    it('should throw error when udid not in list', async () => {
      let caps = {
        udid: 'foomulator'
      };

      await helpers.getDeviceInfoFromCaps(caps).should.be.rejectedWith('foomulator');
    });
    it('should get deviceId and emPort when udid is present', async () => {
      let caps = {
        udid: 'emulator-1234'
      };

      let {udid, emPort} = await helpers.getDeviceInfoFromCaps(caps);
      udid.should.equal('emulator-1234');
      emPort.should.equal(1234);
    });
    it('should get first deviceId and emPort if avd, platformVersion, and udid aren\'t given', async () => {
      let {udid, emPort} = await helpers.getDeviceInfoFromCaps();
      udid.should.equal('emulator-1234');
      emPort.should.equal(1234);
    });
    it('should get deviceId and emPort when avd is present', async () => {
      let caps = {
        avd: 'AVD_NAME'
      };
      let {udid, emPort} = await helpers.getDeviceInfoFromCaps(caps);
      udid.should.equal('emulator-1234');
      emPort.should.equal(1234);
    });
    it('should fail if the given platformVersion is not found', async () => {
      let caps = {
        platformVersion: '1234567890'
      };
      await helpers.getDeviceInfoFromCaps(caps)
        .should.be.rejectedWith('Unable to find an active device or emulator with OS 1234567890');
    });
    it('should get deviceId and emPort if platformVersion is found and unique', async () => {
      let caps = {
        platformVersion: '6.0'
      };
      let {udid, emPort} = await helpers.getDeviceInfoFromCaps(caps);
      udid.should.equal('roamulet-9000');
      emPort.should.equal(1234);
    });
    it('should get the first deviceId and emPort if platformVersion is found multiple times', async () => {
      let caps = {
        platformVersion: '5.0.1'
      };
      let {udid, emPort} = await helpers.getDeviceInfoFromCaps(caps);
      udid.should.equal('rotalume-1338');
      emPort.should.equal(1234);
    });
    it('should get the first deviceId and emPort if platformVersion is found multiple times and is a partial match', async () => {
      let caps = {
        platformVersion: '5.0'
      };
      let {udid, emPort} = await helpers.getDeviceInfoFromCaps(caps);
      udid.should.equal('rotalume-1338');
      emPort.should.equal(1234);
    });
    it('should get deviceId and emPort by udid if udid and platformVersion are given', async () => {
      let caps = {
        udid: '0123456789',
        platformVersion: '2.3'
      };
      let {udid, emPort} = await helpers.getDeviceInfoFromCaps(caps);
      udid.should.equal('0123456789');
      emPort.should.equal(1234);
    });
  });

  describe('getLaunchInfoFromManifest', withMocks({adb}, (mocks) => {
    it('should return when no app present', async () => {
      mocks.adb.expects('packageAndLaunchActivityFromManifest').never();
      await helpers.getLaunchInfo(adb, {});
      mocks.adb.verify();
    });
    it('should return when appPackage & appActivity are already present', async () => {
      mocks.adb.expects('packageAndLaunchActivityFromManifest').never();
      await helpers.getLaunchInfo(adb, {app: "foo", appPackage: "bar",
        appActivity: "act"});
      mocks.adb.verify();
    });
    it('should return package and launch activity from manifest', async () => {
      mocks.adb.expects('packageAndLaunchActivityFromManifest').withExactArgs('foo')
        .returns({apkPackage: 'pkg', apkActivity: 'ack'});
      const result = { appPackage: 'pkg', appWaitPackage: 'pkg',
                       appActivity: 'ack', appWaitActivity: 'ack' };
      (await helpers.getLaunchInfo(adb, {app: "foo"})).should.deep
        .equal(result);
      mocks.adb.verify();
    });
  }));
  describe('getRemoteApkPath', () => {
    it('should return remote path', () => {
      helpers.getRemoteApkPath('foo').should.equal(`${REMOTE_TEMP_PATH}/foo.apk`);
    });
    it('should return custom install path', () => {
      helpers.getRemoteApkPath('foo', '/sdcard/Download/').should.equal(`/sdcard/Download/foo.apk`);
    });
  });
  describe('resetApp', withMocks({adb, fs, helpers}, (mocks) => {
    const localApkPath = 'local';
    const pkg = 'pkg';
    const androidInstallTimeout = 90000;
    it('should throw error if remote file does not exist', async () => {
      mocks.fs.expects('md5').withExactArgs(localApkPath).returns('apkmd5');
      mocks.adb.expects('fileExists').returns(false);
      mocks.helpers.expects('reinstallRemoteApk').never();
      await helpers.resetApp(adb, localApkPath, pkg, false, androidInstallTimeout).should.eventually
        .be.rejectedWith('slow');
      mocks.adb.verify();
      mocks.fs.verify();
      mocks.helpers.verify();
    });
    it('should throw error if remote file does not exist', async () => {
      mocks.fs.expects('md5').withExactArgs(localApkPath).returns('apkmd5');
      mocks.adb.expects('fileExists').returns(true);
      mocks.helpers.expects('reinstallRemoteApk').once().returns('');
      await helpers.resetApp(adb, localApkPath, pkg, false, androidInstallTimeout);
      mocks.adb.verify();
      mocks.fs.verify();
      mocks.helpers.verify();
    });
  }));

  describe('reinstallRemoteApk', withMocks({adb, helpers}, (mocks) => {
    const localApkPath = 'local';
    const pkg = 'pkg';
    const remotePath = 'remote';
    const androidInstallTimeout = 90000;
    it('should throw error if remote file does not exist', async () => {
      mocks.adb.expects('uninstallApk').withExactArgs(pkg).returns('');
      // install remote is not defines do we mean installApkRemotely?
      mocks.adb.expects('installFromDevicePath').withExactArgs(remotePath, {timeout: 90000})
        .throws('');
      mocks.helpers.expects('removeRemoteApks').withExactArgs(adb);

      await helpers.reinstallRemoteApk(adb, localApkPath, pkg, remotePath, androidInstallTimeout, 1)
        .should.eventually.be.rejected;
      mocks.adb.verify();
      mocks.helpers.verify();
    });
  }));
  describe('installApkRemotely', withMocks({adb, fs, helpers}, (mocks) => {
    //use mock appium capabilities for this test
    const opts = {
      app : 'local',
      appPackage : 'pkg',
      fastReset : true,
      androidInstallTimeout : 90000
    };
    it('should complain if opts arent passed correctly', async () => {
      await helpers.installApkRemotely(adb, {})
              .should.eventually.be.rejectedWith(/app.+appPackage/);
    });
    it('should reset app if already installed', async () => {
      mocks.fs.expects('md5').withExactArgs(opts.app).returns('apkmd5');
      mocks.helpers.expects('getRemoteApkPath').returns(false);
      mocks.adb.expects('fileExists').returns(true);
      mocks.adb.expects('isAppInstalled').returns(true);
      mocks.helpers.expects('resetApp').once().returns("");
      await helpers.installApkRemotely(adb, opts);
      mocks.adb.verify();
      mocks.fs.verify();
      mocks.helpers.verify();
    });
    it('should push and reinstall apk when apk is not installed', async () => {
      mocks.fs.expects('md5').withExactArgs(opts.app).returns('apkmd5');
      mocks.helpers.expects('getRemoteApkPath').returns(true);
      mocks.adb.expects('fileExists').returns(true);
      mocks.adb.expects('isAppInstalled').returns(false);
      mocks.adb.expects('mkdir').once().returns("");
      mocks.helpers.expects('removeRemoteApks').once().returns('');
      mocks.helpers.expects('reinstallRemoteApk').once().returns("");

      await helpers.installApkRemotely(adb, opts);

      mocks.adb.verify();
      mocks.fs.verify();
      mocks.helpers.verify();
    });
  }));
  describe('removeRemoteApks', withMocks({adb}, (mocks) => {
    it('should return when no apks present', async () => {
      mocks.adb.expects('ls').returns([]);
      mocks.adb.expects('shell').never();
      await helpers.removeRemoteApks(adb);
      mocks.adb.verify();
    });
    it('should return when only exceptMd5s are present', async () => {
      mocks.adb.expects('ls').returns(['foo']);
      mocks.adb.expects('shell').never();
      await helpers.removeRemoteApks(adb, ['foo']);
      mocks.adb.verify();
    });
    it('should remove all remote apks', async () => {
      mocks.adb.expects('ls').returns(['foo']);
      mocks.adb.expects('shell').once().returns('');
      await helpers.removeRemoteApks(adb, ['bar']);
      mocks.adb.verify();
    });
  }));
  describe('initUnicodeKeyboard', withMocks({adb}, (mocks) => {
    it('should install and enable unicodeIME', async () => {
      mocks.adb.expects('install').once().returns('');
      mocks.adb.expects('defaultIME').once().returns('defaultIME');
      mocks.adb.expects('enableIME').once().returns('');
      mocks.adb.expects('setIME').once().returns('');
      await helpers.initUnicodeKeyboard(adb);
      mocks.adb.verify();
    });
  }));
  describe('pushSettingsApp', withMocks({adb}, (mocks) => {
    it('should install settingsApp', async () => {
      mocks.adb.expects('installOrUpgrade').once()
        .returns(true);
      mocks.adb.expects('grantAllPermissions').withExactArgs('io.appium.settings').once()
        .returns(true);
      await helpers.pushSettingsApp(adb);
      mocks.adb.verify();
    });
  }));
  describe('setMockLocationApp', withMocks({adb}, (mocks) => {
    it('should enable mock location for api level below 23', async () => {
      mocks.adb.expects('getApiLevel').returns(Promise.resolve("18"));
      mocks.adb.expects('shell').withExactArgs(['settings', 'put', 'secure', 'mock_location', '1']).once()
        .returns('');
      await helpers.setMockLocationApp(adb, 'io.appium.settings');
      mocks.adb.verify();
    });
    it('should enable mock location for api level 23 and above', async () => {
      mocks.adb.expects('getApiLevel').returns(Promise.resolve("23"));
      mocks.adb.expects('shell').withExactArgs(['appops', 'set', 'io.appium.settings', 'android:mock_location', 'allow']).once()
        .returns('');
      await helpers.setMockLocationApp(adb, 'io.appium.settings');
      mocks.adb.verify();
    });
  }));
  describe('pushUnlock', withMocks({adb}, (mocks) => {
    it('should install unlockApp', async () => {
      mocks.adb.expects('install').withExactArgs(unlockApkPath, false).once()
        .returns('');
      await helpers.pushUnlock(adb);
      mocks.adb.verify();
    });
  }));
  describe('unlock', withMocks({adb, helpers, unlocker}, (mocks) => {
    it('should return if screen is already unlocked', async () => {
      mocks.adb.expects('isScreenLocked').withExactArgs().once()
        .returns(false);
      mocks.adb.expects('getApiLevel').never();
      mocks.adb.expects('startApp').never();
      await helpers.unlock(helpers, adb, {});
      mocks.adb.verify();
    });
    it('should start unlock app', async () => {
      mocks.adb.expects('isScreenLocked').onCall(0).returns(true);
      mocks.adb.expects('isScreenLocked').returns(false);
      mocks.adb.expects('forceStop').once().returns('');
      mocks.adb.expects('startApp').twice().returns('');
      await helpers.unlock(helpers, adb, {});
      mocks.adb.verify();
      mocks.helpers.verify();
    });
    it('should raise an error on undefined unlockKey when unlockType is defined', async () => {
      mocks.adb.expects('isScreenLocked').once().returns(true);
      mocks.unlocker.expects('isValidKey').once();
      await helpers.unlock(helpers, adb, {unlockType: "pin"}).should.be.rejectedWith('unlockKey');
      mocks.adb.verify();
      mocks.unlocker.verify();
      mocks.helpers.verify();
    });
    it('should call pinUnlock if unlockType is pin', async () => {
      mocks.adb.expects('isScreenLocked').onCall(0).returns(true);
      mocks.adb.expects('isScreenLocked').returns(false);
      mocks.unlocker.expects('pinUnlock').once();
      await helpers.unlock(helpers, adb, {unlockType: "pin", unlockKey: "1111"});
      mocks.adb.verify();
      mocks.helpers.verify();
    });
    it('should call passwordUnlock if unlockType is password', async () => {
      mocks.adb.expects('isScreenLocked').onCall(0).returns(true);
      mocks.adb.expects('isScreenLocked').returns(false);
      mocks.unlocker.expects('passwordUnlock').once();
      await helpers.unlock(helpers, adb, {unlockType: "password", unlockKey: "appium"});
      mocks.adb.verify();
      mocks.helpers.verify();
    });
    it('should call patternUnlock if unlockType is pattern', async () => {
      mocks.adb.expects('isScreenLocked').onCall(0).returns(true);
      mocks.adb.expects('isScreenLocked').returns(false);
      mocks.unlocker.expects('patternUnlock').once();
      await helpers.unlock(helpers, adb, {unlockType: "pattern", unlockKey: "123456789"});
      mocks.adb.verify();
      mocks.helpers.verify();
    });
    it('should call fingerprintUnlock if unlockType is fingerprint', async () => {
      mocks.adb.expects('isScreenLocked').onCall(0).returns(true);
      mocks.adb.expects('isScreenLocked').returns(false);
      mocks.unlocker.expects('fingerprintUnlock').once();
      await helpers.unlock(helpers, adb, {unlockType: "fingerprint", unlockKey: "1111"});
      mocks.adb.verify();
      mocks.unlocker.verify();
    });
    it('should throw an error is api is lower than 23 and trying to use fingerprintUnlock', async () => {
      mocks.adb.expects('isScreenLocked').onCall(0).returns(true);
      mocks.adb.expects('isScreenLocked').returns(false);
      mocks.adb.expects('getApiLevel').once().returns(21);
      await helpers.unlock(helpers, adb, {unlockType: "fingerprint", unlockKey: "1111"}).should.eventually
        .be.rejectedWith('Fingerprint');
      mocks.helpers.verify();
    });
  }));
  describe('removeNullProperties', () => {
    it('should ignore null properties', async () => {
      let test = {foo: null, bar: true};
      helpers.removeNullProperties(test);
      _.keys(test).length.should.equal(1);
    });
    it('should ignore undefined properties', async () => {
      let test = {foo: undefined, bar: true};
      helpers.removeNullProperties(test);
      _.keys(test).length.should.equal(1);
    });
    it('should not ignore falsy properties like 0 and false', async () => {
      let test = {foo: false, bar: true, zero: 0};
      helpers.removeNullProperties(test);
      _.keys(test).length.should.equal(3);
    });
  });
});
