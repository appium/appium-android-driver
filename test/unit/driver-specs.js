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
          adbPort: opts.adbPort,
          networkSpeed: () => {}
        };
      });
    });
    afterEach(() => {
      sandbox.restore();
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
    it('should set networkSpeed before launching app', async () => {
      sandbox.stub(driver, 'isEmulator').returns(true);
      sandbox.stub(helpers, 'ensureNetworkSpeed').returns('full');
      await driver.createSession({platformName: 'Android', deviceName: 'device', appPackage: 'some.app.package', networkSpeed: 'edge'});
      driver.isEmulator.calledOnce.should.be.true;
      helpers.ensureNetworkSpeed.calledOnce.should.be.true;
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
  describe('dismissChromeWelcome', () => {
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
  describe('initAUT', withMocks({helpers}, (mocks) => {
    beforeEach(async () => {
      driver = new AndroidDriver();
      driver.caps = {};
    });
    it('should throw error if run with full reset', async () => {
      driver.opts = {appPackage: "app.package", appActivity: "act", fullReset: true};
      await driver.initAUT().should.be.rejectedWith(/Full reset requires an app capability/);
    });
    it('should reset if run with fast reset', async () => {
      driver.opts = {appPackage: "app.package", appActivity: "act", fullReset: false, fastReset: true};
      driver.adb = "mock_adb";
      mocks.helpers.expects("resetApp").withExactArgs("mock_adb", undefined, "app.package", true);
      await driver.initAUT();
      mocks.helpers.verify();
    });
    it('should keep data if run without reset', async () => {
      driver.opts = {appPackage: "app.package", appActivity: "act", fullReset: false, fastReset: false};
      mocks.helpers.expects("resetApp").never();
      await driver.initAUT();
      mocks.helpers.verify();
    });
  }));
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
    it('should respect timeout if autoWebview is requested', async function () {
      this.timeout(10000);
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
