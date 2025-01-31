import sinon from 'sinon';
import {AndroidDriver} from '../../../lib/driver';
import {fs} from '@appium/support';
import B from 'bluebird';
import {ADB} from 'appium-adb';

/** @type {AndroidDriver} */
let driver;
let sandbox = sinon.createSandbox();

describe('App Management', function () {
  let chai;

  before(async function () {
    chai = await import('chai');
    const chaiAsPromised = await import('chai-as-promised');

    chai.should();
    chai.use(chaiAsPromised.default);
  });

  beforeEach(function () {
    driver = new AndroidDriver();
    driver.adb = new ADB();
    driver.caps = {};
    driver.opts = {};
  });
  afterEach(function () {
    sandbox.verifyAndRestore();
  });
  describe('getCurrentActivity', function () {
    it('should get current activity', async function () {
      sandbox.stub(driver.adb, 'getFocusedPackageAndActivity').returns({appActivity: 'act'});
      await driver.getCurrentActivity().should.eventually.be.equal('act');
    });
  });
  describe('getCurrentPackage', function () {
    it('should get current activity', async function () {
      sandbox.stub(driver.adb, 'getFocusedPackageAndActivity').returns({appPackage: 'pkg'});
      await driver.getCurrentPackage().should.eventually.equal('pkg');
    });
  });
  describe('isAppInstalled', function () {
    it('should return true if app is installed', async function () {
      sandbox.stub(driver.adb, 'isAppInstalled').withArgs('pkg').returns(true);
      (await driver.isAppInstalled('pkg')).should.be.true;
    });
    it('should return true if app is installed with undefined user', async function () {
      sandbox.stub(driver.adb, 'isAppInstalled').withArgs('pkg').returns(true);
      (await driver.isAppInstalled('pkg', {})).should.be.true;
    });
    it('should return true if app is installed with user string', async function () {
      sandbox.stub(driver.adb, 'isAppInstalled').withArgs('pkg', {user: '1'}).returns(true);
      (await driver.isAppInstalled('pkg', {user: '1'})).should.be.true;
    });
    it('should return true if app is installed with user number', async function () {
      sandbox.stub(driver.adb, 'isAppInstalled').withArgs('pkg', {user: 1}).returns(true);
      (await driver.isAppInstalled('pkg', {user: 1})).should.be.true;
    });
  });
  describe('mobileIsAppInstalled', function () {
    it('should return true if app is installed', async function () {
      sandbox.stub(driver.adb, 'isAppInstalled').withArgs('pkg').returns(true);
      (await driver.mobileIsAppInstalled('pkg')).should.be.true;
    });
    it('should return true if app is installed with undefined user', async function () {
      sandbox.stub(driver.adb, 'isAppInstalled').withArgs('pkg').returns(true);
      (await driver.mobileIsAppInstalled('pkg')).should.be.true;
    });
    it('should return true if app is installed with user string', async function () {
      sandbox.stub(driver.adb, 'isAppInstalled').withArgs('pkg', {user: '1'}).returns(true);
      (await driver.mobileIsAppInstalled('pkg', '1')).should.be.true;
    });
    it('should return true if app is installed with user number', async function () {
      sandbox.stub(driver.adb, 'isAppInstalled').withArgs('pkg', {user: '1'}).returns(true);
      (await driver.mobileIsAppInstalled('pkg', 1)).should.be.true;
    });
  });
  describe('removeApp', function () {
    it('should remove app', async function () {
      sandbox.stub(driver.adb, 'uninstallApk').withArgs('pkg').returns(true);
      (await driver.removeApp('pkg')).should.be.true;
    });
  });
  describe('installApp', function () {
    it('should install app', async function () {
      let app = 'app.apk';
      sandbox.stub(driver.helpers, 'configureApp').withArgs(app, '.apk').returns(app);
      sandbox.stub(fs, 'rimraf').returns();
      sandbox.stub(driver.adb, 'install').returns(true);
      await driver.installApp(app);
      driver.helpers.configureApp.calledOnce.should.be.true;
      fs.rimraf.notCalled.should.be.true;
      driver.adb.install.calledOnce.should.be.true;
    });
    it('should throw an error if APK does not exist', async function () {
      await driver
        .installApp('non/existent/app.apk')
        .should.be.rejectedWith(/does not exist or is not accessible/);
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
      };
      sandbox.stub(driver.adb, 'goToHome');
      sandbox.stub(driver.adb, 'getFocusedPackageAndActivity').returns({appPackage, appActivity});
      sandbox.stub(B, 'delay');
      sandbox.stub(driver.adb, 'startApp');
      sandbox.stub(driver.adb, 'activateApp');
      await driver.background(10);
      driver.adb.getFocusedPackageAndActivity.calledOnce.should.be.true;
      driver.adb.goToHome.calledOnce.should.be.true;
      B.delay.calledWithExactly(10000).should.be.true;
      driver.adb.activateApp.calledWithExactly(appPackage).should.be.true;
      driver.adb.startApp.notCalled.should.be.true;
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
      };
      let params = {
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
      sandbox.stub(driver.adb, 'goToHome');
      sandbox.stub(driver.adb, 'getFocusedPackageAndActivity').returns({appPackage, appActivity});
      sandbox.stub(B, 'delay');
      sandbox.stub(driver.adb, 'startApp');
      sandbox.stub(driver.adb, 'activateApp');
      await driver.background(10);
      driver.adb.getFocusedPackageAndActivity.calledOnce.should.be.true;
      driver.adb.goToHome.calledOnce.should.be.true;
      B.delay.calledWithExactly(10000).should.be.true;
      driver.adb.startApp.calledWithExactly(params).should.be.true;
      driver.adb.activateApp.notCalled.should.be.true;
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
      };
      sandbox.stub(driver.adb, 'goToHome');
      sandbox
        .stub(driver.adb, 'getFocusedPackageAndActivity')
        .returns({appPackage: appWaitPackage, appActivity: appWaitActivity});
      sandbox.stub(B, 'delay');
      sandbox.stub(driver.adb, 'startApp');
      sandbox.stub(driver.adb, 'activateApp');
      await driver.background(10);
      driver.adb.getFocusedPackageAndActivity.calledOnce.should.be.true;
      driver.adb.goToHome.calledOnce.should.be.true;
      B.delay.calledWithExactly(10000).should.be.true;
      driver.adb.activateApp.calledWithExactly(appWaitPackage).should.be.true;
      driver.adb.startApp.notCalled.should.be.true;
    });
    it('should not bring app back if seconds are negative', async function () {
      sandbox.stub(driver.adb, 'goToHome');
      sandbox.stub(driver.adb, 'startApp');
      await driver.background(-1);
      driver.adb.goToHome.calledOnce.should.be.true;
      driver.adb.startApp.notCalled.should.be.true;
    });
  });
  describe('startActivity', function () {
    let params;
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
      sandbox.stub(driver.adb, 'startApp');
    });
    it('should start activity', async function () {
      params.optionalIntentArguments = 'opt';
      params.stopApp = false;
      await driver.startActivity('pkg', 'act', 'wpkg', 'wact', 'act', 'cat', 'flgs', 'opt', true);
      driver.adb.startApp.calledWithExactly(params).should.be.true;
    });
    it('should use dontStopAppOnReset from opts if it is not passed as param', async function () {
      driver.opts.dontStopAppOnReset = true;
      params.stopApp = false;
      await driver.startActivity('pkg', 'act', 'wpkg', 'wact', 'act', 'cat', 'flgs', 'opt');
      driver.adb.startApp.calledWithExactly(params).should.be.true;
    });
    it('should use appPackage and appActivity if appWaitPackage and appWaitActivity are undefined', async function () {
      params.waitPkg = 'pkg';
      params.waitActivity = 'act';
      params.stopApp = true;
      await driver.startActivity('pkg', 'act', null, null, 'act', 'cat', 'flgs', 'opt', false);
      driver.adb.startApp.calledWithExactly(params).should.be.true;
    });
  });

  describe('resetAUT', function() {
    const localApkPath = 'local';
    const pkg = 'pkg';

    afterEach(function () {
      sandbox.verifyAndRestore();
    });

    it('should complain if opts arent passed correctly', async function () {
      await driver.resetAUT({}).should.be.rejectedWith(/appPackage/);
    });
    it('should be able to do full reset', async function () {
      sandbox.stub(driver.adb, 'install').withArgs(localApkPath).onFirstCall();
      sandbox.stub(driver.adb, 'forceStop').withArgs(pkg).onFirstCall();
      sandbox.stub(driver.adb, 'isAppInstalled').withArgs(pkg).onFirstCall().returns(true);
      sandbox.stub(driver.adb, 'uninstallApk').withArgs(pkg).onFirstCall();
      await driver.resetAUT({app: localApkPath, appPackage: pkg});
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
      });
    });
    it('should perform reinstall if app is not installed and fast reset is requested', async function () {
      sandbox.stub(driver.adb, 'isAppInstalled').withArgs(pkg).onFirstCall().returns(false);
      sandbox.stub(driver.adb, 'forceStop').throws();
      sandbox.stub(driver.adb, 'clear').throws();
      sandbox.stub(driver.adb, 'uninstallApk').throws();
      sandbox.stub(driver.adb, 'install').withArgs(localApkPath).onFirstCall();
      await driver.resetAUT({app: localApkPath, appPackage: pkg, fastReset: true});
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
      await driver.installAUT({}).should.be.rejectedWith(/appPackage/);
    });
    it('should install/upgrade and reset app if fast reset is set to true', async function () {
      sandbox.stub(driver.adb, 'installOrUpgrade')
        .withArgs(opts.app, opts.appPackage)
        .onFirstCall()
        .returns({wasUninstalled: false, appState: 'sameVersionInstalled'});
      sandbox.stub(driver, 'resetAUT').onFirstCall();
      await driver.installAUT(Object.assign({}, opts, {fastReset: true}));
    });
    it('should reinstall app if full reset is set to true', async function () {
      sandbox.stub(driver.adb, 'installOrUpgrade').throws();
      sandbox.stub(driver, 'resetAUT').onFirstCall();
      await driver.installAUT(Object.assign({}, opts, {fastReset: true, fullReset: true}));
    });
    it('should not run reset if the corresponding option is not set', async function () {
      sandbox.stub(driver.adb, 'installOrUpgrade')
        .withArgs(opts.app, opts.appPackage)
        .onFirstCall()
        .returns({wasUninstalled: true, appState: 'sameVersionInstalled'});
      sandbox.stub(driver, 'resetAUT').throws();
      await driver.installAUT(opts);
    });
    it('should install/upgrade and skip fast resetting the app if this was the fresh install', async function () {
      sandbox.stub(driver.adb, 'installOrUpgrade')
        .withArgs(opts.app, opts.appPackage)
        .onFirstCall()
        .returns({wasUninstalled: false, appState: 'notInstalled'});
      sandbox.stub(driver, 'resetAUT').throws();
      await driver.installAUT(Object.assign({}, opts, {fastReset: true}));
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
      await driver.installOtherApks([], opts);
    });
    it('should call adb.installOrUpgrade once if otherApps has one item', async function () {
      sandbox.stub(driver.adb, 'installOrUpgrade')
        .withArgs(fakeApk, undefined, expectedADBInstallOpts)
        .onFirstCall();
      await driver.installOtherApks([fakeApk], opts);
    });
    it('should call adb.installOrUpgrade twice if otherApps has two item', async function () {
      sandbox.stub(driver.adb, 'installOrUpgrade');
      await driver.installOtherApks([fakeApk, otherFakeApk], opts);
      driver.adb.installOrUpgrade.calledTwice.should.be.true;
    });
  });
});
