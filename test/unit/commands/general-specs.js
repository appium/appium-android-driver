import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../..';
import { parseSurfaceLine, parseWindows } from '../../../lib/commands/general';
import helpers from '../../../lib/android-helpers';
import { withMocks } from 'appium-test-support';

let driver;
chai.should();
chai.use(chaiAsPromised);
let expect = chai.expect;

describe('General', () => {
  describe('hideKeyboard', () => {
    it('should throw an error if no keyboard is present', async () => {
      driver = new AndroidDriver();
      driver.adb = {};
      driver.adb.isSoftKeyboardPresent = () => { return false; };
      await driver.hideKeyboard().should.be.rejectedWith(/not present/);
    });
    it('should throw an error if there is no selector', () => {
      driver.findElOrEls('xpath', null, false, 'some context').should.be.rejected;
    });
  });
  describe('isKeyboardShown', () => {
    it('should return true if the keyboard is shown', async () => {
      driver = new AndroidDriver();
      driver.adb = {};
      driver.adb.isSoftKeyboardPresent = () => { return { isKeyboardShown: true, canCloseKeyboard: true }; };
      (await driver.isKeyboardShown()).should.equal(true);
    });
    it('should return false if the keyboard is not shown', async () => {
      driver = new AndroidDriver();
      driver.adb = {};
      driver.adb.isSoftKeyboardPresent = () => { return { isKeyboardShown: false, canCloseKeyboard: true }; };
      (await driver.isKeyboardShown()).should.equal(false);
    });
  });
  describe('Install App', () => {
    it('should throw an error if APK does not exist', async () => {
      driver = new AndroidDriver();
      await driver.installApp('non/existent/app.apk').should.be.rejectedWith(/Could not find/);
    });
  });
  describe('Run installed App', withMocks({helpers}, (mocks) => {
    it('should throw error if run with full reset', async () => {
      driver = new AndroidDriver();
      driver.opts = {appPackage: "app.package", appActivity: "act", fullReset: true};
      driver.caps = {};
      await driver.initAUT().should.be.rejectedWith(/Full reset requires an app capability/);
    });
    it('should reset if run with fast reset', async () => {
      driver = new AndroidDriver();
      driver.opts = {appPackage: "app.package", appActivity: "act", fullReset: false, fastReset: true};
      driver.caps = {};
      driver.adb = "mock_adb";
      mocks.helpers.expects("resetApp").withExactArgs("mock_adb", undefined, "app.package", true);
      await driver.initAUT();
      mocks.helpers.verify();
    });
    it('should keep data if run without reset', async () => {
      driver = new AndroidDriver();
      driver.opts = {appPackage: "app.package", appActivity: "act", fullReset: false, fastReset: false};
      driver.caps = {};
      mocks.helpers.expects("resetApp").never();
      await driver.initAUT();
      mocks.helpers.verify();
    });
  }));
  describe('getStrings', withMocks({helpers}, (mocks) => {
    it('should return app strings', async () => {
      driver = new AndroidDriver();
      driver.bootstrap = {};
      driver.bootstrap.sendAction = () => { return ''; };
      mocks.helpers.expects("pushStrings")
          .returns({'test': 'en_value'});
      let strings = await driver.getStrings('en');
      strings.test.should.equal('en_value');
      mocks.helpers.verify();
    });
    it('should return cached app strings for the specified language', async () => {
      driver = new AndroidDriver();
      driver.adb = {};
      driver.adb.getDeviceLanguage = () => { return 'en'; };
      driver.apkStrings.en = {'test': 'en_value'};
      driver.apkStrings.fr = {'test': 'fr_value'};
      let strings = await driver.getStrings('fr');
      strings.test.should.equal('fr_value');
    });
    it('should return cached app strings for the device language', async () => {
      driver = new AndroidDriver();
      driver.adb = {};
      driver.adb.getDeviceLanguage = () => { return 'en'; };
      driver.apkStrings.en = {'test': 'en_value'};
      driver.apkStrings.fr = {'test': 'fr_value'};
      let strings = await driver.getStrings();
      strings.test.should.equal('en_value');
    });
  }));
  describe('getDisplayDensity', () => {
    it('should return the display density of a device', async () => {
      driver = new AndroidDriver();
      driver.adb = {};
      driver.adb.shell = () => { return '123'; };
      (await driver.getDisplayDensity()).should.equal(123);
    });
    it('should return the display density of an emulator', async () => {
      driver = new AndroidDriver();
      driver.adb = {};
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
      driver = new AndroidDriver();
      driver.adb = {};
      driver.adb.shell = () => { return ''; };
      await driver.getDisplayDensity().should.be.rejectedWith(/Failed to get display density property/);
    });
    it('should throw and error if the display density is not a number', async () => {
      driver = new AndroidDriver();
      driver.adb = {};
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
