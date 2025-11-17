import sinon from 'sinon';
import {AndroidDriver} from '../../../lib/driver';
import {fs} from '@appium/support';
import B from 'bluebird';
import {ADB} from 'appium-adb';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';

use(chaiAsPromised);

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
      sandbox.stub(driver.adb, 'getFocusedPackageAndActivity').returns({appActivity: 'act'});
      await expect(driver.getCurrentActivity()).to.eventually.equal('act');
    });
  });
  describe('getCurrentPackage', function () {
    it('should get current activity', async function () {
      sandbox.stub(driver.adb, 'getFocusedPackageAndActivity').returns({appPackage: 'pkg'});
      await expect(driver.getCurrentPackage()).to.eventually.equal('pkg');
    });
  });
  describe('isAppInstalled', function () {
    it('should return true if app is installed', async function () {
      sandbox.stub(driver.adb, 'isAppInstalled').withArgs('pkg').returns(true);
      expect(await driver.isAppInstalled('pkg')).to.be.true;
    });
    it('should return true if app is installed with undefined user', async function () {
      sandbox.stub(driver.adb, 'isAppInstalled').withArgs('pkg').returns(true);
      expect(await driver.isAppInstalled('pkg', {})).to.be.true;
    });
    it('should return true if app is installed with user string', async function () {
      sandbox.stub(driver.adb, 'isAppInstalled').withArgs('pkg', {user: '1'}).returns(true);
      expect(await driver.isAppInstalled('pkg', {user: '1'})).to.be.true;
    });
    it('should return true if app is installed with user number', async function () {
      const stub = sandbox.stub(driver.adb, 'isAppInstalled');
      stub.withArgs('pkg', sinon.match({user: '1'})).returns(true);
      stub.withArgs('pkg', sinon.match({user: sinon.match.any})).returns(true);
      expect(await driver.isAppInstalled('pkg', {user: 1} as any)).to.be.true;
    });
  });
  describe('mobileIsAppInstalled', function () {
    it('should return true if app is installed', async function () {
      sandbox.stub(driver.adb, 'isAppInstalled').withArgs('pkg').returns(true);
      expect(await driver.mobileIsAppInstalled('pkg')).to.be.true;
    });
    it('should return true if app is installed with undefined user', async function () {
      sandbox.stub(driver.adb, 'isAppInstalled').withArgs('pkg').returns(true);
      expect(await driver.mobileIsAppInstalled('pkg')).to.be.true;
    });
    it('should return true if app is installed with user string', async function () {
      sandbox.stub(driver.adb, 'isAppInstalled').withArgs('pkg', {user: '1'}).returns(true);
      expect(await driver.mobileIsAppInstalled('pkg', '1')).to.be.true;
    });
    it('should return true if app is installed with user number', async function () {
      sandbox.stub(driver.adb, 'isAppInstalled').withArgs('pkg', {user: '1'}).returns(true);
      expect(await driver.mobileIsAppInstalled('pkg', 1)).to.be.true;
    });
  });
  describe('removeApp', function () {
    it('should remove app', async function () {
      sandbox.stub(driver.adb, 'uninstallApk').withArgs('pkg').returns(true);
      expect(await driver.removeApp('pkg')).to.be.true;
    });
  });
  describe('installApp', function () {
    it('should install app', async function () {
      const app = 'app.apk';
      driver.helpers = {configureApp: sandbox.stub().withArgs(app, '.apk').resolves(app)} as any;
      const configureAppStub = driver.helpers.configureApp as sinon.SinonStub;
      const rimrafStub = sandbox.stub(fs, 'rimraf').returns();
      const installStub = sandbox.stub(driver.adb, 'install').resolves();
      await driver.installApp(app, {});
      expect(configureAppStub.calledOnce).to.be.true;
      expect(rimrafStub.notCalled).to.be.true;
      expect(installStub.calledOnce).to.be.true;
    });
    it('should throw an error if APK does not exist', async function () {
      driver.helpers = {configureApp: sandbox.stub().rejects(new Error('does not exist or is not accessible'))} as any;
      await expect(driver.installApp('non/existent/app.apk', {})
      ).to.be.rejectedWith(/does not exist or is not accessible/);
    });
  });
  describe('background', function () {
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
      const getFocusedStub = sandbox.stub(driver.adb, 'getFocusedPackageAndActivity').returns({appPackage, appActivity});
      const goToHomeStub = sandbox.stub(driver.adb, 'goToHome');
      const delayStub = sandbox.stub(B, 'delay');
      const startAppStub = sandbox.stub(driver.adb, 'startApp');
      const activateAppStub = sandbox.stub(driver.adb, 'activateApp');
      await driver.background(10);
      expect(getFocusedStub.calledOnce).to.be.true;
      expect(goToHomeStub.calledOnce).to.be.true;
      expect(delayStub.calledWithExactly(10000)).to.be.true;
      expect(activateAppStub.calledWithExactly(appPackage)).to.be.true;
      expect(startAppStub.notCalled).to.be.true;
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
      const getFocusedStub2 = sandbox.stub(driver.adb, 'getFocusedPackageAndActivity').returns({appPackage, appActivity});
      const goToHomeStub2 = sandbox.stub(driver.adb, 'goToHome');
      const delayStub2 = sandbox.stub(B, 'delay');
      const startAppStub2 = sandbox.stub(driver.adb, 'startApp');
      const activateAppStub2 = sandbox.stub(driver.adb, 'activateApp');
      await driver.background(10);
      expect(getFocusedStub2.calledOnce).to.be.true;
      expect(goToHomeStub2.calledOnce).to.be.true;
      expect(delayStub2.calledWithExactly(10000)).to.be.true;
      expect(startAppStub2.calledWithExactly(params)).to.be.true;
      expect(activateAppStub2.notCalled).to.be.true;
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
        .returns({appPackage: appWaitPackage, appActivity: appWaitActivity});
      const goToHomeStub3 = sandbox.stub(driver.adb, 'goToHome');
      const delayStub3 = sandbox.stub(B, 'delay');
      const startAppStub3 = sandbox.stub(driver.adb, 'startApp');
      const activateAppStub3 = sandbox.stub(driver.adb, 'activateApp');
      await driver.background(10);
      expect(getFocusedStub3.calledOnce).to.be.true;
      expect(goToHomeStub3.calledOnce).to.be.true;
      expect(delayStub3.calledWithExactly(10000)).to.be.true;
      expect(activateAppStub3.calledWithExactly(appWaitPackage)).to.be.true;
      expect(startAppStub3.notCalled).to.be.true;
    });
    it('should not bring app back if seconds are negative', async function () {
      const goToHomeStub4 = sandbox.stub(driver.adb, 'goToHome');
      const startAppStub4 = sandbox.stub(driver.adb, 'startApp');
      await driver.background(-1);
      expect(goToHomeStub4.calledOnce).to.be.true;
      expect(startAppStub4.notCalled).to.be.true;
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
      expect(startAppStub5.calledWithExactly(params)).to.be.true;
    });
    it('should use dontStopAppOnReset from opts if it is not passed as param', async function () {
      driver.opts.dontStopAppOnReset = true;
      params.stopApp = false;
      const startAppStub6 = sandbox.stub(driver.adb, 'startApp');
      await driver.startActivity('pkg', 'act', 'wpkg', 'wact', 'act', 'cat', 'flgs', 'opt');
      expect(startAppStub6.calledWithExactly(params)).to.be.true;
    });
    it('should use appPackage and appActivity if appWaitPackage and appWaitActivity are undefined', async function () {
      params.waitPkg = 'pkg';
      params.waitActivity = 'act';
      params.stopApp = true;
      const startAppStub7 = sandbox.stub(driver.adb, 'startApp');
      await driver.startActivity('pkg', 'act', undefined, undefined, 'act', 'cat', 'flgs', 'opt', false);
      expect(startAppStub7.calledWithExactly(params)).to.be.true;
    });
  });

  describe('resetAUT', function() {
    const localApkPath = 'local';
    const pkg = 'pkg';

    afterEach(function () {
      sandbox.verifyAndRestore();
    });

    it('should complain if opts arent passed correctly', async function () {
      await expect(driver.resetAUT({} as any)).to.be.rejectedWith(/appPackage/);
    });
    it('should be able to do full reset', async function () {
      sandbox.stub(driver.adb, 'install').withArgs(localApkPath).onFirstCall();
      sandbox.stub(driver.adb, 'forceStop').withArgs(pkg).onFirstCall();
      sandbox.stub(driver.adb, 'isAppInstalled').withArgs(pkg).onFirstCall().returns(true);
      sandbox.stub(driver.adb, 'uninstallApk').withArgs(pkg).onFirstCall();
      await driver.resetAUT({app: localApkPath, appPackage: pkg} as any);
    });
    it('should be able to do fast reset', async function () {
      sandbox.stub(driver.adb, 'isAppInstalled').withArgs(pkg).onFirstCall().returns(true);
      sandbox.stub(driver.adb, 'forceStop').withArgs(pkg).onFirstCall();
      sandbox.stub(driver.adb, 'clear').withArgs(pkg).onFirstCall().returns('Success');
      sandbox.stub(driver.adb, 'grantAllPermissions').withArgs(pkg).onFirstCall();
      await driver.resetAUT({
        app: localApkPath,
        appPackage: pkg,
        fastReset: true,
        autoGrantPermissions: true,
      } as any);
    });
    it('should perform reinstall if app is not installed and fast reset is requested', async function () {
      sandbox.stub(driver.adb, 'isAppInstalled').withArgs(pkg).onFirstCall().returns(false);
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
      await expect(driver.installAUT({} as any)).to.be.rejectedWith(/appPackage/);
    });
    it('should install/upgrade and reset app if fast reset is set to true', async function () {
      sandbox.stub(driver.adb, 'installOrUpgrade')
        .withArgs(opts.app, opts.appPackage)
        .onFirstCall()
        .returns({wasUninstalled: false, appState: 'sameVersionInstalled'});
      sandbox.stub(driver, 'resetAUT').onFirstCall();
      await driver.installAUT({ ...opts, fastReset: true } as any);
    });
    it('should reinstall app if full reset is set to true', async function () {
      sandbox.stub(driver.adb, 'installOrUpgrade').throws();
      sandbox.stub(driver, 'resetAUT').onFirstCall();
      await driver.installAUT({ ...opts, fastReset: true, fullReset: true } as any);
    });
    it('should not run reset if the corresponding option is not set', async function () {
      sandbox.stub(driver.adb, 'installOrUpgrade')
        .withArgs(opts.app, opts.appPackage)
        .onFirstCall()
        .returns({wasUninstalled: true, appState: 'sameVersionInstalled'});
      sandbox.stub(driver, 'resetAUT').throws();
      await driver.installAUT(opts as any);
    });
    it('should install/upgrade and skip fast resetting the app if this was the fresh install', async function () {
      sandbox.stub(driver.adb, 'installOrUpgrade')
        .withArgs(opts.app, opts.appPackage)
        .onFirstCall()
        .returns({wasUninstalled: false, appState: 'notInstalled'});
      sandbox.stub(driver, 'resetAUT').throws();
      await driver.installAUT({ ...opts, fastReset: true } as any);
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
      sandbox.stub(driver.adb, 'installOrUpgrade')
        .withArgs(fakeApk, undefined, expectedADBInstallOpts)
        .onFirstCall();
      await driver.installOtherApks([fakeApk], opts as any);
    });
    it('should call adb.installOrUpgrade twice if otherApps has two item', async function () {
      sandbox.stub(driver.adb, 'installOrUpgrade');
      await driver.installOtherApks([fakeApk, otherFakeApk], opts as any);
      expect((driver.adb.installOrUpgrade as sinon.SinonStub).calledTwice).to.be.true;
    });
  });
});

