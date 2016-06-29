import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import webviewHelpers from '../../../lib/webview-helpers';
import AndroidDriver from '../../..';

let driver;
let sandbox = sinon.sandbox.create();
let expect = chai.expect;
chai.should();
chai.use(chaiAsPromised);

describe('Context', () => {
  describe('getContexts', () => {
    after(() => {
      sandbox.restore();
    });
    it('should get Chromium context where appropriate', async () => {
      driver = new AndroidDriver({browserName: 'Chrome'});
      expect(await driver.getContexts()).to.include('CHROMIUM');
    });
    it('should use ADB to figure out which webviews are available', async () => {
      sandbox.stub(webviewHelpers, 'getWebviews');
      driver = new AndroidDriver();
      expect(await driver.getContexts()).to.not.include('CHROMIUM');
      webviewHelpers.getWebviews.calledOnce.should.be.true;
    });
  });
  describe('setContext', () => {
    beforeEach(() => {
      driver = new AndroidDriver();
      sandbox.stub(driver, 'getContexts', () => { return ['CHROMIUM', 'ANOTHER']; });
    });
    afterEach(() => {
      sandbox.restore();
    });
    it('should proxy commands directly to chromedriver', async () => {
      sandbox.stub(driver, 'startChromedriverProxy');
      await driver.setContext('CHROMIUM');
      driver.startChromedriverProxy.calledOnce.should.be.true;
    });
    it('should kill existing chromedrivers', async () => {
      sandbox.stub(driver, 'stopChromedriverProxies');
      driver.opts.recreateChromeDriverSessions = true;
      driver.curContext = 'CHROMIUM';
      await driver.setContext('ANOTHER');
      driver.stopChromedriverProxies.calledOnce.should.be.true;
    });
    it('should suspend Chromedriver proxy', async () => {
      sandbox.stub(driver, 'suspendChromedriverProxy');
      driver.curContext = 'CHROMIUM';
      await driver.setContext('ANOTHER');
      driver.suspendChromedriverProxy.calledOnce.should.be.true;
    });
    it('should throw an error for unkown contexts', async () => {
      sandbox.stub(driver, 'suspendChromedriverProxy');
      driver.curContext = 'FOO';
      await driver.setContext('ANOTHER').should.eventually.be.rejectedWith(/switching to context/);
    });
  });
  describe('startChromedriverProxy', () => {
    it('should throw an error if a chromedriver instance is already running', async () => {
      driver = new AndroidDriver();
      driver.chromedriver = 'CHROMIUM';
      await driver.startChromedriverProxy('CHROMIUM').should.eventually.be.rejectedWith(/instance running/);
    });
  });
});
