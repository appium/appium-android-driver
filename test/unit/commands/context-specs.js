import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import { default as webviewHelpers,
         NATIVE_WIN, WEBVIEW_BASE, WEBVIEW_WIN, CHROMIUM_WIN } from '../../../lib/webview-helpers';
import { setupNewChromedriver } from '../../../lib/commands/context';
import AndroidDriver from '../../..';
import Chromedriver from 'appium-chromedriver';
import PortFinder from 'portfinder';
import { errors } from 'appium-base-driver';

let driver;
let stubbedChromedriver;
let sandbox = sinon.sandbox.create();
let expect = chai.expect;
chai.should();
chai.use(chaiAsPromised);

describe('Context', function () {
  beforeEach(function () {
    sandbox.stub(PortFinder, 'getPort', function (cb) { // eslint-disable-line promise/prefer-await-to-callbacks
      return cb(null, 4444); // eslint-disable-line promise/prefer-await-to-callbacks
    });
    driver = new AndroidDriver();
    driver.adb = sandbox.stub();
    driver.adb.curDeviceId = 'device_id';
    driver.adb.getAdbServerPort = sandbox.stub().returns(5555);
    sandbox.stub(Chromedriver.prototype, 'restart');
    sandbox.stub(Chromedriver.prototype, 'start');
    sandbox.stub(Chromedriver.prototype.proxyReq, 'bind').returns('proxy');

    stubbedChromedriver = sinon.stub();
    stubbedChromedriver.proxyReq = sinon.stub();
    stubbedChromedriver.proxyReq.bind = sinon.stub();
    stubbedChromedriver.restart = sinon.stub();
    stubbedChromedriver.stop = sandbox.stub().throws();
    stubbedChromedriver.removeAllListeners = sandbox.stub();
  });
  afterEach(function () {
    sandbox.restore();
  });
  describe('getCurrentContext', function () {
    it('should return current context', async function () {
      driver.curContext = 'current_context';
      await driver.getCurrentContext().should.become('current_context');
    });
    it('should return NATIVE_APP if no context is set', async function () {
      driver.curContext = null;
      await driver.getCurrentContext().should.become(NATIVE_WIN);
    });
  });
  describe('getContexts', function () {
    it('should get Chromium context where appropriate', async function () {
      driver = new AndroidDriver({browserName: 'Chrome'});
      expect(await driver.getContexts()).to.include(CHROMIUM_WIN);
    });
    it('should use ADB to figure out which webviews are available', async function () {
      sandbox.stub(webviewHelpers, 'getWebviews');
      expect(await driver.getContexts()).to.not.include(CHROMIUM_WIN);
      webviewHelpers.getWebviews.calledOnce.should.be.true;
    });
  });
  describe('setContext', function () {
    beforeEach(function () {
      sandbox.stub(driver, 'getContexts').returns(['DEFAULT', 'WV', 'ANOTHER']);
      sandbox.stub(driver, 'switchContext');
    });
    it('should switch to default context if name is null', async function () {
      sandbox.stub(driver, 'defaultContextName').returns('DEFAULT');
      await driver.setContext(null);
      driver.switchContext.calledWithExactly('DEFAULT').should.be.true;
      driver.curContext.should.be.equal('DEFAULT');
    });
    it('should switch to default web view if name is WEBVIEW', async function () {
      sandbox.stub(driver, 'defaultWebviewName').returns('WV');
      await driver.setContext(WEBVIEW_WIN);
      driver.switchContext.calledWithExactly('WV').should.be.true;
      driver.curContext.should.be.equal('WV');
    });
    it('should throw error if context does not exist', async function () {
      await driver.setContext('fake')
        .should.be.rejectedWith(errors.NoSuchContextError);
    });
    it('should not switch to context if already in it', async function () {
      driver.curContext = 'ANOTHER';
      await driver.setContext('ANOTHER');
      driver.switchContext.notCalled.should.be.true;
    });
  });
  describe('switchContext', function () {
    beforeEach(function () {
      sandbox.stub(driver, 'stopChromedriverProxies');
      sandbox.stub(driver, 'startChromedriverProxy');
      sandbox.stub(driver, 'suspendChromedriverProxy');
      sandbox.stub(driver, 'isChromedriverContext');
      driver.curContext = 'current_cntx';
    });
    it('should start chrome driver proxy if requested context is webview', async function () {
      driver.isChromedriverContext.returns(true);
      await driver.switchContext('context');
      driver.startChromedriverProxy.calledWithExactly('context').should.be.true;
    });
    it('should stop chromedriver proxy if current context is webview and requested context is not', async function () {
      driver.opts = {recreateChromeDriverSessions: true};
      driver.isChromedriverContext.withArgs('requested_cntx').returns(false);
      driver.isChromedriverContext.withArgs('current_cntx').returns(true);
      await driver.switchContext('requested_cntx');
      driver.stopChromedriverProxies.calledOnce.should.be.true;
    });
    it('should suspend chrome driver proxy if current context is webview and requested context is not', async function () {
      driver.opts = {recreateChromeDriverSessions: false};
      driver.isChromedriverContext.withArgs('requested_cntx').returns(false);
      driver.isChromedriverContext.withArgs('current_cntx').returns(true);
      await driver.switchContext('requested_cntx');
      driver.suspendChromedriverProxy.calledOnce.should.be.true;
    });
    it('should throw error if requested and current context are not webview', async function () {
      driver.isChromedriverContext.withArgs('requested_cntx').returns(false);
      driver.isChromedriverContext.withArgs('current_cntx').returns(false);
      await driver.switchContext('requested_cntx')
        .should.be.rejectedWith(/switching to context/);
    });
  });
  describe('defaultContextName', function () {
    it('should return NATIVE_WIN', async function () {
      await driver.defaultContextName().should.be.equal(NATIVE_WIN);
    });
  });
  describe('defaultWebviewName', function () {
    it('should return WEBVIEW with package', async function () {
      driver.opts = {appPackage: 'pkg'};
      await driver.defaultWebviewName().should.be.equal(WEBVIEW_BASE + 'pkg');
    });
  });
  describe('isWebContext', function () {
    it('should return true if current context is not native', async function () {
      driver.curContext = 'current_context';
      await driver.isWebContext().should.be.true;
    });
  });
  describe('startChromedriverProxy', function () {
    beforeEach(function () {
      sandbox.stub(driver, 'onChromedriverStop');
    });
    it('should start new chromedriver session', async function () {
      await driver.startChromedriverProxy('WEBVIEW_1');
      driver.sessionChromedrivers.WEBVIEW_1.should.be.equal(driver.chromedriver);
      driver.chromedriver.start.getCall(0).args[0]
        .chromeOptions.androidDeviceSerial.should.be.equal('device_id');
      driver.chromedriver.proxyPort.should.be.equal(4444);
      driver.chromedriver.proxyReq.bind.calledWithExactly(driver.chromedriver);
      driver.proxyReqRes.should.be.equal('proxy');
      driver.jwpProxyActive.should.be.true;
    });
    it('should be able to extract package from context name', async function () {
      driver.opts.appPackage = 'pkg';
      driver.opts.extractChromeAndroidPackageFromContextName = true;
      await driver.startChromedriverProxy('WEBVIEW_com.pkg');
      driver.chromedriver.start.getCall(0).args[0]
        .chromeOptions.should.be.deep.include({androidPackage: 'com.pkg'});
    });
    it('should use package from opts if package extracted from context is empty', async function () {
      driver.opts.appPackage = 'pkg';
      driver.opts.extractChromeAndroidPackageFromContextName = true;
      await driver.startChromedriverProxy('WEBVIEW_');
      driver.chromedriver.start.getCall(0).args[0]
        .chromeOptions.should.be.deep.include({androidPackage: 'pkg'});
    });
    it('should handle chromedriver event with STATE_STOPPED state', async function () {
      await driver.startChromedriverProxy('WEBVIEW_1');
      await driver.chromedriver.emit(Chromedriver.EVENT_CHANGED,
        {state: Chromedriver.STATE_STOPPED});
      driver.onChromedriverStop.calledWithExactly('WEBVIEW_1').should.be.true;
    });
    it('should ignore events if status is not STATE_STOPPED', async function () {
      await driver.startChromedriverProxy('WEBVIEW_1');
      await driver.chromedriver.emit(Chromedriver.EVENT_CHANGED,
        {state: 'unhandled_state'});
      driver.onChromedriverStop.notCalled.should.be.true;
    });
    it('should reconnect if session already exists', async function () {
      stubbedChromedriver.hasWorkingWebview = sinon.stub().returns(true);
      driver.sessionChromedrivers = {WEBVIEW_1: stubbedChromedriver};
      await driver.startChromedriverProxy('WEBVIEW_1');
      driver.chromedriver.restart.notCalled.should.be.true;
      driver.chromedriver.should.be.equal(stubbedChromedriver);
    });
    it('should restart if chromedriver has not working web view', async function () {
      stubbedChromedriver.hasWorkingWebview = sinon.stub().returns(false);
      driver.sessionChromedrivers = {WEBVIEW_1: stubbedChromedriver};
      await driver.startChromedriverProxy('WEBVIEW_1');
      driver.chromedriver.restart.calledOnce.should.be.true;
    });
  });
  describe('suspendChromedriverProxy', function () {
    it('should suspend chrome driver proxy', async function () {
      await driver.suspendChromedriverProxy();
      (driver.chromedriver == null).should.be.true;
      (driver.proxyReqRes == null).should.be.true;
      driver.jwpProxyActive.should.be.false;
    });
  });
  describe('onChromedriverStop', function () {
    it('should call startUnexpectedShutdown if chromedriver in active context', async function () {
      sinon.stub(driver, 'startUnexpectedShutdown');
      driver.curContext = 'WEBVIEW_1';
      await driver.onChromedriverStop('WEBVIEW_1');
      let arg0 = driver.startUnexpectedShutdown.getCall(0).args[0];
      arg0.should.be.an('error');
      arg0.message.should.include('Chromedriver quit unexpectedly during session');
    });
    it('should delete session if chromedriver in non-active context', async function () {
      driver.curContext = 'WEBVIEW_1';
      driver.sessionChromedrivers = {WEBVIEW_2: 'CHROMIUM'};
      await driver.onChromedriverStop('WEBVIEW_2');
      driver.sessionChromedrivers.should.be.empty;
    });
  });
  describe('stopChromedriverProxies', function () {
    it('should stop all chromedriver', async function () {
      driver.sessionChromedrivers = {WEBVIEW_1: stubbedChromedriver, WEBVIEW_2: stubbedChromedriver};
      sandbox.stub(driver, 'suspendChromedriverProxy');
      await driver.stopChromedriverProxies();
      driver.suspendChromedriverProxy.calledOnce.should.be.true;
      stubbedChromedriver.removeAllListeners
        .calledWithExactly(Chromedriver.EVENT_CHANGED).should.be.true;
      stubbedChromedriver.removeAllListeners.calledTwice.should.be.true;
      stubbedChromedriver.stop.calledTwice.should.be.true;
      driver.sessionChromedrivers.should.be.empty;
    });
  });
  describe('isChromedriverContext', function () {
    it('should return true if context is webview or chromium', async function () {
      await driver.isChromedriverContext(WEBVIEW_WIN + '_1').should.be.true;
      await driver.isChromedriverContext(CHROMIUM_WIN).should.be.true;
    });
  });
  describe('setupNewChromedriver', function () {
    it('should be able to set app package from chrome options', async function () {
      let chromedriver = await setupNewChromedriver({chromeOptions: {androidPackage: 'apkg'}});
      chromedriver.start.getCall(0).args[0].chromeOptions.androidPackage
        .should.be.equal('apkg');
    });
    it('should use prefixed chromeOptions', async function () {
      let chromedriver = await setupNewChromedriver({
        'goog:chromeOptions': {
          androidPackage: 'apkg',
        },
      });
      chromedriver.start.getCall(0).args[0].chromeOptions.androidPackage
        .should.be.equal('apkg');
    });
    it('should merge chromeOptions', async function () {
      let chromedriver = await setupNewChromedriver({
        chromeOptions: {
          androidPackage: 'apkg',
        },
        'goog:chromeOptions': {
          androidWaitPackage: 'bpkg',
        },
        'appium:chromeOptions': {
          androidActivity: 'aact',
        },
      });
      chromedriver.start.getCall(0).args[0].chromeOptions.androidPackage
        .should.be.equal('apkg');
      chromedriver.start.getCall(0).args[0].chromeOptions.androidActivity
        .should.be.equal('aact');
      chromedriver.start.getCall(0).args[0].chromeOptions.androidWaitPackage
        .should.be.equal('bpkg');
    });
    it('should be able to set androidActivity chrome option', async function () {
      let chromedriver = await setupNewChromedriver({chromeAndroidActivity: 'act'});
      chromedriver.start.getCall(0).args[0].chromeOptions.androidActivity
        .should.be.equal('act');
    });
    it('should be able to set androidProcess chrome option', async function () {
      let chromedriver = await setupNewChromedriver({chromeAndroidProcess: 'proc'});
      chromedriver.start.getCall(0).args[0].chromeOptions.androidProcess
        .should.be.equal('proc');
    });
    it('should be able to set loggingPrefs capability', async function () {
      let chromedriver = await setupNewChromedriver({enablePerformanceLogging: true});
      chromedriver.start.getCall(0).args[0].loggingPrefs
        .should.deep.equal({performance: 'ALL'});
    });
    it('should set androidActivity to appActivity if browser name is chromium-webview', async function () {
      let chromedriver = await setupNewChromedriver({browserName: 'chromium-webview',
                                                     appActivity: 'app_act'});
      chromedriver.start.getCall(0).args[0].chromeOptions.androidActivity
        .should.be.equal('app_act');
    });
    it('should be able to set loggingPrefs capability', async function () {
      let chromedriver = await setupNewChromedriver({pageLoadStrategy: "strategy"});
      chromedriver.start.getCall(0).args[0].pageLoadStrategy
        .should.be.equal("strategy");
    });
  });
});
