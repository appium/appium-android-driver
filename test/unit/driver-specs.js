import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import log from '../../lib/logger';
import sinon from 'sinon';
import helpers from '../../lib/android-helpers';
import { AndroidDriver } from '../..';
import ADB from 'appium-adb';
import Bootstrap from 'appium-android-bootstrap';

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
      sandbox.stub(ADB, 'createADB');
    });
    afterEach(() => {

      sandbox.restore();
    });
    it('should get java version if none is provided', async () => {
      await driver.createSession({platformName: 'Android', deviceName: 'device', app: 'some.apk'});
      driver.opts.javaVersion.should.exist;
    });
    it('should get browser package details if browserName is provided', async () => {
      sandbox.spy(helpers, 'getChromePkg');
      await driver.createSession({platformName: 'Android', deviceName: 'device', browserName: 'Chrome'});
      helpers.getChromePkg.calledOnce.should.be.true;
    });
    it('should check an app is present', async () => {
      await driver.createSession({platformName: 'Android', deviceName: 'device', app: 'some.apk'});
      driver.checkAppPresent.calledOnce.should.be.true;
    });
    it('should check a package is present', async () => {
      await driver.createSession({platformName: 'Android', deviceName: 'device', appPackage: 'some.app.package'});
      driver.checkPackagePresent.calledOnce.should.be.true;
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
  });
  describe('deleteSession', () => {
    beforeEach(async () => {
      driver = new AndroidDriver();
      driver.adb = new ADB();
      driver.bootstrap = new Bootstrap();
      sandbox.stub(driver, 'stopChromedriverProxies');
      sandbox.stub(driver.adb, 'setIME');
      sandbox.stub(driver.adb, 'forceStop');
      sandbox.stub(driver.adb, 'goToHome');
      sandbox.stub(driver.adb, 'uninstallApk');
      sandbox.stub(driver.adb, 'stopLogcat');
      sandbox.stub(driver.bootstrap, 'shutdown');
      sandbox.spy(log, 'warn');
    });
    afterEach(() => {
      sandbox.restore();
    });
    it('should not do anything if Android Driver has already shut down', async () => {
      driver.bootstrap = null;
      await driver.deleteSession();
      log.warn.calledOnce.should.be.true;
      driver.stopChromedriverProxies.called.should.be.false;
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
      }).to.throw(/Netscape Navigator/);
    });
    it('should not throw an error if caps contain an app, package or valid browser', () => {
      expect(() => {
        driver.validateDesiredCaps({platformName: 'Android', deviceName: 'device', app: 'some.apk'});
      }).to.not.throw(Error);
      expect(() => {
        driver.validateDesiredCaps({platformName: 'Android', deviceName: 'device', browserName: 'Chrome'});
      }).to.not.throw(Error);
      expect(() => {
        driver.validateDesiredCaps({platformName: 'Android', deviceName: 'device', appPackage: 'some.app.package'});
      }).to.not.throw(/must include/);
    });
    it('should throw an error if caps contain both an app and browser', () => {
      expect(() => {
        driver.validateDesiredCaps({platformName: 'Android', deviceName: 'device', app: 'some.apk', browserName: 'Chrome'});
      }).to.throw(/should not include both/);
    });
  });
});
