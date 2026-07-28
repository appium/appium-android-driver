import assert from 'node:assert/strict';
import {describe, it, beforeEach, afterEach} from 'node:test';

import {fs} from '@appium/support';
import {ADB} from 'appium-adb';
import esmock from 'esmock';
import sinon from 'sinon';

import {AndroidDriver} from '../../../lib/driver.js';

let driver: AndroidDriver;
const sandbox = sinon.createSandbox();

describe('App Management', function () {
  beforeEach(function () {
    driver = new AndroidDriver();
    driver.adb = new ADB();
    driver.caps = {} as any;
    driver.opts = {} as any;
    driver.helpers = {} as any;
  });
  afterEach(function () {
    sandbox.verifyAndRestore();
  });
  describe('getCurrentActivity', function () {
    it('should get current activity', async function () {
      sandbox.stub(driver.adb, 'getFocusedPackageAndActivity').resolves({appActivity: 'act'});
      assert.strictEqual(await driver.getCurrentActivity(), 'act');
    });
  });
  describe('getCurrentPackage', function () {
    it('should get current activity', async function () {
      sandbox.stub(driver.adb, 'getFocusedPackageAndActivity').resolves({appPackage: 'pkg'});
      assert.strictEqual(await driver.getCurrentPackage(), 'pkg');
    });
  });
  describe('isAppInstalled', function () {
    it('should return true if app is installed', async function () {
      sandbox.stub(driver.adb, 'isAppInstalled').withArgs('pkg').resolves(true);
      assert.strictEqual(await driver.isAppInstalled('pkg'), true);
    });
    it('should return true if app is installed with undefined user', async function () {
      sandbox.stub(driver.adb, 'isAppInstalled').withArgs('pkg').resolves(true);
      assert.strictEqual(await driver.isAppInstalled('pkg', {}), true);
    });
    it('should return true if app is installed with user string', async function () {
      sandbox.stub(driver.adb, 'isAppInstalled').withArgs('pkg', {user: '1'}).resolves(true);
      assert.strictEqual(await driver.isAppInstalled('pkg', {user: '1'}), true);
    });
    it('should return true if app is installed with user number', async function () {
      const stub = sandbox.stub(driver.adb, 'isAppInstalled');
      stub.withArgs('pkg', sinon.match({user: '1'})).resolves(true);
      stub.withArgs('pkg', sinon.match({user: sinon.match.any})).resolves(true);
      assert.strictEqual(await driver.isAppInstalled('pkg', {user: 1} as any), true);
    });
  });
  describe('mobileIsAppInstalled', function () {
    it('should return true if app is installed', async function () {
      sandbox.stub(driver.adb, 'isAppInstalled').withArgs('pkg').resolves(true);
      assert.strictEqual(await driver.mobileIsAppInstalled('pkg'), true);
    });
    it('should return true if app is installed with undefined user', async function () {
      sandbox.stub(driver.adb, 'isAppInstalled').withArgs('pkg').resolves(true);
      assert.strictEqual(await driver.mobileIsAppInstalled('pkg'), true);
    });
    it('should return true if app is installed with user string', async function () {
      sandbox.stub(driver.adb, 'isAppInstalled').withArgs('pkg', {user: '1'}).resolves(true);
      assert.strictEqual(await driver.mobileIsAppInstalled('pkg', '1'), true);
    });
    it('should return true if app is installed with user number', async function () {
      sandbox.stub(driver.adb, 'isAppInstalled').withArgs('pkg', {user: '1'}).resolves(true);
      assert.strictEqual(await driver.mobileIsAppInstalled('pkg', 1), true);
    });
  });
  describe('mobileListApps', function () {
    it('should return list of installed packages', async function () {
      const packages = [
        {appPackage: 'pkg1', versionCode: '10'},
        {appPackage: 'pkg2', versionCode: '10'},
      ];
      sandbox.stub(driver.adb, 'listInstalledPackages').withArgs({}).resolves(packages);
      assert.deepStrictEqual(await driver.mobileListApps(), {
        pkg1: {packageName: 'pkg1', versionCode: 10},
        pkg2: {packageName: 'pkg2', versionCode: 10},
      });
    });
    it('should return list of installed packages for specific user', async function () {
      const packages = [{appPackage: 'pkg1'}, {appPackage: 'pkg2'}];
      sandbox
        .stub(driver.adb, 'listInstalledPackages')
        .withArgs({user: '1'})
        .resolves(packages as any);
      assert.deepStrictEqual(await driver.mobileListApps('1'), {
        pkg1: {packageName: 'pkg1', versionCode: null},
        pkg2: {packageName: 'pkg2', versionCode: null},
      });
    });
    it('should return list of installed packages with user string', async function () {
      const packages = [{appPackage: 'pkg1', versionCode: '10'}];
      sandbox.stub(driver.adb, 'listInstalledPackages').withArgs({user: '1'}).resolves(packages);
      assert.deepStrictEqual(await driver.mobileListApps('1'), {
        pkg1: {packageName: 'pkg1', versionCode: 10},
      });
    });
    it('should return list of installed packages with user number', async function () {
      const packages = [{appPackage: 'pkg1', versionCode: '10'}];
      sandbox.stub(driver.adb, 'listInstalledPackages').withArgs({user: '1'}).resolves(packages);
      assert.deepStrictEqual(await driver.mobileListApps(1), {
        pkg1: {packageName: 'pkg1', versionCode: 10},
      });
    });
  });
  describe('removeApp', function () {
    it('should remove app', async function () {
      sandbox.stub(driver.adb, 'uninstallApk').withArgs('pkg').resolves(true);
      assert.strictEqual(await driver.removeApp('pkg'), true);
    });
  });
  describe('installApp', function () {
    it('should install app', async function () {
      const app = 'app.apk';
      driver.helpers = {configureApp: sandbox.stub().withArgs(app, '.apk').resolves(app)} as any;
      const configureAppStub = driver.helpers.configureApp as sinon.SinonStub;
      const rimrafStub = sandbox.stub(fs, 'rimraf').resolves();
      const installStub = sandbox.stub(driver.adb, 'install').resolves();
      await driver.installApp(app, {});
      assert.strictEqual(configureAppStub.calledOnce, true);
      assert.strictEqual(rimrafStub.notCalled, true);
      assert.strictEqual(installStub.calledOnce, true);
    });
    it('should throw an error if APK does not exist', async function () {
      driver.helpers = {
        configureApp: sandbox.stub().rejects(new Error('does not exist or is not accessible')),
      } as any;
      await assert.rejects(driver.installApp('non/existent/app.apk', {}), /does not exist or is not accessible/);
    });
  });
  describe('background', function () {
    async function mockBackground(sleepStub: sinon.SinonStub) {
      return (
        await esmock('../../../lib/commands/app-management.js', import.meta.url, {
          asyncbox: {longSleep: sleepStub},
        })
      ).background;
    }

    it('should bring app to background and back', async function () {
      const appPackage = 'wpkg';
      const appActivity = 'wacv';
      driver.opts = {
        appPackage,
        appActivity,
        intentAction: 'act',
        intentCategory: 'cat',
        intentFlags: 'flgs',
        optionalIntentArguments: 'opt',
      } as any;
      const getFocusedStub = sandbox
        .stub(driver.adb, 'getFocusedPackageAndActivity')
        .resolves({appPackage, appActivity});
      const goToHomeStub = sandbox.stub(driver.adb, 'goToHome');
      const sleepStub = sandbox.stub();
      const startAppStub = sandbox.stub(driver.adb, 'startApp');
      const activateAppStub = sandbox.stub(driver.adb, 'activateApp');
      const background = await mockBackground(sleepStub);
      await background.bind(driver)(10);
      assert.strictEqual(getFocusedStub.calledOnce, true);
      assert.strictEqual(goToHomeStub.calledOnce, true);
      assert.strictEqual(sleepStub.calledOnce, true);
      assert.strictEqual(sleepStub.firstCall.args[0], 10_000);
      assert.strictEqual(activateAppStub.calledWithExactly(appPackage), true);
      assert.strictEqual(startAppStub.notCalled, true);
    });
    it('should bring app to background and back if started after session init', async function () {
      const appPackage = 'newpkg';
      const appActivity = 'newacv';
      driver.opts = {
        appPackage: 'pkg',
        appActivity: 'acv',
        intentAction: 'act',
        intentCategory: 'cat',
        intentFlags: 'flgs',
        optionalIntentArguments: 'opt',
      } as any;
      const params = {
        pkg: appPackage,
        activity: appActivity,
        action: 'act',
        category: 'cat',
        flags: 'flgs',
        waitPkg: 'wpkg',
        waitActivity: 'wacv',
        optionalIntentArguments: 'opt',
        stopApp: false,
      };
      driver._cachedActivityArgs = {[`${appPackage}/${appActivity}`]: params};
      const getFocusedStub2 = sandbox
        .stub(driver.adb, 'getFocusedPackageAndActivity')
        .resolves({appPackage, appActivity});
      const goToHomeStub2 = sandbox.stub(driver.adb, 'goToHome');
      const sleepStub = sandbox.stub();
      const startAppStub2 = sandbox.stub(driver.adb, 'startApp');
      const activateAppStub2 = sandbox.stub(driver.adb, 'activateApp');
      const background = await mockBackground(sleepStub);
      await background.bind(driver)(10);
      assert.strictEqual(getFocusedStub2.calledOnce, true);
      assert.strictEqual(goToHomeStub2.calledOnce, true);
      assert.strictEqual(sleepStub.firstCall.args[0], 10_000);
      assert.strictEqual(startAppStub2.calledWithExactly(params), true);
      assert.strictEqual(activateAppStub2.notCalled, true);
    });
    it('should bring app to background and back if waiting for other pkg / activity', async function () {
      const appPackage = 'somepkg';
      const appActivity = 'someacv';
      const appWaitPackage = 'somewaitpkg';
      const appWaitActivity = 'somewaitacv';
      driver.opts = {
        appPackage,
        appActivity,
        appWaitPackage,
        appWaitActivity,
        intentAction: 'act',
        intentCategory: 'cat',
        intentFlags: 'flgs',
        optionalIntentArguments: 'opt',
        stopApp: false,
      } as any;
      const getFocusedStub3 = sandbox
        .stub(driver.adb, 'getFocusedPackageAndActivity')
        .resolves({appPackage: appWaitPackage, appActivity: appWaitActivity});
      const goToHomeStub3 = sandbox.stub(driver.adb, 'goToHome');
      const sleepStub = sandbox.stub();
      const startAppStub3 = sandbox.stub(driver.adb, 'startApp');
      const activateAppStub3 = sandbox.stub(driver.adb, 'activateApp');
      const background = await mockBackground(sleepStub);
      await background.bind(driver)(10);
      assert.strictEqual(getFocusedStub3.calledOnce, true);
      assert.strictEqual(goToHomeStub3.calledOnce, true);
      assert.strictEqual(sleepStub.firstCall.args[0], 10_000);
      assert.strictEqual(activateAppStub3.calledWithExactly(appWaitPackage), true);
      assert.strictEqual(startAppStub3.notCalled, true);
    });
    it('should not bring app back if seconds are negative', async function () {
      const goToHomeStub4 = sandbox.stub(driver.adb, 'goToHome');
      const startAppStub4 = sandbox.stub(driver.adb, 'startApp');
      const background = await mockBackground(sandbox.stub());
      await background.bind(driver)(-1);
      assert.strictEqual(goToHomeStub4.calledOnce, true);
      assert.strictEqual(startAppStub4.notCalled, true);
    });
  });
  describe('startActivity', function () {
    let params: any;
    beforeEach(function () {
      params = {
        pkg: 'pkg',
        activity: 'act',
        waitPkg: 'wpkg',
        waitActivity: 'wact',
        action: 'act',
        category: 'cat',
        flags: 'flgs',
        optionalIntentArguments: 'opt',
      };
    });
    it('should start activity', async function () {
      params.optionalIntentArguments = 'opt';
      params.stopApp = false;
      const startAppStub5 = sandbox.stub(driver.adb, 'startApp');
      await driver.startActivity('pkg', 'act', 'wpkg', 'wact', 'act', 'cat', 'flgs', 'opt', true);
      assert.strictEqual(startAppStub5.calledWithExactly(params), true);
    });
    it('should use dontStopAppOnReset from opts if it is not passed as param', async function () {
      driver.opts.dontStopAppOnReset = true;
      params.stopApp = false;
      const startAppStub6 = sandbox.stub(driver.adb, 'startApp');
      await driver.startActivity('pkg', 'act', 'wpkg', 'wact', 'act', 'cat', 'flgs', 'opt');
      assert.strictEqual(startAppStub6.calledWithExactly(params), true);
    });
    it('should use appPackage and appActivity if appWaitPackage and appWaitActivity are undefined', async function () {
      params.waitPkg = 'pkg';
      params.waitActivity = 'act';
      params.stopApp = true;
      const startAppStub7 = sandbox.stub(driver.adb, 'startApp');
      await driver.startActivity('pkg', 'act', undefined, undefined, 'act', 'cat', 'flgs', 'opt', false);
      assert.strictEqual(startAppStub7.calledWithExactly(params), true);
    });
  });

  describe('resetAUT', function () {
    const localApkPath = 'local';
    const pkg = 'pkg';

    afterEach(function () {
      sandbox.verifyAndRestore();
    });

    it('should complain if opts arent passed correctly', async function () {
      await assert.rejects(driver.resetAUT({} as any), /appPackage/);
    });
    it('should be able to do full reset', async function () {
      sandbox.stub(driver.adb, 'install').withArgs(localApkPath).onFirstCall();
      sandbox.stub(driver.adb, 'forceStop').withArgs(pkg).onFirstCall();
      sandbox.stub(driver.adb, 'isAppInstalled').withArgs(pkg).onFirstCall().resolves(true);
      sandbox.stub(driver.adb, 'uninstallApk').withArgs(pkg).onFirstCall();
      await driver.resetAUT({app: localApkPath, appPackage: pkg} as any);
    });
    it('should be able to do fast reset', async function () {
      sandbox.stub(driver.adb, 'isAppInstalled').withArgs(pkg).onFirstCall().resolves(true);
      sandbox.stub(driver.adb, 'forceStop').withArgs(pkg).onFirstCall();
      sandbox.stub(driver.adb, 'clear').withArgs(pkg).onFirstCall().resolves('Success');
      sandbox.stub(driver.adb, 'grantAllPermissions').withArgs(pkg).onFirstCall();
      await driver.resetAUT({
        app: localApkPath,
        appPackage: pkg,
        fastReset: true,
        autoGrantPermissions: true,
      } as any);
    });
    it('should perform reinstall if app is not installed and fast reset is requested', async function () {
      sandbox.stub(driver.adb, 'isAppInstalled').withArgs(pkg).onFirstCall().resolves(false);
      sandbox.stub(driver.adb, 'forceStop').throws();
      sandbox.stub(driver.adb, 'clear').throws();
      sandbox.stub(driver.adb, 'uninstallApk').throws();
      sandbox.stub(driver.adb, 'install').withArgs(localApkPath).onFirstCall();
      await driver.resetAUT({app: localApkPath, appPackage: pkg, fastReset: true} as any);
    });
  });

  describe('installAUT', function () {
    //use mock appium capabilities for this test
    const opts = {
      app: 'local',
      appPackage: 'pkg',
      androidInstallTimeout: 90000,
    };

    afterEach(function () {
      sandbox.verifyAndRestore();
    });

    it('should complain if appPackage is not passed', async function () {
      await assert.rejects(driver.installAUT({} as any), /appPackage/);
    });
    it('should install/upgrade and reset app if fast reset is set to true', async function () {
      sandbox
        .stub(driver.adb, 'installOrUpgrade')
        .withArgs(opts.app, opts.appPackage)
        .onFirstCall()
        .resolves({wasUninstalled: false, appState: 'sameVersionInstalled'});
      sandbox.stub(driver, 'resetAUT').onFirstCall();
      await driver.installAUT({...opts, fastReset: true} as any);
    });
    it('should reinstall app if full reset is set to true', async function () {
      sandbox.stub(driver.adb, 'installOrUpgrade').throws();
      sandbox.stub(driver, 'resetAUT').onFirstCall();
      await driver.installAUT({...opts, fastReset: true, fullReset: true} as any);
    });
    it('should not run reset if the corresponding option is not set', async function () {
      sandbox
        .stub(driver.adb, 'installOrUpgrade')
        .withArgs(opts.app, opts.appPackage)
        .onFirstCall()
        .resolves({wasUninstalled: true, appState: 'sameVersionInstalled'});
      sandbox.stub(driver, 'resetAUT').throws();
      await driver.installAUT(opts as any);
    });
    it('should install/upgrade and skip fast resetting the app if this was the fresh install', async function () {
      sandbox
        .stub(driver.adb, 'installOrUpgrade')
        .withArgs(opts.app, opts.appPackage)
        .onFirstCall()
        .resolves({wasUninstalled: false, appState: 'notInstalled'});
      sandbox.stub(driver, 'resetAUT').throws();
      await driver.installAUT({...opts, fastReset: true} as any);
    });
  });
  describe('installOtherApks', function () {
    const opts = {
      app: 'local',
      appPackage: 'pkg',
      androidInstallTimeout: 90000,
    };

    afterEach(function () {
      sandbox.verifyAndRestore();
    });

    const fakeApk = '/path/to/fake/app.apk';
    const otherFakeApk = '/path/to/other/fake/app.apk';

    const expectedADBInstallOpts = {
      allowTestPackages: undefined,
      grantPermissions: undefined,
      timeout: opts.androidInstallTimeout,
    };

    it('should not call adb.installOrUpgrade if otherApps is empty', async function () {
      sandbox.stub(driver.adb, 'installOrUpgrade').throws();
      await driver.installOtherApks([], opts as any);
    });
    it('should call adb.installOrUpgrade once if otherApps has one item', async function () {
      sandbox.stub(driver.adb, 'installOrUpgrade').withArgs(fakeApk, undefined, expectedADBInstallOpts).onFirstCall();
      await driver.installOtherApks([fakeApk], opts as any);
    });
    it('should call adb.installOrUpgrade twice if otherApps has two item', async function () {
      sandbox.stub(driver.adb, 'installOrUpgrade');
      await driver.installOtherApks([fakeApk, otherFakeApk], opts as any);
      assert.strictEqual((driver.adb.installOrUpgrade as sinon.SinonStub).calledTwice, true);
    });
  });
});
