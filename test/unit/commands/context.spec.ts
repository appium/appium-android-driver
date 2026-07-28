import assert from 'node:assert/strict';
import {describe, it, beforeEach, afterEach} from 'node:test';

import {ADB} from 'appium-adb';
import {Chromedriver} from 'appium-chromedriver';
import {errors} from 'appium/driver.js';
import esmock from 'esmock';
import sinon from 'sinon';

import * as webviewHelpers from '../../../lib/commands/context/helpers.js';
import {
  NATIVE_WIN,
  WEBVIEW_BASE,
  WEBVIEW_WIN,
  CHROMIUM_WIN,
  setupNewChromedriver,
} from '../../../lib/commands/context/helpers.js';
import {AndroidDriver} from '../../../lib/driver.js';

let driver: AndroidDriver;
let stubbedChromedriver: any;
const sandbox = sinon.createSandbox();

describe('Context', function () {
  beforeEach(function () {
    driver = new AndroidDriver();
    driver.adb = new ADB();
    driver.adb.curDeviceId = 'device_id';
    sandbox.stub(Chromedriver.prototype, 'restart');
    sandbox.stub(Chromedriver.prototype, 'start');
    sandbox.stub(Chromedriver.prototype.proxyReq as any, 'bind').returns('proxy');

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
      assert.strictEqual(await driver.getCurrentContext(), 'current_context');
    });
    it('should return NATIVE_APP if no context is set', async function () {
      driver.curContext = null as any;
      assert.strictEqual(await driver.getCurrentContext(), webviewHelpers.NATIVE_WIN);
    });
  });
  describe('getContexts', function () {
    async function mockContextExports(helpersOverrides: Record<string, any>) {
      return esmock('../../../lib/commands/context/exports.js', import.meta.url, {
        '../../../lib/commands/context/helpers.js': helpersOverrides,
      });
    }

    it('should get Chromium context where appropriate', async function () {
      const getWebViewsMappingStub = sandbox.stub();
      const {getContexts, assignContexts} = await mockContextExports({
        getWebViewsMapping: getWebViewsMappingStub,
      });
      driver = new AndroidDriver({browserName: 'Chrome'} as any);
      driver.getContexts = getContexts;
      driver.assignContexts = assignContexts;
      assert.ok((await driver.getContexts()).includes(CHROMIUM_WIN));
      assert.strictEqual(getWebViewsMappingStub.calledOnce, true);
    });
    it('should use ADB to figure out which webviews are available', async function () {
      const parseWebviewNamesStub = sandbox.stub().returns(['DEFAULT', 'VW', 'ANOTHER']);
      const getWebViewsMappingStub = sandbox.stub();
      const {getContexts, assignContexts} = await mockContextExports({
        getWebViewsMapping: getWebViewsMappingStub,
        parseWebviewNames: parseWebviewNamesStub,
      });
      driver.getContexts = getContexts;
      driver.assignContexts = assignContexts;
      assert.ok(!(await driver.getContexts()).includes(CHROMIUM_WIN));
      assert.strictEqual(parseWebviewNamesStub.calledOnce, true);
      assert.strictEqual(getWebViewsMappingStub.calledOnce, true);
    });
  });
  describe('setContext', function () {
    async function mockContextExports(helpersOverrides: Record<string, any>) {
      const getWebViewsMappingStub = sandbox.stub().resolves([
        {webviewName: 'DEFAULT', pages: ['PAGE'] as any},
        {webviewName: 'WV', pages: ['PAGE'] as any},
        {webviewName: 'ANOTHER', pages: ['PAGE'] as any},
      ] as any);
      const {setContext, assignContexts} = await esmock('../../../lib/commands/context/exports.js', import.meta.url, {
        '../../../lib/commands/context/helpers.js': {
          getWebViewsMapping: getWebViewsMappingStub,
          ...helpersOverrides,
        },
      });
      driver.setContext = setContext;
      driver.assignContexts = assignContexts;
    }

    beforeEach(function () {
      sandbox.stub(driver, 'switchContext');
    });
    it('should switch to default context if name is null', async function () {
      sandbox.stub(driver, 'defaultContextName').returns('DEFAULT');
      await mockContextExports({
        parseWebviewNames: sandbox.stub().returns(['DEFAULT', 'VW', 'ANOTHER']),
      });
      await driver.setContext(null as any);
      assert.strictEqual(
        (driver.switchContext as sinon.SinonStub).calledWithExactly('DEFAULT', [
          {webviewName: 'DEFAULT', pages: ['PAGE']},
          {webviewName: 'WV', pages: ['PAGE']},
          {webviewName: 'ANOTHER', pages: ['PAGE']},
        ]),
        true,
      );
      assert.strictEqual(driver.curContext, 'DEFAULT');
    });
    it('should switch to default web view if name is WEBVIEW', async function () {
      sandbox.stub(driver, 'defaultWebviewName').returns('WV');
      await mockContextExports({
        parseWebviewNames: sandbox.stub().returns(['DEFAULT', 'WV', 'ANOTHER']),
      });
      await driver.setContext(WEBVIEW_WIN);
      assert.strictEqual(
        (driver.switchContext as sinon.SinonStub).calledWithExactly('WV', [
          {webviewName: 'DEFAULT', pages: ['PAGE']},
          {webviewName: 'WV', pages: ['PAGE']},
          {webviewName: 'ANOTHER', pages: ['PAGE']},
        ]),
        true,
      );
      assert.strictEqual(driver.curContext, 'WV');
    });
    it('should throw error if context does not exist', async function () {
      await mockContextExports({});
      await assert.rejects(driver.setContext('fake'), errors.NoSuchContextError);
    });
    it('should not switch to context if already in it', async function () {
      await mockContextExports({});
      driver.curContext = 'ANOTHER';
      await driver.setContext('ANOTHER');
      assert.strictEqual((driver.switchContext as sinon.SinonStub).notCalled, true);
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
      assert.strictEqual(
        (driver.startChromedriverProxy as sinon.SinonStub).calledWithExactly('context', [
          'current_cntx',
          'context',
        ] as any),
        true,
      );
    });
    it('should stop chromedriver proxy if current context is webview and requested context is not', async function () {
      driver.opts = {recreateChromeDriverSessions: true} as any;
      (driver.isChromedriverContext as sinon.SinonStub).withArgs('requested_cntx').returns(false);
      (driver.isChromedriverContext as sinon.SinonStub).withArgs('current_cntx').returns(true);
      await driver.switchContext('requested_cntx', []);
      assert.strictEqual((driver.stopChromedriverProxies as sinon.SinonStub).calledOnce, true);
    });
    it('should suspend chrome driver proxy if current context is webview and requested context is not', async function () {
      driver.opts = {recreateChromeDriverSessions: false} as any;
      (driver.isChromedriverContext as sinon.SinonStub).withArgs('requested_cntx').returns(false);
      (driver.isChromedriverContext as sinon.SinonStub).withArgs('current_cntx').returns(true);
      const suspendChromedriverProxyStub2 = sandbox.stub(driver, 'suspendChromedriverProxy');
      await driver.switchContext('requested_cntx', []);
      assert.strictEqual(suspendChromedriverProxyStub2.calledOnce, true);
    });
    it('should throw error if requested and current context are not webview', async function () {
      (driver.isChromedriverContext as sinon.SinonStub).withArgs('requested_cntx').returns(false);
      (driver.isChromedriverContext as sinon.SinonStub).withArgs('current_cntx').returns(false);
      await assert.rejects(driver.switchContext('requested_cntx', []), /switching to context/);
    });
  });
  describe('defaultContextName', function () {
    it('should return NATIVE_WIN', function () {
      assert.strictEqual(driver.defaultContextName(), NATIVE_WIN);
    });
  });
  describe('defaultWebviewName', function () {
    it('should return WEBVIEW with package if "autoWebviewName" option is not set', function () {
      driver.opts = {appPackage: 'pkg'} as any;
      assert.strictEqual(driver.defaultWebviewName(), WEBVIEW_BASE + 'pkg');
    });
    it('should return WEBVIEW with value from "autoWebviewName" option', function () {
      driver.opts = {appPackage: 'pkg', autoWebviewName: 'foo'} as any;
      assert.strictEqual(driver.defaultWebviewName(), WEBVIEW_BASE + 'foo');
    });
  });
  describe('isWebContext', function () {
    it('should return true if current context is not native', function () {
      driver.curContext = 'current_context';
      assert.strictEqual(driver.isWebContext(), true);
    });
  });
  describe('startChromedriverProxy', function () {
    beforeEach(function () {
      sandbox.stub(driver, 'onChromedriverStop');
    });
    it('should start new chromedriver session', async function () {
      await driver.startChromedriverProxy('WEBVIEW_1', []);
      assert.strictEqual(driver.sessionChromedrivers.WEBVIEW_1, driver.chromedriver);
      assert.strictEqual(
        (driver.chromedriver!.start as sinon.SinonStub).getCall(0).args[0].chromeOptions.androidDeviceSerial,
        'device_id',
      );
      assert.strictEqual(
        (driver.chromedriver!.proxyReq.bind as sinon.SinonStub).calledWithExactly(driver.chromedriver),
        true,
      );
      assert.strictEqual(driver.proxyReqRes, 'proxy');
      assert.strictEqual(driver.jwpProxyActive, true);
    });
    it('should be able to extract package from context name', async function () {
      driver.opts.appPackage = 'pkg';
      driver.opts.extractChromeAndroidPackageFromContextName = true;
      await driver.startChromedriverProxy('WEBVIEW_com.pkg', []);
      const chromeOptions = (driver.chromedriver!.start as sinon.SinonStub).getCall(0).args[0].chromeOptions;
      assert.strictEqual(chromeOptions.androidPackage, 'com.pkg');
    });
    it('should use package from opts if package extracted from context is empty', async function () {
      driver.opts.appPackage = 'pkg';
      driver.opts.extractChromeAndroidPackageFromContextName = true;
      await driver.startChromedriverProxy('WEBVIEW_', []);
      const chromeOptions = (driver.chromedriver!.start as sinon.SinonStub).getCall(0).args[0].chromeOptions;
      assert.strictEqual(chromeOptions.androidPackage, 'pkg');
    });
    it('should grant all runtime permissions to the Chrome package when chromedriverGrantPermissions is set', async function () {
      driver.opts.appPackage = 'com.pkg';
      driver.opts.chromedriverGrantPermissions = true;
      const grantStub = sandbox.stub(driver.adb, 'grantAllPermissions').resolves();
      await driver.startChromedriverProxy('WEBVIEW_1', []);
      assert.strictEqual(grantStub.calledOnceWithExactly('com.pkg'), true);
    });
    it('should not grant permissions when chromedriverGrantPermissions is not set', async function () {
      driver.opts.appPackage = 'com.pkg';
      const grantStub = sandbox.stub(driver.adb, 'grantAllPermissions').resolves();
      await driver.startChromedriverProxy('WEBVIEW_1', []);
      assert.strictEqual(grantStub.called, false);
    });
    it('should throw when chromedriverGrantPermissions is set but the Chrome package cannot be resolved', async function () {
      driver.opts.chromedriverGrantPermissions = true;
      const grantStub = sandbox.stub(driver.adb, 'grantAllPermissions').resolves();
      await assert.rejects(driver.startChromedriverProxy('WEBVIEW_1', []), /could not be resolved/);
      assert.strictEqual(grantStub.called, false);
    });
    it('should handle chromedriver event with STATE_STOPPED state', async function () {
      await driver.startChromedriverProxy('WEBVIEW_1', []);
      driver.chromedriver!.emit(Chromedriver.EVENT_CHANGED, {
        state: Chromedriver.STATE_STOPPED,
      });
      assert.strictEqual((driver.onChromedriverStop as sinon.SinonStub).calledWithExactly('WEBVIEW_1'), true);
    });
    it('should ignore events if status is not STATE_STOPPED', async function () {
      await driver.startChromedriverProxy('WEBVIEW_1', []);
      driver.chromedriver!.emit(Chromedriver.EVENT_CHANGED, {
        state: 'unhandled_state',
      } as Parameters<Chromedriver['emit']>[1]);
      assert.strictEqual((driver.onChromedriverStop as sinon.SinonStub).notCalled, true);
    });
    it('should reconnect if session already exists', async function () {
      stubbedChromedriver.hasWorkingWebview = sinon.stub().returns(true);
      driver.sessionChromedrivers = {WEBVIEW_1: stubbedChromedriver};
      await driver.startChromedriverProxy('WEBVIEW_1', []);
      assert.strictEqual((driver.chromedriver!.restart as sinon.SinonStub).notCalled, true);
      assert.strictEqual(driver.chromedriver, stubbedChromedriver);
    });
    it('should restart if chromedriver has not working web view', async function () {
      stubbedChromedriver.hasWorkingWebview = sinon.stub().returns(false);
      driver.sessionChromedrivers = {WEBVIEW_1: stubbedChromedriver};
      await driver.startChromedriverProxy('WEBVIEW_1', []);
      assert.strictEqual((driver.chromedriver!.restart as sinon.SinonStub).calledOnce, true);
    });
  });
  describe('suspendChromedriverProxy', function () {
    it('should suspend chrome driver proxy', async function () {
      driver.suspendChromedriverProxy();
      assert.ok(driver.chromedriver == null);
      assert.ok(driver.proxyReqRes == null);
      assert.strictEqual(driver.jwpProxyActive, false);
    });
  });
  describe('onChromedriverStop', function () {
    it('should call startUnexpectedShutdown if chromedriver in active context', async function () {
      const startUnexpectedShutdownStub = sinon.stub(driver, 'startUnexpectedShutdown');
      driver.curContext = 'WEBVIEW_1';
      await driver.onChromedriverStop('WEBVIEW_1');
      const arg0 = startUnexpectedShutdownStub.getCall(0).args[0]!;
      assert.ok(arg0 instanceof Error);
      assert.ok((arg0 as Error).message.includes('Chromedriver quit unexpectedly during session'));
    });
    it('should delete session if chromedriver in non-active context', async function () {
      driver.curContext = 'WEBVIEW_1';
      driver.sessionChromedrivers = {WEBVIEW_2: 'CHROMIUM' as any};
      await driver.onChromedriverStop('WEBVIEW_2');
      assert.strictEqual(Object.keys(driver.sessionChromedrivers).length, 0);
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
      assert.strictEqual(suspendChromedriverProxyStub.calledOnce, true);
      assert.strictEqual(stubbedChromedriver.removeAllListeners.calledWithExactly(Chromedriver.EVENT_CHANGED), true);
      assert.strictEqual(stubbedChromedriver.removeAllListeners.calledTwice, true);
      assert.strictEqual(stubbedChromedriver.stop.calledTwice, true);
      assert.strictEqual(Object.keys(driver.sessionChromedrivers).length, 0);
    });
  });
  describe('isChromedriverContext', function () {
    it('should return true if context is webview or chromium', function () {
      assert.strictEqual(driver.isChromedriverContext(WEBVIEW_WIN + '_1'), true);
      assert.strictEqual(driver.isChromedriverContext(CHROMIUM_WIN), true);
    });
  });
  describe('setupNewChromedriver', function () {
    const deviceId = () => driver.adb.curDeviceId as string;
    it('should be able to set app package from chrome options', async function () {
      const chromedriver: any = await setupNewChromedriver.bind(driver)(
        {
          chromeOptions: {androidPackage: 'apkg'},
        } as any,
        deviceId(),
      );
      assert.strictEqual(chromedriver.start.getCall(0).args[0].chromeOptions.androidPackage, 'apkg');
    });
    it('should use prefixed chromeOptions', async function () {
      const chromedriver: any = await setupNewChromedriver.bind(driver)(
        {
          'goog:chromeOptions': {
            androidPackage: 'apkg',
          },
        } as any,
        deviceId(),
      );
      assert.strictEqual(chromedriver.start.getCall(0).args[0].chromeOptions.androidPackage, 'apkg');
    });
    it('should merge chromeOptions', async function () {
      const chromedriver: any = await setupNewChromedriver.bind(driver)(
        {
          chromeOptions: {
            androidPackage: 'apkg',
          },
          'goog:chromeOptions': {
            androidWaitPackage: 'bpkg',
          },
          'appium:chromeOptions': {
            androidActivity: 'aact',
          },
        } as any,
        deviceId(),
      );
      assert.strictEqual(chromedriver.start.getCall(0).args[0].chromeOptions.androidPackage, 'apkg');
      assert.strictEqual(chromedriver.start.getCall(0).args[0].chromeOptions.androidActivity, 'aact');
      assert.strictEqual(chromedriver.start.getCall(0).args[0].chromeOptions.androidWaitPackage, 'bpkg');
    });
    it('should be able to set androidActivity chrome option', async function () {
      const chromedriver: any = await setupNewChromedriver.bind(driver)(
        {chromeAndroidActivity: 'act'} as any,
        deviceId(),
      );
      assert.strictEqual(chromedriver.start.getCall(0).args[0].chromeOptions.androidActivity, 'act');
    });
    it('should be able to set androidProcess chrome option', async function () {
      const chromedriver: any = await setupNewChromedriver.bind(driver)(
        {chromeAndroidProcess: 'proc'} as any,
        deviceId(),
      );
      assert.strictEqual(chromedriver.start.getCall(0).args[0].chromeOptions.androidProcess, 'proc');
    });
    it('should be able to set loggingPrefs capability', async function () {
      const chromedriver: any = await setupNewChromedriver.bind(driver)(
        {
          enablePerformanceLogging: true,
        } as any,
        deviceId(),
      );
      assert.deepStrictEqual(chromedriver.start.getCall(0).args[0].loggingPrefs, {
        performance: 'ALL',
      });
    });
    it('should use prefixed logging preferences', async function () {
      const chromedriver: any = await setupNewChromedriver.bind(driver)(
        {
          'goog:loggingPrefs': {performance: 'ALL', browser: 'INFO'},
        } as any,
        deviceId(),
      );
      assert.deepStrictEqual(chromedriver.start.getCall(0).args[0].loggingPrefs, {
        performance: 'ALL',
        browser: 'INFO',
      });
    });
    it('should set androidActivity to appActivity if browser name is chromium-webview', async function () {
      const chromedriver: any = await setupNewChromedriver.bind(driver)(
        {
          browserName: 'chromium-webview',
          appActivity: 'app_act',
        } as any,
        deviceId(),
      );
      assert.strictEqual(chromedriver.start.getCall(0).args[0].chromeOptions.androidActivity, 'app_act');
    });
    it('should be able to set pageLoad strategy', async function () {
      const chromedriver: any = await setupNewChromedriver.bind(driver)(
        {pageLoadStrategy: 'strategy'} as any,
        deviceId(),
      );
      assert.strictEqual(chromedriver.start.getCall(0).args[0].pageLoadStrategy, 'strategy');
    });
  });

  describe('getChromePkg', function () {
    it('should return pakage for chromium', function () {
      assert.deepStrictEqual(webviewHelpers.getChromePkg('chromium'), {
        pkg: 'org.chromium.chrome.shell',
        activity: '.ChromeShellActivity',
      });
    });
    it('should return pakage for chromebeta', function () {
      assert.deepStrictEqual(webviewHelpers.getChromePkg('chromebeta'), {
        pkg: 'com.chrome.beta',
        activity: 'com.google.android.apps.chrome.Main',
      });
    });
    it('should return pakage for browser', function () {
      assert.deepStrictEqual(webviewHelpers.getChromePkg('browser'), {
        pkg: 'com.android.browser',
        activity: 'com.android.browser.BrowserActivity',
      });
    });
    it('should return pakage for chromium-browser', function () {
      assert.deepStrictEqual(webviewHelpers.getChromePkg('chromium-browser'), {
        pkg: 'org.chromium.chrome',
        activity: 'com.google.android.apps.chrome.Main',
      });
    });
    it('should return pakage for chromium-webview', function () {
      assert.deepStrictEqual(webviewHelpers.getChromePkg('chromium-webview'), {
        pkg: 'org.chromium.webview_shell',
        activity: 'org.chromium.webview_shell.WebViewBrowserActivity',
      });
    });
  });
});
