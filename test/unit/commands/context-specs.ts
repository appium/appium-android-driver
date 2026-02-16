import sinon from 'sinon';
import * as webviewHelpers from '../../../lib/commands/context/helpers';
import {
  NATIVE_WIN,
  WEBVIEW_BASE,
  WEBVIEW_WIN,
  CHROMIUM_WIN,
  setupNewChromedriver,
} from '../../../lib/commands/context/helpers';
import {AndroidDriver} from '../../../lib/driver';
import {Chromedriver} from 'appium-chromedriver';
import {errors} from 'appium/driver';
import {expect, use} from 'chai';
import chaiAsPromised from 'chai-as-promised';

use(chaiAsPromised);

let driver: AndroidDriver;
let stubbedChromedriver: any;
const sandbox = sinon.createSandbox();

describe('Context', function () {
  beforeEach(function () {
    driver = new AndroidDriver();
    driver.adb = sandbox.stub();
    driver.adb.curDeviceId = 'device_id';
    driver.adb.getAdbServerPort = sandbox.stub().returns(5555);
    sandbox.stub(Chromedriver.prototype, 'restart');
    sandbox.stub(Chromedriver.prototype, 'start');
    sandbox.stub(Chromedriver.prototype.proxyReq, 'bind').returns('proxy');

    stubbedChromedriver = sinon.stub();
    stubbedChromedriver.jwproxy = sinon.stub();
    stubbedChromedriver.jwproxy.command = sinon.stub();
    stubbedChromedriver.jwproxy.command.bind = sinon.stub();
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
      await expect(driver.getCurrentContext()).to.become('current_context');
    });
    it('should return NATIVE_APP if no context is set', async function () {
      driver.curContext = null as any;
      await expect(driver.getCurrentContext()).to.become(webviewHelpers.NATIVE_WIN);
    });
  });
  describe('getContexts', function () {
    it('should get Chromium context where appropriate', async function () {
      const getWebViewsMappingStub = sandbox.stub(webviewHelpers, 'getWebViewsMapping');
      driver = new AndroidDriver({browserName: 'Chrome'} as any);
      expect(await driver.getContexts()).to.include(CHROMIUM_WIN);
      expect(getWebViewsMappingStub.calledOnce).to.be.true;
    });
    it('should use ADB to figure out which webviews are available', async function () {
      const parseWebviewNamesStub = sandbox
        .stub(webviewHelpers, 'parseWebviewNames')
        .returns(['DEFAULT', 'VW', 'ANOTHER']);
      const getWebViewsMappingStub = sandbox.stub(webviewHelpers, 'getWebViewsMapping');
      expect(await driver.getContexts()).to.not.include(CHROMIUM_WIN);
      expect(parseWebviewNamesStub.calledOnce).to.be.true;
      expect(getWebViewsMappingStub.calledOnce).to.be.true;
    });
  });
  describe('setContext', function () {
    beforeEach(function () {
      sandbox.stub(webviewHelpers, 'getWebViewsMapping').returns([
        {webviewName: 'DEFAULT', pages: ['PAGE']},
        {webviewName: 'WV', pages: ['PAGE']},
        {webviewName: 'ANOTHER', pages: ['PAGE']},
      ]);
      sandbox.stub(driver, 'switchContext');
    });
    it('should switch to default context if name is null', async function () {
      sandbox.stub(driver, 'defaultContextName').returns('DEFAULT');
      sandbox
        .stub(webviewHelpers, 'parseWebviewNames')
        .returns(['DEFAULT', 'VW', 'ANOTHER'] as any);
      await driver.setContext(null as any);
      expect(
        (driver.switchContext as sinon.SinonStub).calledWithExactly('DEFAULT', [
          {webviewName: 'DEFAULT', pages: ['PAGE']},
          {webviewName: 'WV', pages: ['PAGE']},
          {webviewName: 'ANOTHER', pages: ['PAGE']},
        ]),
      ).to.be.true;
      expect(driver.curContext).to.equal('DEFAULT');
    });
    it('should switch to default web view if name is WEBVIEW', async function () {
      sandbox.stub(driver, 'defaultWebviewName').returns('WV');
      sandbox.stub(webviewHelpers, 'parseWebviewNames').returns(['DEFAULT', 'WV', 'ANOTHER']);
      await driver.setContext(WEBVIEW_WIN);
      expect(
        (driver.switchContext as sinon.SinonStub).calledWithExactly('WV', [
          {webviewName: 'DEFAULT', pages: ['PAGE']},
          {webviewName: 'WV', pages: ['PAGE']},
          {webviewName: 'ANOTHER', pages: ['PAGE']},
        ]),
      ).to.be.true;
      expect(driver.curContext).to.equal('WV');
    });
    it('should throw error if context does not exist', async function () {
      await expect(driver.setContext('fake')).to.be.rejectedWith(errors.NoSuchContextError);
    });
    it('should not switch to context if already in it', async function () {
      driver.curContext = 'ANOTHER';
      await driver.setContext('ANOTHER');
      expect((driver.switchContext as sinon.SinonStub).notCalled).to.be.true;
    });
  });
  describe('switchContext', function () {
    beforeEach(function () {
      sandbox.stub(driver, 'stopChromedriverProxies');
      sandbox.stub(driver, 'startChromedriverProxy');
      sandbox.stub(driver, 'isChromedriverContext');
      driver.curContext = 'current_cntx';
    });
    it('should start chrome driver proxy if requested context is webview', async function () {
      (driver.isChromedriverContext as sinon.SinonStub).returns(true);
      await driver.switchContext('context', ['current_cntx', 'context'] as any);
      expect(
        (driver.startChromedriverProxy as sinon.SinonStub).calledWithExactly('context', [
          'current_cntx',
          'context',
        ] as any),
      ).to.be.true;
    });
    it('should stop chromedriver proxy if current context is webview and requested context is not', async function () {
      driver.opts = {recreateChromeDriverSessions: true} as any;
      (driver.isChromedriverContext as sinon.SinonStub).withArgs('requested_cntx').returns(false);
      (driver.isChromedriverContext as sinon.SinonStub).withArgs('current_cntx').returns(true);
      await driver.switchContext('requested_cntx', []);
      expect((driver.stopChromedriverProxies as sinon.SinonStub).calledOnce).to.be.true;
    });
    it('should suspend chrome driver proxy if current context is webview and requested context is not', async function () {
      driver.opts = {recreateChromeDriverSessions: false} as any;
      (driver.isChromedriverContext as sinon.SinonStub).withArgs('requested_cntx').returns(false);
      (driver.isChromedriverContext as sinon.SinonStub).withArgs('current_cntx').returns(true);
      const suspendChromedriverProxyStub2 = sandbox.stub(driver, 'suspendChromedriverProxy');
      await driver.switchContext('requested_cntx', []);
      expect(suspendChromedriverProxyStub2.calledOnce).to.be.true;
    });
    it('should throw error if requested and current context are not webview', async function () {
      (driver.isChromedriverContext as sinon.SinonStub).withArgs('requested_cntx').returns(false);
      (driver.isChromedriverContext as sinon.SinonStub).withArgs('current_cntx').returns(false);
      await expect(driver.switchContext('requested_cntx', [])).to.be.rejectedWith(
        /switching to context/,
      );
    });
  });
  describe('defaultContextName', function () {
    it('should return NATIVE_WIN', function () {
      expect(driver.defaultContextName()).to.equal(NATIVE_WIN);
    });
  });
  describe('defaultWebviewName', function () {
    it('should return WEBVIEW with package if "autoWebviewName" option is not set', function () {
      driver.opts = {appPackage: 'pkg'} as any;
      expect(driver.defaultWebviewName()).to.equal(WEBVIEW_BASE + 'pkg');
    });
    it('should return WEBVIEW with value from "autoWebviewName" option', function () {
      driver.opts = {appPackage: 'pkg', autoWebviewName: 'foo'} as any;
      expect(driver.defaultWebviewName()).to.equal(WEBVIEW_BASE + 'foo');
    });
  });
  describe('isWebContext', function () {
    it('should return true if current context is not native', function () {
      driver.curContext = 'current_context';
      expect(driver.isWebContext()).to.be.true;
    });
  });
  describe('startChromedriverProxy', function () {
    beforeEach(function () {
      sandbox.stub(driver, 'onChromedriverStop');
    });
    it('should start new chromedriver session', async function () {
      await driver.startChromedriverProxy('WEBVIEW_1', []);
      expect(driver.sessionChromedrivers.WEBVIEW_1).to.equal(driver.chromedriver);
      expect(
        (driver.chromedriver?.start as sinon.SinonStub).getCall(0).args[0].chromeOptions
          .androidDeviceSerial,
      ).to.equal('device_id');
      expect(
        (driver.chromedriver!.proxyReq.bind as sinon.SinonStub).calledWithExactly(
          driver.chromedriver,
        ),
      ).to.be.true;
      expect(driver.proxyReqRes).to.equal('proxy');
      expect(driver.jwpProxyActive).to.be.true;
    });
    it('should be able to extract package from context name', async function () {
      driver.opts.appPackage = 'pkg';
      driver.opts.extractChromeAndroidPackageFromContextName = true;
      await driver.startChromedriverProxy('WEBVIEW_com.pkg', []);
      expect(
        (driver.chromedriver?.start as sinon.SinonStub).getCall(0).args[0].chromeOptions,
      ).to.deep.include({androidPackage: 'com.pkg'});
    });
    it('should use package from opts if package extracted from context is empty', async function () {
      driver.opts.appPackage = 'pkg';
      driver.opts.extractChromeAndroidPackageFromContextName = true;
      await driver.startChromedriverProxy('WEBVIEW_', []);
      expect(
        (driver.chromedriver?.start as sinon.SinonStub).getCall(0).args[0].chromeOptions,
      ).to.deep.include({androidPackage: 'pkg'});
    });
    it('should handle chromedriver event with STATE_STOPPED state', async function () {
      await driver.startChromedriverProxy('WEBVIEW_1', []);
      await driver.chromedriver!.emit(Chromedriver.EVENT_CHANGED, {
        state: Chromedriver.STATE_STOPPED,
      });
      expect((driver.onChromedriverStop as sinon.SinonStub).calledWithExactly('WEBVIEW_1')).to.be
        .true;
    });
    it('should ignore events if status is not STATE_STOPPED', async function () {
      await driver.startChromedriverProxy('WEBVIEW_1', []);
      await driver.chromedriver!.emit(Chromedriver.EVENT_CHANGED, {state: 'unhandled_state'});
      expect((driver.onChromedriverStop as sinon.SinonStub).notCalled).to.be.true;
    });
    it('should reconnect if session already exists', async function () {
      stubbedChromedriver.hasWorkingWebview = sinon.stub().returns(true);
      driver.sessionChromedrivers = {WEBVIEW_1: stubbedChromedriver};
      await driver.startChromedriverProxy('WEBVIEW_1', []);
      expect((driver.chromedriver?.restart as sinon.SinonStub).notCalled).to.be.true;
      expect(driver.chromedriver).to.equal(stubbedChromedriver);
    });
    it('should restart if chromedriver has not working web view', async function () {
      stubbedChromedriver.hasWorkingWebview = sinon.stub().returns(false);
      driver.sessionChromedrivers = {WEBVIEW_1: stubbedChromedriver};
      await driver.startChromedriverProxy('WEBVIEW_1', []);
      expect((driver.chromedriver?.restart as sinon.SinonStub).calledOnce).to.be.true;
    });
  });
  describe('suspendChromedriverProxy', function () {
    it('should suspend chrome driver proxy', async function () {
      driver.suspendChromedriverProxy();
      expect(driver.chromedriver == null).to.be.true;
      expect(driver.proxyReqRes == null).to.be.true;
      expect(driver.jwpProxyActive).to.be.false;
    });
  });
  describe('onChromedriverStop', function () {
    it('should call startUnexpectedShutdown if chromedriver in active context', async function () {
      const startUnexpectedShutdownStub = sinon.stub(driver, 'startUnexpectedShutdown');
      driver.curContext = 'WEBVIEW_1';
      await driver.onChromedriverStop('WEBVIEW_1');
      const arg0 = startUnexpectedShutdownStub.getCall(0).args[0];
      expect(arg0).to.be.an('error');
      expect(arg0.message).to.include('Chromedriver quit unexpectedly during session');
    });
    it('should delete session if chromedriver in non-active context', async function () {
      driver.curContext = 'WEBVIEW_1';
      driver.sessionChromedrivers = {WEBVIEW_2: 'CHROMIUM' as any};
      await driver.onChromedriverStop('WEBVIEW_2');
      expect(driver.sessionChromedrivers).to.be.empty;
    });
  });
  describe('stopChromedriverProxies', function () {
    it('should stop all chromedriver', async function () {
      driver.sessionChromedrivers = {
        WEBVIEW_1: stubbedChromedriver,
        WEBVIEW_2: stubbedChromedriver,
      };
      const suspendChromedriverProxyStub = sandbox.stub(driver, 'suspendChromedriverProxy');
      await driver.stopChromedriverProxies();
      expect(suspendChromedriverProxyStub.calledOnce).to.be.true;
      expect(stubbedChromedriver.removeAllListeners.calledWithExactly(Chromedriver.EVENT_CHANGED))
        .to.be.true;
      expect(stubbedChromedriver.removeAllListeners.calledTwice).to.be.true;
      expect(stubbedChromedriver.stop.calledTwice).to.be.true;
      expect(driver.sessionChromedrivers).to.be.empty;
    });
  });
  describe('isChromedriverContext', function () {
    it('should return true if context is webview or chromium', function () {
      expect(driver.isChromedriverContext(WEBVIEW_WIN + '_1')).to.be.true;
      expect(driver.isChromedriverContext(CHROMIUM_WIN)).to.be.true;
    });
  });
  describe('setupNewChromedriver', function () {
    it('should be able to set app package from chrome options', async function () {
      const chromedriver = await setupNewChromedriver.bind(driver)({
        chromeOptions: {androidPackage: 'apkg'},
      });
      expect(chromedriver.start.getCall(0).args[0].chromeOptions.androidPackage).to.equal('apkg');
    });
    it('should use prefixed chromeOptions', async function () {
      const chromedriver = await setupNewChromedriver.bind(driver)({
        'goog:chromeOptions': {
          androidPackage: 'apkg',
        },
      });
      expect(chromedriver.start.getCall(0).args[0].chromeOptions.androidPackage).to.equal('apkg');
    });
    it('should merge chromeOptions', async function () {
      const chromedriver = await setupNewChromedriver.bind(driver)({
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
      expect(chromedriver.start.getCall(0).args[0].chromeOptions.androidPackage).to.equal('apkg');
      expect(chromedriver.start.getCall(0).args[0].chromeOptions.androidActivity).to.equal('aact');
      expect(chromedriver.start.getCall(0).args[0].chromeOptions.androidWaitPackage).to.equal(
        'bpkg',
      );
    });
    it('should be able to set androidActivity chrome option', async function () {
      const chromedriver = await setupNewChromedriver.bind(driver)({chromeAndroidActivity: 'act'});
      expect(chromedriver.start.getCall(0).args[0].chromeOptions.androidActivity).to.equal('act');
    });
    it('should be able to set androidProcess chrome option', async function () {
      const chromedriver = await setupNewChromedriver.bind(driver)({chromeAndroidProcess: 'proc'});
      expect(chromedriver.start.getCall(0).args[0].chromeOptions.androidProcess).to.equal('proc');
    });
    it('should be able to set loggingPrefs capability', async function () {
      const chromedriver = await setupNewChromedriver.bind(driver)({
        enablePerformanceLogging: true,
      });
      expect(chromedriver.start.getCall(0).args[0].loggingPrefs).to.deep.equal({
        performance: 'ALL',
      });
    });
    it('should use prefixed logging preferences', async function () {
      const chromedriver = await setupNewChromedriver.bind(driver)({
        'goog:loggingPrefs': {performance: 'ALL', browser: 'INFO'},
      });
      expect(chromedriver.start.getCall(0).args[0].loggingPrefs).to.deep.equal({
        performance: 'ALL',
        browser: 'INFO',
      });
    });
    it('should set androidActivity to appActivity if browser name is chromium-webview', async function () {
      const chromedriver = await setupNewChromedriver.bind(driver)({
        browserName: 'chromium-webview',
        appActivity: 'app_act',
      });
      expect(chromedriver.start.getCall(0).args[0].chromeOptions.androidActivity).to.equal(
        'app_act',
      );
    });
    it('should be able to set pageLoad strategy', async function () {
      const chromedriver = await setupNewChromedriver.bind(driver)({pageLoadStrategy: 'strategy'});
      expect(chromedriver.start.getCall(0).args[0].pageLoadStrategy).to.equal('strategy');
    });
  });

  describe('getChromePkg', function () {
    it('should return pakage for chromium', function () {
      expect(webviewHelpers.getChromePkg('chromium')).to.deep.equal({
        pkg: 'org.chromium.chrome.shell',
        activity: '.ChromeShellActivity',
      });
    });
    it('should return pakage for chromebeta', function () {
      expect(webviewHelpers.getChromePkg('chromebeta')).to.deep.equal({
        pkg: 'com.chrome.beta',
        activity: 'com.google.android.apps.chrome.Main',
      });
    });
    it('should return pakage for browser', function () {
      expect(webviewHelpers.getChromePkg('browser')).to.deep.equal({
        pkg: 'com.android.browser',
        activity: 'com.android.browser.BrowserActivity',
      });
    });
    it('should return pakage for chromium-browser', function () {
      expect(webviewHelpers.getChromePkg('chromium-browser')).to.deep.equal({
        pkg: 'org.chromium.chrome',
        activity: 'com.google.android.apps.chrome.Main',
      });
    });
    it('should return pakage for chromium-webview', function () {
      expect(webviewHelpers.getChromePkg('chromium-webview')).to.deep.equal({
        pkg: 'org.chromium.webview_shell',
        activity: 'org.chromium.webview_shell.WebViewBrowserActivity',
      });
    });
  });
});
