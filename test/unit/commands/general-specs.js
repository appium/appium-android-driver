import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import AndroidDriver from '../../..';
import { parseSurfaceLine, parseWindows } from '../../../lib/commands/general';
import helpers from '../../../lib/android-helpers';
import { withMocks } from 'appium-test-support';
import { fs } from 'appium-support';
import Bootstrap from 'appium-android-bootstrap';
import B from 'bluebird';
import ADB from 'appium-adb';

chai.should();
chai.use(chaiAsPromised);

let driver;
let sandbox = sinon.sandbox.create();
let expect = chai.expect;

describe('General', () => {
  beforeEach(() => {
    driver = new AndroidDriver();
    driver.bootstrap = new Bootstrap();
    driver.adb = new ADB();
    driver.caps = {};
    driver.opts = {};
  });
  afterEach(() => {
    sandbox.restore();
  });
  describe('keys', () => {
    it('should send keys via setText bootstrap command', async () => {
      sandbox.stub(driver.bootstrap, 'sendAction');
      driver.opts.unicodeKeyboard = true;
      await driver.keys('keys');
      driver.bootstrap.sendAction
        .calledWithExactly('setText',
          {text: 'keys', replace: false, unicodeKeyboard: true})
        .should.be.true;
    });
    it('should join keys if keys is array', async () => {
      sandbox.stub(driver.bootstrap, 'sendAction');
      driver.opts.unicodeKeyboard = false;
      await driver.keys(['k', 'e', 'y', 's']);
      driver.bootstrap.sendAction
        .calledWithExactly('setText', {text: 'keys', replace: false})
        .should.be.true;
    });
  });
  describe('getDeviceTime', () => {
    it('should return device time', async () => {
      sandbox.stub(driver.adb, 'shell');
      driver.adb.shell.returns(' 11:12 ');
      await driver.getDeviceTime().should.become('11:12');
      driver.adb.shell.calledWithExactly(['date']).should.be.true;
    });
    it('should thorws error if shell command failed', async () => {
      sandbox.stub(driver.adb, 'shell').throws();
      await driver.getDeviceTime().should.be.rejectedWith('Could not capture');
    });
  });
  describe('getPageSource', () => {
    it('should return page source', async () => {
      sandbox.stub(driver.bootstrap, 'sendAction').withArgs('source').returns('sources');
      await driver.getPageSource().should.be.equal('sources');
    });
  });
  describe('back', () => {
    it('should press back', async () => {
      sandbox.stub(driver.bootstrap, 'sendAction');
      await driver.back();
      driver.bootstrap.sendAction.calledWithExactly('pressBack').should.be.true;
    });
  });
  describe('isKeyboardShown', () => {
    it('should return true if the keyboard is shown', async () => {
      driver.adb.isSoftKeyboardPresent = () => { return {isKeyboardShown: true, canCloseKeyboard: true}; };
      (await driver.isKeyboardShown()).should.equal(true);
    });
    it('should return false if the keyboard is not shown', async () => {
      driver.adb.isSoftKeyboardPresent = () => { return {isKeyboardShown: false, canCloseKeyboard: true}; };
      (await driver.isKeyboardShown()).should.equal(false);
    });
  });
  describe('hideKeyboard', () => {
    it('should hide keyboard via back command', async () => {
      sandbox.stub(driver, 'back');
      driver.adb.isSoftKeyboardPresent = () => { return {isKeyboardShown: true, canCloseKeyboard: true}; };
      await driver.hideKeyboard();
      driver.back.calledOnce.should.be.true;
    });
    it('should not call back command if can\'t close keyboard', async () => {
      sandbox.stub(driver, 'back');
      driver.adb.isSoftKeyboardPresent = () => { return {isKeyboardShown: true, canCloseKeyboard: false}; };
      await driver.hideKeyboard();
      driver.back.notCalled.should.be.true;
    });
    it('should throw an error if no keyboard is present', async () => {
      driver.adb.isSoftKeyboardPresent = () => { return false; };
      await driver.hideKeyboard().should.be.rejectedWith(/not present/);
    });
  });
  describe('openSettingsActivity', () => {
    it('should open settings activity', async () => {
      sandbox.stub(driver.adb, 'getFocusedPackageAndActivity')
        .returns({appPackage: 'pkg', appActivity: 'act'});
      sandbox.stub(driver.adb, 'shell');
      sandbox.stub(driver.adb, 'waitForNotActivity');
      await driver.openSettingsActivity('set1');
      driver.adb.shell.calledWithExactly(['am', 'start', '-a', 'android.settings.set1'])
        .should.be.true;
      driver.adb.waitForNotActivity.calledWithExactly('pkg', 'act', 5000)
        .should.be.true;
    });
  });
  describe('getWindowSize', () => {
    it('should get window size', async () => {
      sandbox.stub(driver.bootstrap, 'sendAction')
        .withArgs('getDeviceSize').returns('size');
      await driver.getWindowSize().should.be.equal('size');
    });
  });
  describe('getCurrentActivity', () => {
    it('should get current activity', async () => {
      sandbox.stub(driver.adb, 'getFocusedPackageAndActivity')
        .returns({appActivity: 'act'});
      await driver.getCurrentActivity().should.eventually.be.equal('act');
    });
  });
  describe('getCurrentPackage', () => {
    it('should get current activity', async () => {
      sandbox.stub(driver.adb, 'getFocusedPackageAndActivity')
        .returns({appPackage: 'pkg'});
      await driver.getCurrentPackage().should.eventually.equal('pkg');
    });
  });
  describe('getLogTypes', () => {
    it('should get log types', async () => {
      await driver.getLogTypes().should.be.deep.equal(['logcat']);
    });
  });
  describe('getLog', () => {
    it('should get log types', async () => {
      sandbox.stub(driver.adb, 'getLogcatLogs').returns('logs');
      await driver.getLog('logcat').should.be.equal('logs');
    });
    it('should throws exception if log type is unsupported', async () => {
      expect(() => driver.getLog('unsupported_type'))
        .to.throw('Unsupported log type unsupported_type');
    });
  });
  describe('isAppInstalled', () => {
    it('should return true if app is installed', async () => {
      sandbox.stub(driver.adb, 'isAppInstalled').withArgs('pkg').returns(true);
      await driver.isAppInstalled('pkg').should.be.true;
    });
  });
  describe('removeApp', () => {
    it('should remove app', async () => {
      sandbox.stub(driver.adb, 'uninstallApk').withArgs('pkg').returns(true);
      await driver.removeApp('pkg').should.be.true;
    });
  });
  describe('installApp', () => {
    it('should install app', async () => {
      driver.opts.fastReset = 'fastReset';
      let app = 'app.apk';
      let opts = {app: 'app.apk', appPackage: 'pkg', fastReset: 'fastReset'};
      sandbox.stub(driver.helpers, 'configureApp').withArgs('app', '.apk')
        .returns(app);
      sandbox.stub(fs, 'exists').withArgs(app).returns(true);
      sandbox.stub(driver.adb, 'packageAndLaunchActivityFromManifest')
        .withArgs(app).returns({apkPackage: 'pkg'});
      sandbox.stub(helpers, 'installApkRemotely')
        .returns(true);
      await driver.installApp('app').should.eventually.be.true;
      driver.helpers.configureApp.calledOnce.should.be.true;
      fs.exists.calledOnce.should.be.true;
      driver.adb.packageAndLaunchActivityFromManifest.calledOnce.should.be.true;
      helpers.installApkRemotely.calledWithExactly(driver.adb, opts)
        .should.be.true;
    });
    it('should throw an error if APK does not exist', async () => {
      await driver.installApp('non/existent/app.apk').should.be.rejectedWith(/Could not find/);
    });
  });
  describe('background', () => {
    it('should bring app to background', async () => {
      driver.opts = {appPackage: 'pkg', appActivity: 'acv', intentAction: 'act',
                     intentCategory: 'cat', intentFlags: 'flgs',
                     optionalIntentArguments: 'opt'};
      let params = {pkg: 'pkg', activity: 'acv', action: 'act', category: 'cat',
                    flags: 'flgs', waitPkg: 'wpkg', waitActivity: 'wacv',
                    optionalIntentArguments: 'opt', stopApp: false};
      sandbox.stub(driver.adb, 'goToHome');
      sandbox.stub(driver.adb, 'getFocusedPackageAndActivity')
        .returns({appPackage: 'wpkg', appActivity: 'wacv'});
      sandbox.stub(B, 'delay');
      sandbox.stub(driver.adb, 'startApp');
      await driver.background(10);
      driver.adb.getFocusedPackageAndActivity.calledOnce.should.be.true;
      driver.adb.goToHome.calledOnce.should.be.true;
      B.delay.calledWithExactly(10000).should.be.true;
      driver.adb.startApp.calledWithExactly(params).should.be.true;
    });
    it('should not bring app back if seconds are negative', async () => {
      sandbox.stub(driver.adb, 'goToHome');
      sandbox.stub(driver.adb, 'startApp');
      await driver.background(-1);
      driver.adb.goToHome.calledOnce.should.be.true;
      driver.adb.startApp.notCalled.should.be.true;
    });
  });
  describe('getStrings', withMocks({helpers}, (mocks) => {
    it('should return app strings', async () => {
      driver.bootstrap.sendAction = () => { return ''; };
      mocks.helpers.expects("pushStrings")
          .returns({'test': 'en_value'});
      let strings = await driver.getStrings('en');
      strings.test.should.equal('en_value');
      mocks.helpers.verify();
    });
    it('should return cached app strings for the specified language', async () => {
      driver.adb.getDeviceLanguage = () => { return 'en'; };
      driver.apkStrings.en = {'test': 'en_value'};
      driver.apkStrings.fr = {'test': 'fr_value'};
      let strings = await driver.getStrings('fr');
      strings.test.should.equal('fr_value');
    });
    it('should return cached app strings for the device language', async () => {
      driver.adb.getDeviceLanguage = () => { return 'en'; };
      driver.apkStrings.en = {'test': 'en_value'};
      driver.apkStrings.fr = {'test': 'fr_value'};
      let strings = await driver.getStrings();
      strings.test.should.equal('en_value');
    });
  }));
  describe('launchApp', () => {
    it('should init and start app', async () => {
      sandbox.stub(driver, 'initAUT');
      sandbox.stub(driver, 'startAUT');
      await driver.launchApp();
      driver.initAUT.calledOnce.should.be.true;
      driver.startAUT.calledOnce.should.be.true;
    });
  });
  describe('startActivity', () => {
    let params;
    beforeEach(() => {
      params = {pkg: 'pkg', activity: 'act', waitPkg: 'wpkg', waitActivity: 'wact',
                action: 'act', category: 'cat', flags: 'flgs', optionalIntentArguments: 'opt'};
      sandbox.stub(driver.adb, 'startApp');
    });
    it('should start activity', async () => {
      params.optionalIntentArguments = 'opt';
      params.stopApp = false;
      await driver.startActivity('pkg', 'act', 'wpkg', 'wact', 'act',
        'cat', 'flgs', 'opt', true);
      driver.adb.startApp.calledWithExactly(params).should.be.true;
    });
    it('should use dontStopAppOnReset from opts if it is not passed as param', async () => {
      driver.opts.dontStopAppOnReset = true;
      params.stopApp = false;
      await driver.startActivity('pkg', 'act', 'wpkg', 'wact', 'act', 'cat', 'flgs', 'opt');
      driver.adb.startApp.calledWithExactly(params).should.be.true;
    });
    it('should use appPackage and appActivity if appWaitPackage and appWaitActivity are undefined', async () => {
      params.waitPkg = 'pkg';
      params.waitActivity = 'act';
      params.stopApp = true;
      await driver.startActivity('pkg', 'act', null, null, 'act', 'cat', 'flgs', 'opt', false);
      driver.adb.startApp.calledWithExactly(params).should.be.true;
    });
  });
  describe('reset', () => {
    it('should reset app via reinstall if fullReset is true', async () => {
      driver.opts.fullReset = true;
      driver.opts.appPackage = 'pkg';
      sandbox.stub(driver.adb, 'stopAndClear');
      sandbox.stub(driver.adb, 'uninstallApk');
      sandbox.stub(helpers, 'installApkRemotely');
      sandbox.stub(driver, 'grantPermissions');
      sandbox.stub(driver, 'startAUT').returns('aut');
      await driver.reset().should.eventually.be.equal('aut');
      driver.adb.stopAndClear.calledWithExactly('pkg').should.be.true;
      driver.adb.uninstallApk.calledWithExactly('pkg').should.be.true;
      helpers.installApkRemotely.calledWithExactly(driver.adb, driver.opts)
        .should.be.true;
      driver.grantPermissions.calledOnce.should.be.true;
      driver.startAUT.calledOnce.should.be.true;
    });
    it('should do fast reset if fullReset is false', async () => {
      driver.opts.fullReset = false;
      driver.opts.appPackage = 'pkg';
      sandbox.stub(driver.adb, 'stopAndClear');
      sandbox.stub(driver, 'grantPermissions');
      sandbox.stub(driver, 'startAUT').returns('aut');
      await driver.reset().should.eventually.be.equal('aut');
      driver.adb.stopAndClear.calledWithExactly('pkg').should.be.true;
      driver.grantPermissions.calledOnce.should.be.true;
      driver.startAUT.calledOnce.should.be.true;
    });
  });
  describe('startAUT', () => {
    it('should start AUT', async () => {
      driver.opts = {appPackage: 'pkg', appActivity: 'act', intentAction: 'actn',
                     intentCategory: 'cat', intentFlags: 'flgs', appWaitPackage: 'wpkg',
                     appWaitActivity: 'wact', appWaitDuration: 'wdur',
                     optionalIntentArguments: 'opt'};
      let params = {pkg: 'pkg', activity: 'act', action: 'actn', category: 'cat',
                    flags: 'flgs', waitPkg: 'wpkg', waitActivity: 'wact',
                    waitDuration: 'wdur', optionalIntentArguments: 'opt', stopApp: false};
      driver.opts.dontStopAppOnReset = true;
      params.stopApp = false;
      sandbox.stub(driver.adb, 'startApp');
      await driver.startAUT();
      driver.adb.startApp.calledWithExactly(params).should.be.true;
    });
  });
  describe('setUrl', () => {
    it('should set url', async () => {
      driver.opts = {appPackage: 'pkg'};
      sandbox.stub(driver.adb, 'startUri');
      await driver.setUrl('url');
      driver.adb.startUri.calledWithExactly('url', 'pkg').should.be.true;
    });
  });
  describe('closeApp', () => {
    it('should close app', async () => {
      driver.opts = {appPackage: 'pkg'};
      sandbox.stub(driver.adb, 'forceStop');
      await driver.closeApp();
      driver.adb.forceStop.calledWithExactly('pkg').should.be.true;
    });
  });
  describe('getDisplayDensity', () => {
    it('should return the display density of a device', async () => {
      driver.adb.shell = () => { return '123'; };
      (await driver.getDisplayDensity()).should.equal(123);
    });
    it('should return the display density of an emulator', async () => {
      driver.adb.shell = (cmd) => {
        let joinedCmd = cmd.join(' ');
        if (joinedCmd.indexOf('ro.sf') !== -1) {
          // device property look up
          return '';
        } else if (joinedCmd.indexOf('qemu.sf') !== -1) {
          // emulator property look up
          return '456';
        }
        return '';
      };
      (await driver.getDisplayDensity()).should.equal(456);
    });
    it('should throw an error if the display density property can\'t be found', async () => {
      driver.adb.shell = () => { return ''; };
      await driver.getDisplayDensity().should.be.rejectedWith(/Failed to get display density property/);
    });
    it('should throw and error if the display density is not a number', async () => {
      driver.adb.shell = () => { return 'abc'; };
      await driver.getDisplayDensity().should.be.rejectedWith(/Failed to get display density property/);
    });
  });
  describe('parseSurfaceLine', () => {
    it('should return visible true if the surface is visible', async () => {
      parseSurfaceLine('shown=true rect=1 1 1 1').should.be.eql({
        visible: true,
        x: 1,
        y: 1,
        width: 1,
        height: 1
      });
    });
    it('should return visible false if the surface is not visible', async () => {
      parseSurfaceLine('shown=false rect=1 1 1 1').should.be.eql({
        visible: false,
        x: 1,
        y: 1,
        width: 1,
        height: 1
      });
    });
    it('should return the parsed surface bounds', async () => {
      parseSurfaceLine('shown=true rect=(1.0,2.0) 3.0 x 4.0').should.be.eql({
        visible: true,
        x: 1,
        y: 2,
        width: 3,
        height: 4
      });
    });
  });

  // these are used for both parseWindows and getSystemBars tests
  let validWindowOutput = [
    '  Window #1 Derp',
    '    stuff',
    '      Surface: derp shown=false lalalala rect=(9.0,8.0) 7.0 x 6.0',
    '    more stuff',
    '  Window #2 StatusBar',
    '    blah blah blah',
    '      Surface: blah blah shown=true blah blah rect=(1.0,2.0) 3.0 x 4.0',
    '    blah blah blah',
    '  Window #3 NavigationBar',
    '    womp womp',
    '      Surface: blah blah shown=false womp womp rect=(5.0,6.0) 50.0 x 60.0',
    '    qwerty asd zxc'
  ].join('\n');
  let validSystemBars = {
    statusBar: {visible: true, x: 1, y: 2, width: 3, height: 4},
    navigationBar: {visible: false, x: 5, y: 6, width: 50, height: 60}
  };

  describe('parseWindows', () => {
    it('should throw an error if the status bar info wasn\'t found', async () => {
      expect(() => { parseWindows(''); })
        .to.throw(Error, /Failed to parse status bar information./);
    });
    it('should throw an error if the navigation bar info wasn\'t found', async () => {
      let windowOutput = [
        '  Window #1 StatusBar',
        '    blah blah blah',
        '      Surface: blah blah shown=true blah blah rect=(1.0,2.0) 3.0 x 4.0',
        '    blah blah blah'
      ].join('\n');
      expect(() => { parseWindows(windowOutput); })
        .to.throw(Error, /Failed to parse navigation bar information./);
    });
    it('should return status and navigation bar info when both are given', async () => {
      parseWindows(validWindowOutput).should.be.eql(validSystemBars);
    });
  });
  describe('getSystemBars', () => {
    it('should throw an error if there\'s no window manager output', async () => {
      driver = new AndroidDriver();
      driver.adb = {};
      driver.adb.shell = () => { return ''; };
      await driver.getSystemBars().should.be.rejectedWith(/Did not get window manager output./);
    });
    it('should return the parsed system bar info', async () => {
      driver = new AndroidDriver();
      driver.adb = {};
      driver.adb.shell = () => { return validWindowOutput; };
      (await driver.getSystemBars()).should.be.eql(validSystemBars);
    });
  });
});
