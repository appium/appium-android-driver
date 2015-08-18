// TODO these tests should be moved along with the implementation to the
// appium-android-driver package or wherever they should live
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import 'mochawait';
import helpers from '../../lib/android-helpers';
import ADB from 'appium-adb';
import { withMocks } from 'appium-test-support';
import * as teen_process from 'teen_process';
import path from 'path';
import { fs } from 'appium-support';
import { path as settingsApkPath } from 'io.appium.settings';
import { path as unlockApkPath } from 'appium-unlock';

const should = chai.should(),
      REMOTE_TEMP_PATH = "/data/local/tmp";
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
    it('should return if language and locale are not passed', async () => {
      mocks.adb.expects('getDeviceLanguage').never();
      mocks.adb.expects('getDeviceCountry').never();
      mocks.adb.expects('setDeviceLanguage').never();
      mocks.adb.expects('setDeviceCountry').never();
      mocks.adb.expects('reboot').never();
      await helpers.ensureDeviceLocale(adb);
      mocks.adb.verify();
    });
    it('should not set language and locale if it does not change', async () => {
      mocks.adb.expects('getDeviceLanguage').returns('en');
      mocks.adb.expects('getDeviceCountry').returns('us');
      mocks.adb.expects('setDeviceLanguage').never();
      mocks.adb.expects('setDeviceCountry').never();
      mocks.adb.expects('reboot').never();
      await helpers.ensureDeviceLocale(adb, 'en', 'us');
      mocks.adb.verify();
    });
    it('should set language and locale if they are different', async () => {
      mocks.adb.expects('getDeviceLanguage').returns('fr');
      mocks.adb.expects('getDeviceCountry').returns('FR');
      mocks.adb.expects('setDeviceLanguage').withExactArgs('en')
        .returns("");
      mocks.adb.expects('setDeviceCountry').withExactArgs('us')
        .returns("");
      mocks.adb.expects('reboot').returns(null);
      await helpers.ensureDeviceLocale(adb, 'en', 'us');
      mocks.adb.verify();
    });
  }));
  describe('getActiveDevice', withMocks({adb}, (mocks) => {
    it('should throw error when udid not in list', async () => {
      mocks.adb.expects('getDevicesWithRetry').withExactArgs()
        .returns(["foo"]);
      await helpers.getActiveDevice(adb, "bar").should.eventually
        .be.rejectedWith("bar");
      mocks.adb.verify();
    });
    it('should get deviceId and emPort when udid is present', async () => {
      mocks.adb.expects('getDevicesWithRetry').withExactArgs()
        .returns([{udid: 'emulator-1234'}]);
      (await helpers.getActiveDevice(adb, "emulator-1234")).should.deep
        .equal({ deviceId: 'emulator-1234', emPort: 1234 });
      mocks.adb.verify();
    });
    it('should get first deviceId and emPort', async () => {
      mocks.adb.expects('getDevicesWithRetry').withExactArgs()
        .returns([{udid: 'emulator-1234'}, {udid: 'emulator2-2345'}]);
      (await helpers.getActiveDevice(adb)).should.deep
        .equal({ deviceId: 'emulator-1234', emPort: 1234 });
      mocks.adb.verify();
    });
  }));
  describe('getLaunchInfoFromManifest', withMocks({adb}, (mocks) => {
    it('should return when no app present', async () => {
      mocks.adb.expects('packageAndLaunchActivityFromManifest').never();
      await helpers.getLaunchInfoFromManifest(adb, {});
      mocks.adb.verify();
    });
    it('should return when appPackage & appActivity are already present',
      async () => {
        mocks.adb.expects('packageAndLaunchActivityFromManifest').never();
        await helpers.getLaunchInfoFromManifest(adb, {app: "foo", appPackage: "bar",
          appActivity: "act"});
        mocks.adb.verify();
    });
    it('should return package and launch activity from moanifest', async () => {
      mocks.adb.expects('packageAndLaunchActivityFromManifest').withExactArgs('foo')
        .returns({apkPackage: 'pkg', apkActivity: 'ack'});
      const result = { appPackage: 'pkg', appWaitPackage: 'pkg',
                       appActivity: 'ack', appWaitActivity: 'ack' };
      (await helpers.getLaunchInfoFromManifest(adb, {app: "foo"})).should.deep
        .equal(result);
      mocks.adb.verify();
    });
  }));
  describe('getRemoteApkPath', () => {
    it('should return remote path', () => {
      helpers.getRemoteApkPath('foo').should.equal(path.resolve(REMOTE_TEMP_PATH,
        'foo.apk'));
    });
  });
  describe('resetApp', withMocks({adb, fs, helpers}, (mocks) => {
    const localApkPath = 'local',
          pkg = 'pkg';
    it('should throw error if remote file does not exist', async () => {
      mocks.fs.expects('md5').withExactArgs(localApkPath).returns('apkmd5');
      mocks.adb.expects('fileExists').returns(false);
      mocks.helpers.expects('reinstallRemoteApk').never();
      await helpers.resetApp(adb, localApkPath, pkg, false).should.eventually
        .be.rejectedWith('slow');
      mocks.adb.verify();
      mocks.fs.verify();
      mocks.helpers.verify();
    });
    it('should throw error if remote file does not exist', async () => {
      mocks.fs.expects('md5').withExactArgs(localApkPath).returns('apkmd5');
      mocks.adb.expects('fileExists').returns(true);
      mocks.helpers.expects('reinstallRemoteApk').once().returns('');
      await helpers.resetApp(adb, localApkPath, pkg, false);
      mocks.adb.verify();
      mocks.fs.verify();
      mocks.helpers.verify();
    });
  }));

  describe.skip('reinstallRemoteApk', withMocks({adb}, (mocks) => {
    const localApkPath = 'local',
          pkg = 'pkg',
          remotePath = 'remote';
    it('should throw error if remote file does not exist', async () => {
      mocks.adb.expects('uninstallApk').withExactArgs(pkg).returns('');
      // install remote is not defines do we mean installApkRemotely?
      mocks.adb.expects('installRemote').withExactArgs(remotePath)
        .returns('');
      await helpers.reinstallRemoteApk(adb, localApkPath, pkg, remotePath);
      mocks.adb.verify();
    });
  }));
  describe('installApkRemotely', withMocks({adb, fs, helpers}, (mocks) => {
    const localApkPath = 'local',
          pkg = 'pkg';
    it('should reset app if already installed', async () => {
      mocks.fs.expects('md5').withExactArgs(localApkPath).returns('apkmd5');
      mocks.helpers.expects('getRemoteApkPath').returns(false);
      mocks.adb.expects('fileExists').returns(true);
      mocks.adb.expects('isAppInstalled').returns(true);
      mocks.helpers.expects('resetApp').once().returns("");
      await helpers.installApkRemotely(adb, localApkPath, pkg, true);
      mocks.adb.verify();
      mocks.fs.verify();
      mocks.helpers.verify();
    });
    it.skip('should push and reinstall apk when apk is not installed', async () => {
      mocks.fs.expects('md5').withExactArgs(localApkPath).returns('apkmd5');
      mocks.helpers.expects('getRemoteApkPath').returns(true);
      mocks.adb.expects('fileExists').returns(true);
      mocks.adb.expects('isAppInstalled').returns(true);
      mocks.helpers.expects('resetApp').once().returns("");
      mocks.helpers.expects('reinstallRemoteApk').once().returns("");
      mocks.helpers.expects('removeTempApks').once().returns(true);
      mocks.adb.expects('mkdir').once().returns("");
      await helpers.installApkRemotely(adb, localApkPath, pkg, true);
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
      mocks.adb.expects('install').withExactArgs(settingsApkPath, false).once()
        .returns('');
      await helpers.pushSettingsApp(adb);
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
  describe('unlock', withMocks({adb}, (mocks) => {
    it('should return if screen is already unlocked', async () => {
      mocks.adb.expects('isScreenLocked').withExactArgs().once()
        .returns(false);
      mocks.adb.expects('startApp').never();
      await helpers.unlock(adb);
      mocks.adb.verify();
    });
    it('should start unlock app', async () => {
      mocks.adb.expects('isScreenLocked').onCall(0).returns(true);
      mocks.adb.expects('isScreenLocked').returns(false);
      mocks.adb.expects('startApp').once().returns('');
      await helpers.unlock(adb);
      mocks.adb.verify();
    });
  }));
});
