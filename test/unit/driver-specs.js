import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import log from '../../lib/logger';
import sinon from 'sinon';
import helpers from '../../lib/android-helpers';
import { withMocks } from 'appium-test-support';
import AndroidDriver from '../..';
import ADB from 'appium-adb';
import { errors } from 'appium-base-driver';


let driver;
let sandbox = sinon.sandbox.create();
let expect = chai.expect;
chai.should();
chai.use(chaiAsPromised);

describe('driver', () => {
  describe('constructor', () => {
    it('should call BaseDriver constructor with opts', () => {
      let driver = new AndroidDriver({foo: 'bar'});
      driver.should.exist;
      driver.opts.foo.should.equal('bar');
    });
    it('should have this.findElOrEls', () => {
      let driver = new AndroidDriver({foo: 'bar'});
      driver.findElOrEls.should.exist;
      driver.findElOrEls.should.be.a('function');
    });
  });
  describe('emulator methods', () => {
    driver = new AndroidDriver();
    describe('fingerprint', withMocks({driver}, (mocks) => {
      it('fingerprint should be rejected if isEmulator is false', () => {
        mocks.driver.expects('isEmulator')
          .once().returns(false);
        driver.fingerprint(1111).should.eventually.be.rejectedWith("fingerprint method is only available for emulators");
        mocks.driver.verify();
      });
    }));
    describe('fingerprint', withMocks({driver}, (mocks) => {
      it('sendSMS should be rejected if isEmulator is false', () => {
        mocks.driver.expects('isEmulator')
          .once().returns(false);
        driver.sendSMS(4509, "Hello Appium").should.eventually.be.rejectedWith("sendSMS method is only available for emulators");
        mocks.driver.verify();
      });
    }));
  });
  describe('createSession', () => {
    beforeEach(() => {
      driver = new AndroidDriver();
      sandbox.stub(driver, 'checkAppPresent');
      sandbox.stub(driver, 'checkPackagePresent');
      sandbox.stub(driver, 'startAndroidSession');
      sandbox.stub(ADB, 'createADB', async (opts) => {
        return {
          getDevicesWithRetry: async () => {
            return [
              {udid: 'emulator-1234'},
              {udid: 'rotalume-1337'}
            ];
          },
          getPortFromEmulatorString: () => {
            return 1234;
          },
          setDeviceId: () => {},
          setEmulatorPort: () => {},
          adbPort: opts.adbPort
        };
      });
    });
    afterEach(() => {
      sandbox.restore();
    });
    it('should verify the unlock types', async () => {
      await driver.createSession({platformName: 'Android', deviceName: 'device', app: '/path/to/some.apk'});
      driver.unlocker.isValidUnlockType('pin').should.equal(true);
      driver.unlocker.isValidUnlockType('pattern').should.equal(true);
      driver.unlocker.isValidUnlockType('password').should.equal(true);
      driver.unlocker.isValidUnlockType('fingerprint').should.equal(true);
      driver.unlocker.isValidUnlockType('telepathy').should.equal(false);
    });
    it('should cast string keys to array', async () => {
      driver.unlocker.stringKeyToArr('1234').should.eql(['1', '2', '3', '4']);
      driver.unlocker.stringKeyToArr(' 1234 ').should.eql(['1', '2', '3', '4']);
      driver.unlocker.stringKeyToArr('1 2 3 4').should.eql(['1', '2', '3', '4']);
      driver.unlocker.stringKeyToArr('1  2  3  4').should.eql(['1', '2', '3', '4']);
    });
    it('should verify the unlock keys for each type', async () => {
      driver.unlocker.isValidKey('pin').should.equal(false);
      driver.unlocker.isValidKey('pin', ' ').should.equal(false);
      driver.unlocker.isValidKey('pin', '1111').should.equal(true);
      driver.unlocker.isValidKey('pin', '1abc').should.equal(false);
      driver.unlocker.isValidKey('fingerprint').should.equal(false);
      driver.unlocker.isValidKey('fingerprint', ' ').should.equal(false);
      driver.unlocker.isValidKey('fingerprint', '1111').should.equal(true);
      driver.unlocker.isValidKey('fingerprint', '1abc').should.equal(false);
      driver.unlocker.isValidKey('pattern', '1').should.equal(false);
      driver.unlocker.isValidKey('pattern', '1234').should.equal(true);
      driver.unlocker.isValidKey('pattern', '123456789').should.equal(true);
      driver.unlocker.isValidKey('pattern', '01234').should.equal(false);
      driver.unlocker.isValidKey('pattern').should.equal(false);
      driver.unlocker.isValidKey('pattern', ' ').should.equal(false);
      driver.unlocker.isValidKey('pattern', '1abc').should.equal(false);
      driver.unlocker.isValidKey('pattern', '1213').should.equal(false);
      driver.unlocker.isValidKey('password', '121c3').should.equal(true);
      driver.unlocker.isValidKey('password', 'appium').should.equal(true);
      driver.unlocker.isValidKey('password', 'appium-android-driver').should.equal(true);
      driver.unlocker.isValidKey('password', '@#$%&-+()*"\':;!?,_ ./~`|={}\\[]').should.equal(true);
      driver.unlocker.isValidKey('password', '123').should.equal(false);
      driver.unlocker.isValidKey('password').should.equal(false);
      driver.unlocker.isValidKey('password', '   ').should.equal(false);
    });
    it('should verify the password with blank space is encoded', async () => {
      driver.unlocker.encodePassword('a p p i u m').should.equal("a%sp%sp%si%su%sm");
      driver.unlocker.encodePassword('   ').should.equal("%s%s%s");
    });
    it('should verify pattern pin is aproximatelly to its position', async () => {
      let pins = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((pin) => {
        return driver.unlocker.getPatternKeyPosition(pin, {x: 33, y:323}, 137.6);
      });
      let cols = [101, 238, 375];
      let rows = [391, 528, 665];
      expect(pins[0].x).to.be.within(cols[0] - 5, cols[0] + 5);
      expect(pins[1].x).to.be.within(cols[1] - 5, cols[1] + 5);
      expect(pins[2].x).to.be.within(cols[2] - 5, cols[2] + 5);
      expect(pins[3].x).to.be.within(cols[0] - 5, cols[0] + 5);
      expect(pins[4].x).to.be.within(cols[1] - 5, cols[1] + 5);
      expect(pins[5].x).to.be.within(cols[2] - 5, cols[2] + 5);
      expect(pins[6].x).to.be.within(cols[0] - 5, cols[0] + 5);
      expect(pins[7].x).to.be.within(cols[1] - 5, cols[1] + 5);
      expect(pins[8].x).to.be.within(cols[2] - 5, cols[2] + 5);
      expect(pins[0].y).to.be.within(rows[0] - 5, rows[0] + 5);
      expect(pins[1].y).to.be.within(rows[0] - 5, rows[0] + 5);
      expect(pins[2].y).to.be.within(rows[0] - 5, rows[0] + 5);
      expect(pins[3].y).to.be.within(rows[1] - 5, rows[1] + 5);
      expect(pins[4].y).to.be.within(rows[1] - 5, rows[1] + 5);
      expect(pins[5].y).to.be.within(rows[1] - 5, rows[1] + 5);
      expect(pins[6].y).to.be.within(rows[2] - 5, rows[2] + 5);
      expect(pins[7].y).to.be.within(rows[2] - 5, rows[2] + 5);
      expect(pins[8].y).to.be.within(rows[2] - 5, rows[2] + 5);
    });
    it('should generate press, moveTo, relase gesture scheme to unlock by pattern', async () => {
      let keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
      let actions = driver.unlocker.getPatternActions(keys, {x: 0, y:0}, 1);
      actions.map((action, i) => {
        if (i === 0) {
          action.action.should.equal('press');
        } else if (i === keys.length) {
          action.action.should.equal('release');
        } else {
          action.action.should.equal('moveTo');
        }
      });
    });
    it('should verify pattern gestures moves to non consecutives pins', async () => {
      let keys = ["7", "2", "9", "8", "5", "6", "1", "4", "3"];
      let actions = driver.unlocker.getPatternActions(keys, {x: 0, y:0}, 1);
      // Move from pin 7 to pin 2
      actions[1].options.x.should.equal(1);
      actions[1].options.y.should.equal(-2);
      // Move from pin 2 to pin 9
      actions[2].options.x.should.equal(1);
      actions[2].options.y.should.equal(2);
      // Move from pin 9 to pin 8
      actions[3].options.x.should.equal(-1);
      actions[3].options.y.should.equal(0);
      // Move from pin 8 to pin 5
      actions[4].options.x.should.equal(0);
      actions[4].options.y.should.equal(-1);
      // Move from pin 5 to pin 6
      actions[5].options.x.should.equal(1);
      actions[5].options.y.should.equal(0);
      // Move from pin 6 to pin 1
      actions[6].options.x.should.equal(-2);
      actions[6].options.y.should.equal(-1);
      // Move from pin 1 to pin 4
      actions[7].options.x.should.equal(0);
      actions[7].options.y.should.equal(1);
      // Move from pin 4 to pin 3
      actions[8].options.x.should.equal(2);
      actions[8].options.y.should.equal(-1);
    });
    it('should verify device is an emulator', async () => {
      driver.opts.avd = "Nexus_5X_Api_23";
      driver.isEmulator().should.equal(true);
      driver.opts.avd = undefined;
      driver.opts.udid = "emulator-5554";
      driver.isEmulator().should.equal(true);
      driver.opts.udid = "01234567889";
      driver.isEmulator().should.equal(false);
    });
    it('should get java version if none is provided', async () => {
      await driver.createSession({platformName: 'Android', deviceName: 'device', app: '/path/to/some.apk'});
      driver.opts.javaVersion.should.exist;
    });
    it('should get browser package details if browserName is provided', async () => {
      sandbox.spy(helpers, 'getChromePkg');
      await driver.createSession({platformName: 'Android', deviceName: 'device', browserName: 'Chrome'});
      helpers.getChromePkg.calledOnce.should.be.true;
    });
    it('should check an app is present', async () => {
      await driver.createSession({platformName: 'Android', deviceName: 'device', app: '/path/to/some.apk'});
      driver.checkAppPresent.calledOnce.should.be.true;
    });
    it('should check a package is present', async () => {
      await driver.createSession({platformName: 'Android', deviceName: 'device', appPackage: 'some.app.package'});
      driver.checkPackagePresent.calledOnce.should.be.true;
    });
    it('should accept a package via the app capability', async () => {
      await driver.createSession({platformName: 'Android', deviceName: 'device', app: 'some.app.package'});
      driver.checkPackagePresent.calledOnce.should.be.true;
    });
    it('should add server details to caps', async () => {
      await driver.createSession({platformName: 'Android', deviceName: 'device', appPackage: 'some.app.package'});
      driver.caps.webStorageEnabled.should.exist;
    });
    it('should delete a session on failure', async () => {
      // Force an error to make sure deleteSession gets called
      sandbox.stub(helpers, 'getJavaVersion').throws();
      sandbox.stub(driver, 'deleteSession');
      try {
        await driver.createSession({platformName: 'Android', deviceName: 'device', appPackage: 'some.app.package'});
      } catch (ign) {}
      driver.deleteSession.calledOnce.should.be.true;
    });
    it('should pass along adbPort capability to ADB', async () => {
      await driver.createSession({platformName: 'Android', deviceName: 'device', appPackage: 'some.app.package', adbPort: 1111});
      driver.adb.adbPort.should.equal(1111);
    });
    it('should proxy screenshot if nativeWebScreenshot is off', async () => {
      await driver.createSession({platformName: 'Android', deviceName: 'device', browserName: 'chrome', nativeWebScreenshot: false});
      driver.getProxyAvoidList().should.have.length(8);
    });
    it('should not proxy screenshot if nativeWebScreenshot is on', async () => {
      await driver.createSession({platformName: 'Android', deviceName: 'device', browserName: 'chrome', nativeWebScreenshot: true});
      driver.getProxyAvoidList().should.have.length(9);
    });
  });
  describe('deleteSession', () => {
    beforeEach(async () => {
      driver = new AndroidDriver();
      driver.adb = new ADB();
      driver.bootstrap = new helpers.bootstrap(driver.adb);
      sandbox.stub(driver, 'stopChromedriverProxies');
      sandbox.stub(driver.adb, 'setIME');
      sandbox.stub(driver.adb, 'forceStop');
      sandbox.stub(driver.adb, 'goToHome');
      sandbox.stub(driver.adb, 'uninstallApk');
      sandbox.stub(driver.adb, 'stopLogcat');
      sandbox.stub(driver.bootstrap, 'shutdown');
      sandbox.spy(log, 'debug');
    });
    afterEach(() => {
      sandbox.restore();
    });
    it('should not do anything if Android Driver has already shut down', async () => {
      driver.bootstrap = null;
      await driver.deleteSession();
      log.debug.callCount.should.eql(3);
      driver.stopChromedriverProxies.called.should.be.false;
      driver.adb.stopLogcat.called.should.be.true;
    });
    it('should reset keyboard to default IME', async () => {
      driver.opts.unicodeKeyboard = true;
      driver.opts.resetKeyboard = true;
      driver.defaultIME = 'someDefaultIME';
      await driver.deleteSession();
      driver.adb.setIME.calledOnce.should.be.true;
    });
    it('should force stop non-Chrome sessions', async () => {
      await driver.deleteSession();
      driver.adb.forceStop.calledOnce.should.be.true;
    });
    it('should uninstall APK if required', async () => {
      driver.opts.fullReset = true;
      await driver.deleteSession();
      driver.adb.uninstallApk.calledOnce.should.be.true;
    });
  });
  describe('shouldDismissChromeWelcome', () => {
    before(async () => {
      driver = new AndroidDriver();
    });
    it('should verify chromeOptions args', () => {
      driver.opts = {};
      driver.shouldDismissChromeWelcome().should.be.false;
      driver.opts = {"chromeOptions":{}};
      driver.shouldDismissChromeWelcome().should.be.false;
      driver.opts = {"chromeOptions":{"args":[]}};
      driver.shouldDismissChromeWelcome().should.be.false;
      driver.opts = {"chromeOptions":{"args":"--no-first-run"}};
      driver.shouldDismissChromeWelcome().should.be.false;
      driver.opts = {"chromeOptions":{"args":["--disable-dinosaur-easter-egg"]}};
      driver.shouldDismissChromeWelcome().should.be.false;
      driver.opts = {"chromeOptions":{"args":["--no-first-run"]}};
      driver.shouldDismissChromeWelcome().should.be.true;
    });
  });
  describe('startAndroidSession', () => {
    beforeEach(async () => {
      driver = new AndroidDriver();
      driver.adb = new ADB();
      driver.bootstrap = new helpers.bootstrap(driver.adb);
      driver.settings = { update () {} };
      driver.caps = {};

      // create a fake bootstrap because we can't mock
      // driver.bootstrap.<whatever> in advance
      let fakeBootstrap = {start () {},
                           onUnexpectedShutdown: {catch () {}}
                          };

      sandbox.stub(helpers, 'initDevice');
      sandbox.stub(helpers, 'unlock');
      sandbox.stub(helpers, 'bootstrap').returns(fakeBootstrap);
      sandbox.stub(driver, 'initAUT');
      sandbox.stub(driver, 'startAUT');
      sandbox.stub(driver, 'defaultWebviewName');
      sandbox.stub(driver, 'setContext');
      sandbox.stub(driver, 'startChromeSession');
      sandbox.stub(driver, 'dismissChromeWelcome');
      sandbox.stub(driver.settings, 'update');
      sandbox.stub(driver.adb, 'getPlatformVersion');
      sandbox.stub(driver.adb, 'getScreenSize');
      sandbox.stub(driver.adb, 'getModel');
      sandbox.stub(driver.adb, 'getManufacturer');
    });
    afterEach(() => {
      sandbox.restore();
    });
    it('should set actual platform version', async () => {
      await driver.startAndroidSession();
      driver.adb.getPlatformVersion.calledOnce.should.be.true;
    });
    it('should auto launch app if it is on the device', async () => {
      driver.opts.autoLaunch = true;
      await driver.startAndroidSession();
      driver.initAUT.calledOnce.should.be.true;
    });
    it('should handle chrome sessions', async () => {
      driver.opts.browserName = 'Chrome';
      await driver.startAndroidSession();
      driver.startChromeSession.calledOnce.should.be.true;
    });
    it('should unlock the device', async () => {
      await driver.startAndroidSession();
      helpers.unlock.calledOnce.should.be.true;
    });
    it('should start AUT if auto lauching', async () => {
      driver.opts.autoLaunch = true;
      await driver.startAndroidSession();
      driver.initAUT.calledOnce.should.be.true;
    });
    it('should not start AUT if not auto lauching', async () => {
      driver.opts.autoLaunch = false;
      await driver.startAndroidSession();
      driver.initAUT.calledOnce.should.be.false;
    });
    it('should set the context if autoWebview is requested', async () => {
      driver.opts.autoWebview = true;
      await driver.startAndroidSession();
      driver.defaultWebviewName.calledOnce.should.be.true;
      driver.setContext.calledOnce.should.be.true;
    });
    it('should set the context if autoWebview is requested using timeout', async () => {
      driver.setContext.onCall(0).throws(errors.NoSuchContextError);
      driver.setContext.onCall(1).returns();

      driver.opts.autoWebview = true;
      driver.opts.autoWebviewTimeout = 5000;
      await driver.startAndroidSession();
      driver.defaultWebviewName.calledOnce.should.be.true;
      driver.setContext.calledTwice.should.be.true;
    });
    it('should respect timeout if autoWebview is requested', async () => {
      driver.setContext.throws(new errors.NoSuchContextError());

      let begin = Date.now();

      driver.opts.autoWebview = true;
      driver.opts.autoWebviewTimeout = 5000;
      await driver.startAndroidSession().should.eventually.be.rejected;
      driver.defaultWebviewName.calledOnce.should.be.true;

      // we have a timeout of 5000ms, retrying on 500ms, so expect 10 times
      driver.setContext.callCount.should.equal(10);

      let end = Date.now();
      (end - begin).should.be.above(5000);
    });
    it('should not set the context if autoWebview is not requested', async () => {
      await driver.startAndroidSession();
      driver.defaultWebviewName.calledOnce.should.be.false;
      driver.setContext.calledOnce.should.be.false;
    });
    it('should set ignoreUnimportantViews cap', async () => {
      driver.opts.ignoreUnimportantViews = true;

      await driver.startAndroidSession();
      driver.settings.update.calledOnce.should.be.true;
      driver.settings.update.firstCall.args[0].ignoreUnimportantViews.should.be.true;
    });
    it('should not call dismissChromeWelcome on missing chromeOptions', async () => {
      driver.opts.browserName = 'Chrome';
      await driver.startAndroidSession();
      driver.dismissChromeWelcome.calledOnce.should.be.false;
    });
    it('should call dismissChromeWelcome', async () => {
      driver.opts.browserName = 'Chrome';
      driver.opts.chromeOptions = {
        "args" : ["--no-first-run"]
      };
      await driver.startAndroidSession();
      driver.dismissChromeWelcome.calledOnce.should.be.true;
    });
  });
  describe('validateDesiredCaps', () => {
    before(() => {
      driver = new AndroidDriver();
    });
    it('should throw an error if caps do not contain an app, package or valid browser', () => {
      expect(() => {
        driver.validateDesiredCaps({platformName: 'Android', deviceName: 'device'});
      }).to.throw(/must include/);
      expect(() => {
        driver.validateDesiredCaps({platformName: 'Android', deviceName: 'device', browserName: 'Netscape Navigator'});
      }).to.throw(/must include/);
    });
    it('should not throw an error if caps contain an app, package or valid browser', () => {
      expect(() => {
        driver.validateDesiredCaps({platformName: 'Android', deviceName: 'device', app: '/path/to/some.apk'});
      }).to.not.throw(Error);
      expect(() => {
        driver.validateDesiredCaps({platformName: 'Android', deviceName: 'device', browserName: 'Chrome'});
      }).to.not.throw(Error);
      expect(() => {
        driver.validateDesiredCaps({platformName: 'Android', deviceName: 'device', appPackage: 'some.app.package'});
      }).to.not.throw(/must include/);
    });
    it('should not be sensitive to platform name casing', () => {
      expect(() => {
        driver.validateDesiredCaps({platformName: 'AnDrOiD', deviceName: 'device', app: '/path/to/some.apk'});
      }).to.not.throw(Error);
    });
    it('should not throw an error if caps contain both an app and browser, for grid compatibility', () => {
      expect(() => {
        driver.validateDesiredCaps({platformName: 'Android', deviceName: 'device', app: '/path/to/some.apk', browserName: 'iPhone'});
      }).to.not.throw(Error);
    });
    it('should not throw an error if caps contain androidScreenshotPath capability', () => {
      expect(() => {
        driver.validateDesiredCaps({platformName: 'Android', deviceName: 'device', app: '/path/to/some.apk', androidScreenshotPath: '/path/to/screenshotdir'});
      }).to.not.throw(Error);
    });
  });
  describe('proxying', () => {
    before(() => {
      driver = new AndroidDriver();
      driver.sessionId = 'abc';
    });
    describe('#proxyActive', () => {
      it('should exist', () => {
        driver.proxyActive.should.be.an.instanceof(Function);
      });
      it('should return false', () => {
        driver.proxyActive('abc').should.be.false;
      });
      it('should throw an error if session id is wrong', () => {
        (() => { driver.proxyActive('aaa'); }).should.throw;
      });
    });

    describe('#getProxyAvoidList', () => {
      it('should exist', () => {
        driver.getProxyAvoidList.should.be.an.instanceof(Function);
      });
      it('should return jwpProxyAvoid array', () => {
        let avoidList = driver.getProxyAvoidList('abc');
        avoidList.should.be.an.instanceof(Array);
        avoidList.should.eql(driver.jwpProxyAvoid);
      });
      it('should throw an error if session id is wrong', () => {
        (() => { driver.getProxyAvoidList('aaa'); }).should.throw;
      });
    });

    describe('#canProxy', () => {
      it('should exist', () => {
        driver.canProxy.should.be.an.instanceof(Function);
      });
      it('should return false', () => {
        driver.canProxy('abc').should.be.false;
      });
      it('should throw an error if session id is wrong', () => {
        (() => { driver.canProxy('aaa'); }).should.throw;
      });
    });
  });
});
