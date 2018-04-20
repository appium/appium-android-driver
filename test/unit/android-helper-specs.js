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
import B from 'bluebird';


const should = chai.should();
const REMOTE_TEMP_PATH = "/data/local/tmp";
chai.use(chaiAsPromised);


describe('Android Helpers', function () {
  let adb = new ADB();
  describe('parseJavaVersion', function () {
    it('should correctly parse java version', function () {
      helpers.parseJavaVersion(`java version "1.8.0_40"
        Java(TM) SE Runtime Environment (build 1.8.0_40-b27)`).should
        .be.equal("1.8.0_40");
    });
    it('should return null if it cannot parse java verstion', function () {
      should.not.exist(helpers.parseJavaVersion('foo bar'));
    });
    it('should parse OpenJDK versioning', function () {
      helpers.parseJavaVersion('openjdk version 1.8').should.be.equal('1.8');
    });
  });

  describe('getJavaVersion', withMocks({teen_process}, (mocks) => {
    it('should correctly get java version', async function () {
      mocks.teen_process.expects('exec').withExactArgs('java', ['-version'])
        .returns({stderr: 'java version "1.8.0_40"'});
      (await helpers.getJavaVersion()).should.equal('1.8.0_40');
      mocks.teen_process.verify();
    });
    it('should return null if it cannot parse java verstion', async function () {
      mocks.teen_process.expects('exec').withExactArgs('java', ['-version'])
        .returns({stderr: 'foo bar'});
      await helpers.getJavaVersion().should.eventually.be.rejectedWith('Java');
      mocks.teen_process.verify();
    });
  }));
  describe('prepareEmulator', withMocks({adb, helpers}, (mocks) => {
    const opts = {avd: "foo@bar", avdArgs: "", language: "en", locale: "us"};
    it('should not launch avd if one is already running', async function () {
      mocks.adb.expects('getRunningAVD').withExactArgs('foobar')
        .returns("foo");
      mocks.adb.expects('launchAVD').never();
      mocks.adb.expects('killEmulator').never();
      await helpers.prepareEmulator(adb, opts);
      mocks.adb.verify();
    });
    it('should launch avd if one is already running', async function () {
      mocks.adb.expects('getRunningAVD').withExactArgs('foobar')
        .returns(null);
      mocks.adb.expects('launchAVD').withExactArgs('foo@bar', '', 'en', 'us',
        undefined, undefined)
        .returns("");
      await helpers.prepareEmulator(adb, opts);
      mocks.adb.verify();
    });
    it('should kill emulator if avdArgs contains -wipe-data', async function () {
      const opts = {avd: "foo@bar", avdArgs: "-wipe-data"};
      mocks.adb.expects('getRunningAVD').withExactArgs('foobar').returns('foo');
      mocks.adb.expects('killEmulator').withExactArgs('foobar').once();
      mocks.adb.expects('launchAVD').once();
      await helpers.prepareEmulator(adb, opts);
      mocks.adb.verify();
    });
    it('should fail if avd name is not specified', async function () {
      await helpers.prepareEmulator(adb, {}).should.eventually.be.rejected;
    });
  }));
  describe('prepareAVDArgs', withMocks({adb, helpers}, (mocks) => {
    it('should set the correct avdArgs', async function () {
      let avdArgs = '-wipe-data';
      (helpers.prepareAVDArgs({}, adb, avdArgs)).should.equal(avdArgs);
    });
    it('should add headless arg', async function () {
      let avdArgs = '-wipe-data';
      let args = helpers.prepareAVDArgs({isHeadless: true}, adb, avdArgs);
      args.should.have.string('-wipe-data');
      args.should.have.string('-no-window');
    });
    it('should add network speed arg', async function () {
      let avdArgs = '-wipe-data';
      mocks.helpers.expects('ensureNetworkSpeed').once()
        .returns('edge');
      let args = helpers.prepareAVDArgs({networkSpeed: 'edge'}, adb, avdArgs);
      args.should.have.string('-wipe-data');
      args.should.have.string('-netspeed edge');
      mocks.adb.verify();
    });
    it('should not include empty avdArgs', async function () {
      let avdArgs = '';
      let args = helpers.prepareAVDArgs({isHeadless: true}, adb, avdArgs);
      args.should.eql('-no-window');
    });
  }));
  describe('ensureNetworkSpeed', function () {
    it('should return value if network speed is valid', async function () {
      adb.NETWORK_SPEED = {GSM: 'gsm'};
      await helpers.ensureNetworkSpeed(adb, 'gsm').should.be.equal('gsm');
    });
    it('should return ADB.NETWORK_SPEED.FULL if network speed is invalid', async function () {
      adb.NETWORK_SPEED = {FULL: 'full'};
      await helpers.ensureNetworkSpeed(adb, 'invalid').should.be.equal('full');
    });
  });
  describe('ensureDeviceLocale', withMocks({adb}, (mocks) => {
    it('should call setDeviceLanguageCountry', async function () {
      mocks.adb.expects('setDeviceLanguageCountry').withExactArgs('en', 'US').once();
      mocks.adb.expects('ensureCurrentLocale').withExactArgs('en', 'US').once().returns(true);
      await helpers.ensureDeviceLocale(adb, 'en', 'US');
      mocks.adb.verify();
    });
    it('should never call setDeviceLanguageCountry', async function () {
      mocks.adb.expects('setDeviceLanguageCountry').never();
      mocks.adb.expects('getApiLevel').never();
      await helpers.ensureDeviceLocale(adb);
      mocks.adb.verify();
    });
    it('should call setDeviceLanguageCountry with throw', async function () {
      mocks.adb.expects('setDeviceLanguageCountry').withExactArgs('fr', 'FR').once();
      mocks.adb.expects('ensureCurrentLocale').withExactArgs('fr', 'FR').once().returns(false);
      await helpers.ensureDeviceLocale(adb, 'fr', 'FR').should.eventually.be.rejectedWith(Error, `Failed to set language: fr and country: FR`);
      mocks.adb.verify();
    });
  }));

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
      {udid: '0123456789', os: 'wellhellothere'}
    ];
    let curDeviceId = '';

    before(function () {
      sinon.stub(ADB, 'createADB', async () => {
        return {
          getDevicesWithRetry: async () => {
            return _.map(devices, (device) => { return {udid: device.udid}; });
          },
          getPortFromEmulatorString: () => {
            return 1234;
          },
          getRunningAVD: () => {
            return {udid: 'emulator-1234', port: 1234};
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

    after(function () {
      ADB.createADB.restore();
    });

    it('should throw error when udid not in list', async function () {
      let caps = {
        udid: 'foomulator'
      };

      await helpers.getDeviceInfoFromCaps(caps).should.be.rejectedWith('foomulator');
    });
    it('should get deviceId and emPort when udid is present', async function () {
      let caps = {
        udid: 'emulator-1234'
      };

      let {udid, emPort} = await helpers.getDeviceInfoFromCaps(caps);
      udid.should.equal('emulator-1234');
      emPort.should.equal(1234);
    });
    it('should get first deviceId and emPort if avd, platformVersion, and udid aren\'t given', async function () {
      let {udid, emPort} = await helpers.getDeviceInfoFromCaps();
      udid.should.equal('emulator-1234');
      emPort.should.equal(1234);
    });
    it('should get deviceId and emPort when avd is present', async function () {
      let caps = {
        avd: 'AVD_NAME'
      };
      let {udid, emPort} = await helpers.getDeviceInfoFromCaps(caps);
      udid.should.equal('emulator-1234');
      emPort.should.equal(1234);
    });
    it('should fail if the given platformVersion is not found', async function () {
      let caps = {
        platformVersion: '1234567890'
      };
      await helpers.getDeviceInfoFromCaps(caps)
        .should.be.rejectedWith('Unable to find an active device or emulator with OS 1234567890');
    });
    it('should get deviceId and emPort if platformVersion is found and unique', async function () {
      let caps = {
        platformVersion: '6.0'
      };
      let {udid, emPort} = await helpers.getDeviceInfoFromCaps(caps);
      udid.should.equal('roamulet-9000');
      emPort.should.equal(1234);
    });
    it('should get the first deviceId and emPort if platformVersion is found multiple times', async function () {
      let caps = {
        platformVersion: '5.0.1'
      };
      let {udid, emPort} = await helpers.getDeviceInfoFromCaps(caps);
      udid.should.equal('rotalume-1338');
      emPort.should.equal(1234);
    });
    it('should get the first deviceId and emPort if platformVersion is found multiple times and is a partial match', async function () {
      let caps = {
        platformVersion: '5.0'
      };
      let {udid, emPort} = await helpers.getDeviceInfoFromCaps(caps);
      udid.should.equal('rotalume-1338');
      emPort.should.equal(1234);
    });
    it('should get deviceId and emPort by udid if udid and platformVersion are given', async function () {
      let caps = {
        udid: '0123456789',
        platformVersion: '2.3'
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
      sinon.stub(ADB, 'createADB', async () => {
        return {
          setDeviceId: (udid) => { curDeviceId = udid; },
          setEmulatorPort: (emPort) => { emulatorPort = emPort; }
        };
      });
    });
    after(function () {
      ADB.createADB.restore();
    });
    it('should create adb and set device id and emulator port', async function () {
      await helpers.createADB("1.7", "111222", "111", "222", true, "remote_host", true);
      ADB.createADB.calledWithExactly({
        javaVersion: "1.7",
        adbPort: "222",
        suppressKillServer: true,
        remoteAdbHost: "remote_host",
        clearDeviceLogsOnStart: true,
      }).should.be.true;
      curDeviceId.should.equal("111222");
      emulatorPort.should.equal("111");
    });
    it('should not set emulator port if emPort is undefined', async function () {
      emulatorPort = 5555;
      await helpers.createADB();
      emulatorPort.should.equal(5555);
    });
  });
  describe('getLaunchInfoFromManifest', withMocks({adb}, (mocks) => {
    it('should return when no app present', async function () {
      mocks.adb.expects('packageAndLaunchActivityFromManifest').never();
      await helpers.getLaunchInfo(adb, {});
      mocks.adb.verify();
    });
    it('should return when appPackage & appActivity are already present', async function () {
      mocks.adb.expects('packageAndLaunchActivityFromManifest').never();
      await helpers.getLaunchInfo(adb, {app: "foo", appPackage: "bar",
        appActivity: "act"});
      mocks.adb.verify();
    });
    it('should return package and launch activity from manifest', async function () {
      mocks.adb.expects('packageAndLaunchActivityFromManifest').withExactArgs('foo')
        .returns({apkPackage: 'pkg', apkActivity: 'ack'});
      const result = {appPackage: 'pkg', appWaitPackage: 'pkg',
                      appActivity: 'ack', appWaitActivity: 'ack'};
      (await helpers.getLaunchInfo(adb, {app: "foo"})).should.deep
        .equal(result);
      mocks.adb.verify();
    });
    it('should not override appPackage, appWaitPackage, appActivity, appWaitActivity ' +
       'from manifest if they are allready defined in opts', async function () {
      let optsFromManifest = {apkPackage: 'mpkg', apkActivity: 'mack'};
      mocks.adb.expects('packageAndLaunchActivityFromManifest')
        .withExactArgs('foo').twice().returns(optsFromManifest);

      let inOpts = {app: 'foo', appActivity: 'ack', appWaitPackage: 'wpkg', appWaitActivity: 'wack' };
      let outOpts = {appPackage: 'mpkg', appActivity: 'ack', appWaitPackage: 'wpkg', appWaitActivity: 'wack'};
      (await helpers.getLaunchInfo(adb, inOpts)).should.deep.equal(outOpts);

      inOpts = {app: 'foo', appPackage: 'pkg', appWaitPackage: 'wpkg', appWaitActivity: 'wack'};
      outOpts = {appPackage: 'pkg', appActivity: 'mack', appWaitPackage: 'wpkg', appWaitActivity: 'wack'};
      (await helpers.getLaunchInfo(adb, inOpts)).should.deep.equal(outOpts);
      mocks.adb.verify();
    });
  }));
  describe('resetApp', withMocks({adb, helpers}, (mocks) => {
    const localApkPath = 'local';
    const pkg = 'pkg';
    it('should complain if opts arent passed correctly', async function () {
      await helpers.resetApp(adb, {})
              .should.eventually.be.rejectedWith(/appPackage/);
    });
    it('should be able to do full reset', async function () {
      mocks.adb.expects('install').once().withArgs(localApkPath);
      mocks.adb.expects('forceStop').withExactArgs(pkg).once();
      mocks.adb.expects('isAppInstalled').once().withExactArgs(pkg).returns(true);
      mocks.adb.expects('uninstallApk').once().withExactArgs(pkg);
      await helpers.resetApp(adb, {app: localApkPath, appPackage: pkg});
      mocks.adb.verify();
    });
    it('should be able to do fast reset', async function () {
      mocks.adb.expects('isAppInstalled').once().withExactArgs(pkg).returns(true);
      mocks.adb.expects('forceStop').withExactArgs(pkg).once();
      mocks.adb.expects('clear').withExactArgs(pkg).once().returns('Success');
      mocks.adb.expects('grantAllPermissions').once().withExactArgs(pkg);
      await helpers.resetApp(adb, {app: localApkPath, appPackage: pkg, fastReset: true, autoGrantPermissions:true});
      mocks.adb.verify();
    });
    it('should perform reinstall if app is not installed and fast reset is requested', async function () {
      mocks.adb.expects('isAppInstalled').once().withExactArgs(pkg).returns(false);
      mocks.adb.expects('forceStop').withExactArgs(pkg).never();
      mocks.adb.expects('clear').withExactArgs(pkg).never();
      mocks.adb.expects('uninstallApk').never();
      mocks.adb.expects('install').once().withArgs(localApkPath);
      await helpers.resetApp(adb, {app: localApkPath, appPackage: pkg, fastReset: true});
      mocks.adb.verify();
    });
  }));

  describe('installApk', withMocks({adb, fs, helpers}, function (mocks) {
    //use mock appium capabilities for this test
    const opts = {
      app : 'local',
      appPackage : 'pkg',
      androidInstallTimeout : 90000
    };
    it('should complain if appPackage is not passed', async function () {
      await helpers.installApk(adb, {})
              .should.eventually.be.rejectedWith(/appPackage/);
    });
    it('should install/upgrade and reset app if fast reset is set to true', async function () {
      mocks.adb.expects('isAppInstalled').once().returns(true);
      mocks.adb.expects('installOrUpgrade').once().withArgs(opts.app, opts.appPackage);
      mocks.helpers.expects('resetApp').once().withArgs(adb);
      await helpers.installApk(adb, Object.assign({}, opts, {fastReset: true}));
      mocks.adb.verify();
      mocks.helpers.verify();
    });
    it('should reinstall app if full reset is set to true', async function () {
      mocks.adb.expects('installOrUpgrade').never();
      mocks.helpers.expects('resetApp').once().withArgs(adb);
      await helpers.installApk(adb, Object.assign({}, opts, {fastReset: true, fullReset: true}));
      mocks.adb.verify();
      mocks.helpers.verify();
    });
    it('should not run reset if the corresponding option is not set', async function () {
      mocks.adb.expects('installOrUpgrade').once().withArgs(opts.app, opts.appPackage);
      mocks.helpers.expects('resetApp').never();
      await helpers.installApk(adb, opts);
      mocks.adb.verify();
      mocks.helpers.verify();
    });
    it('should install/upgrade and skip fast reseting the app if this was the fresh install', async function () {
      mocks.adb.expects('isAppInstalled').once().returns(false);
      mocks.adb.expects('installOrUpgrade').once().withArgs(opts.app, opts.appPackage);
      mocks.helpers.expects('resetApp').never();
      await helpers.installApk(adb, Object.assign({}, opts, {fastReset: true}));
      mocks.adb.verify();
      mocks.helpers.verify();
    });
  }));
  describe('installOtherApks', withMocks({adb, fs, helpers}, function (mocks) {
    const opts = {
      app: 'local',
      appPackage: 'pkg',
      androidInstallTimeout: 90000
    };

    const fakeApk = '/path/to/fake/app.apk';
    const otherFakeApk = '/path/to/other/fake/app.apk';

    const expectedADBInstallOpts = {
      grantPermissions: undefined,
      timeout: opts.androidInstallTimeout,
    };

    it('should not call adb.installOrUpgrade if otherApps is empty', async function () {
      mocks.adb.expects('installOrUpgrade').never();
      await helpers.installOtherApks([], adb, opts);
      mocks.adb.verify();
    });
    it('should call adb.installOrUpgrade once if otherApps has one item', async function () {
      mocks.adb.expects('installOrUpgrade').once().withArgs(fakeApk, null, expectedADBInstallOpts);
      await helpers.installOtherApks([fakeApk], adb, opts);
      mocks.adb.verify();
    });
    it('should call adb.installOrUpgrade twice if otherApps has two item', async function () {
      mocks.adb.expects('installOrUpgrade').twice();
      await helpers.installOtherApks([fakeApk, otherFakeApk], adb, opts);
      mocks.adb.verify();
    });
  }));
  describe('initUnicodeKeyboard', withMocks({adb}, (mocks) => {
    it('should install and enable unicodeIME', async function () {
      mocks.adb.expects('install').once().returns('');
      mocks.adb.expects('defaultIME').once().returns('defaultIME');
      mocks.adb.expects('enableIME').once().returns('');
      mocks.adb.expects('setIME').once().returns('');
      await helpers.initUnicodeKeyboard(adb);
      mocks.adb.verify();
    });
  }));
  describe('pushSettingsApp', withMocks({adb}, (mocks) => {
    it('should skip granting permissions if the app is already running', async function () {
      mocks.adb.expects('installOrUpgrade').once()
        .returns(true);
      mocks.adb.expects('processExists')
          .withExactArgs('io.appium.settings').once()
          .returns(true);
      await helpers.pushSettingsApp(adb);
      mocks.adb.verify();
    });
    it('should launch settings app if it isnt running', async function () {
      mocks.adb.expects('installOrUpgrade').once()
        .returns(true);
      mocks.adb.expects('processExists').once()
        .returns(false);
      mocks.adb.expects('startApp').once();
      await helpers.pushSettingsApp(adb);
      mocks.adb.verify();
    });
  }));
  describe('setMockLocationApp', withMocks({adb}, (mocks) => {
    it('should enable mock location for api level below 23', async function () {
      mocks.adb.expects('getApiLevel').returns(B.resolve(18));
      mocks.adb.expects('shell').withExactArgs(['settings', 'put', 'secure', 'mock_location', '1']).once()
        .returns('');
      await helpers.setMockLocationApp(adb, 'io.appium.settings');
      mocks.adb.verify();
    });
    it('should enable mock location for api level 23 and above', async function () {
      mocks.adb.expects('getApiLevel').returns(B.resolve(23));
      mocks.adb.expects('shell').withExactArgs(['appops', 'set', 'io.appium.settings', 'android:mock_location', 'allow']).once()
        .returns('');
      await helpers.setMockLocationApp(adb, 'io.appium.settings');
      mocks.adb.verify();
    });
  }));
  describe('pushUnlock', withMocks({adb}, (mocks) => {
    it('should install unlockApp', async function () {
      mocks.adb.expects('installOrUpgrade').withArgs(unlockApkPath, 'io.appium.unlock').once()
        .returns('');
      await helpers.pushUnlock(adb);
      mocks.adb.verify();
    });
  }));
  describe('pushStrings', withMocks({adb, fs}, (mocks) => {
    const opts = {app: 'app', tmpDir: '/tmp_dir', appPackage: 'pkg'};
    it('should extracts string.xml and converts it to string.json and pushes it', async function () {
      mocks.adb.expects('rimraf').withExactArgs(`${REMOTE_TEMP_PATH}/strings.json`).once();
      mocks.fs.expects('exists').withExactArgs(opts.app).returns(true);
      mocks.fs.expects('rimraf').once();
      mocks.adb.expects('extractStringsFromApk').withArgs(opts.app, 'en')
        .returns({apkStrings: {id: 'string'}, localPath: 'local_path'});
      mocks.adb.expects('push').withExactArgs('local_path', REMOTE_TEMP_PATH).once();
      (await helpers.pushStrings('en', adb, opts)).should.be.deep.equal({id: 'string'});
      mocks.adb.verify();
    });
    it('should delete remote strings.json if app is not present', async function () {
      mocks.adb.expects('rimraf').withExactArgs(`${REMOTE_TEMP_PATH}/strings.json`).once();
      mocks.fs.expects('exists').withExactArgs(opts.app).returns(false);
      (await helpers.pushStrings('en', adb, opts)).should.be.deep.equal({});
      mocks.adb.verify();
      mocks.fs.verify();
    });
    it('should push an empty json object if app does not have strings.xml', async function () {
      mocks.adb.expects('rimraf').withExactArgs(`${REMOTE_TEMP_PATH}/strings.json`).once();
      mocks.fs.expects('exists').withExactArgs(opts.app).returns(true);
      mocks.fs.expects('rimraf').once();
      mocks.adb.expects('extractStringsFromApk').throws();
      mocks.adb.expects('shell').withExactArgs('echo', [`'{}' > ${REMOTE_TEMP_PATH}/strings.json`]);
      (await helpers.pushStrings('en', adb, opts)).should.be.deep.equal({});
      mocks.adb.verify();
      mocks.fs.verify();
    });
  }));
  describe('unlock', withMocks({adb, helpers, unlocker}, (mocks) => {
    it('should return if screen is already unlocked', async function () {
      mocks.adb.expects('isScreenLocked').withExactArgs().once()
        .returns(false);
      mocks.adb.expects('getApiLevel').never();
      mocks.adb.expects('startApp').never();
      await helpers.unlock(helpers, adb, {});
      mocks.adb.verify();
    });
    it('should start unlock app', async function () {
      mocks.adb.expects('isScreenLocked').onCall(0).returns(true);
      mocks.adb.expects('isScreenLocked').returns(false);
      mocks.adb.expects('forceStop').once().returns('');
      mocks.adb.expects('startApp').twice().returns('');
      await helpers.unlock(helpers, adb, {});
      mocks.adb.verify();
      mocks.helpers.verify();
    });
    it('should raise an error on undefined unlockKey when unlockType is defined', async function () {
      mocks.adb.expects('isScreenLocked').once().returns(true);
      mocks.unlocker.expects('isValidKey').once();
      await helpers.unlock(helpers, adb, {unlockType: "pin"}).should.be.rejectedWith('unlockKey');
      mocks.adb.verify();
      mocks.unlocker.verify();
      mocks.helpers.verify();
    });
    it('should call pinUnlock if unlockType is pin', async function () {
      mocks.adb.expects('isScreenLocked').onCall(0).returns(true);
      mocks.adb.expects('isScreenLocked').returns(false);
      mocks.unlocker.expects('pinUnlock').once();
      await helpers.unlock(helpers, adb, {unlockType: "pin", unlockKey: "1111"});
      mocks.adb.verify();
      mocks.helpers.verify();
    });
    it('should call passwordUnlock if unlockType is password', async function () {
      mocks.adb.expects('isScreenLocked').onCall(0).returns(true);
      mocks.adb.expects('isScreenLocked').returns(false);
      mocks.unlocker.expects('passwordUnlock').once();
      await helpers.unlock(helpers, adb, {unlockType: "password", unlockKey: "appium"});
      mocks.adb.verify();
      mocks.helpers.verify();
    });
    it('should call patternUnlock if unlockType is pattern', async function () {
      mocks.adb.expects('isScreenLocked').onCall(0).returns(true);
      mocks.adb.expects('isScreenLocked').returns(false);
      mocks.unlocker.expects('patternUnlock').once();
      await helpers.unlock(helpers, adb, {unlockType: "pattern", unlockKey: "123456789"});
      mocks.adb.verify();
      mocks.helpers.verify();
    });
    it('should call fingerprintUnlock if unlockType is fingerprint', async function () {
      mocks.adb.expects('isScreenLocked').onCall(0).returns(true);
      mocks.adb.expects('isScreenLocked').returns(false);
      mocks.unlocker.expects('fingerprintUnlock').once();
      await helpers.unlock(helpers, adb, {unlockType: "fingerprint", unlockKey: "1111"});
      mocks.adb.verify();
      mocks.unlocker.verify();
    });
    it('should throw an error is api is lower than 23 and trying to use fingerprintUnlock', async function () {
      mocks.adb.expects('isScreenLocked').onCall(0).returns(true);
      mocks.adb.expects('isScreenLocked').returns(false);
      mocks.adb.expects('getApiLevel').once().returns(21);
      await helpers.unlock(helpers, adb, {unlockType: "fingerprint", unlockKey: "1111"}).should.eventually
        .be.rejectedWith('Fingerprint');
      mocks.helpers.verify();
    });
  }));
  describe('initDevice', withMocks({helpers, adb}, (mocks) => {
    it('should init device', async function () {
      const opts = {language: "en", locale: "us"};
      mocks.adb.expects('waitForDevice').once();
      mocks.adb.expects('startLogcat').once();
      mocks.helpers.expects('pushSettingsApp').once();
      mocks.helpers.expects('ensureDeviceLocale').withExactArgs(adb, opts.language, opts.locale).once();
      mocks.helpers.expects('setMockLocationApp').withExactArgs(adb, 'io.appium.settings').once();
      mocks.helpers.expects('pushUnlock').withExactArgs(adb).once();
      await helpers.initDevice(adb, opts);
      mocks.helpers.verify();
      mocks.adb.verify();
    });
    it('should not install settings app and mock location on emulator', async function () {
      const opts = {avd: "avd"};
      mocks.adb.expects('waitForDevice').once();
      mocks.adb.expects('startLogcat').once();
      mocks.helpers.expects('pushSettingsApp').never();
      mocks.helpers.expects('ensureDeviceLocale').withArgs(adb).once();
      mocks.helpers.expects('setMockLocationApp').never();
      mocks.helpers.expects('pushUnlock').withExactArgs(adb).once();
      await helpers.initDevice(adb, opts);
      mocks.helpers.verify();
      mocks.adb.verify();
    });
    it('should return defaultIME if unicodeKeyboard is setted to true', async function () {
      const opts = {unicodeKeyboard : true};
      mocks.adb.expects('waitForDevice').once();
      mocks.adb.expects('startLogcat').once();
      mocks.helpers.expects('pushSettingsApp').once();
      mocks.helpers.expects('ensureDeviceLocale').once();
      mocks.helpers.expects('setMockLocationApp').once();
      mocks.helpers.expects('initUnicodeKeyboard').withExactArgs(adb).once().returns("defaultIME");
      mocks.helpers.expects('pushUnlock').withExactArgs(adb).once();
      await helpers.initDevice(adb, opts).should.become("defaultIME");
      mocks.helpers.verify();
      mocks.adb.verify();
    });
    it('should return undefined if unicodeKeyboard is setted to false', async function () {
      const opts = {unicodeKeyboard : false};
      mocks.adb.expects('waitForDevice').once();
      mocks.adb.expects('startLogcat').once();
      mocks.helpers.expects('pushSettingsApp').once();
      mocks.helpers.expects('ensureDeviceLocale').once();
      mocks.helpers.expects('setMockLocationApp').once();
      mocks.helpers.expects('initUnicodeKeyboard').never();
      mocks.helpers.expects('pushUnlock').withExactArgs(adb).once();
      should.not.exist(await helpers.initDevice(adb, opts));
      mocks.helpers.verify();
      mocks.adb.verify();
    });
    it('should not push unlock app if unlockType is defined', async function () {
      const opts = {unlockType: "unlock_type"};
      mocks.adb.expects('waitForDevice').once();
      mocks.adb.expects('startLogcat').once();
      mocks.helpers.expects('pushSettingsApp').once();
      mocks.helpers.expects('ensureDeviceLocale').once();
      mocks.helpers.expects('setMockLocationApp').once();
      mocks.helpers.expects('initUnicodeKeyboard').never();
      mocks.helpers.expects('pushUnlock').never();
      await helpers.initDevice(adb, opts);
      mocks.helpers.verify();
      mocks.adb.verify();
    });
  }));
  describe('removeNullProperties', function () {
    it('should ignore null properties', async function () {
      let test = {foo: null, bar: true};
      helpers.removeNullProperties(test);
      _.keys(test).length.should.equal(1);
    });
    it('should ignore undefined properties', async function () {
      let test = {foo: undefined, bar: true};
      helpers.removeNullProperties(test);
      _.keys(test).length.should.equal(1);
    });
    it('should not ignore falsy properties like 0 and false', async function () {
      let test = {foo: false, bar: true, zero: 0};
      helpers.removeNullProperties(test);
      _.keys(test).length.should.equal(3);
    });
  });
  describe('truncateDecimals', function () {
    it('should use floor when number is positive', async function () {
      helpers.truncateDecimals(12.345, 2).should.equal(12.34);
    });
    it('should use ceil when number is negative', async function () {
      helpers.truncateDecimals(-12.345, 2).should.equal(-12.34);
    });
  });
  describe('getChromePkg', function () {
    it('should return pakage for chromium', async function () {
      helpers.getChromePkg('chromium').should.deep.equal(
        {pkg: 'org.chromium.chrome.shell', activity: '.ChromeShellActivity'});
    });
    it('should return pakage for chromebeta', async function () {
      helpers.getChromePkg('chromebeta').should.deep.equal(
        {pkg: 'com.chrome.beta', activity: 'com.google.android.apps.chrome.Main'});
    });
    it('should return pakage for browser', async function () {
      helpers.getChromePkg('browser').should.deep.equal(
        {pkg: 'com.android.browser', activity: 'com.android.browser.BrowserActivity'});
    });
    it('should return pakage for chromium-browser', async function () {
      helpers.getChromePkg('chromium-browser').should.deep.equal(
        {pkg: 'org.chromium.chrome', activity: 'com.google.android.apps.chrome.Main'});
    });
    it('should return pakage for chromium-webview', async function () {
      helpers.getChromePkg('chromium-webview').should.deep.equal(
        {pkg: 'org.chromium.webview_shell', activity: 'org.chromium.webview_shell.WebViewBrowserActivity'});
    });
  });

  describe('#parseArray', function () {
    it('should parse array string to array', function () {
      helpers.parseArray('["a", "b", "c"]').should.eql(['a', 'b', 'c']);
    });
    it('should parse a simple string to one item array', function () {
      helpers.parseArray('abc').should.eql(['abc']);
    });
  });
});
