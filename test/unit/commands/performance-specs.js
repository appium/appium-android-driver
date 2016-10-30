import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import Bootstrap from 'appium-android-bootstrap';
import AndroidDriver from '../../..';

let driver;
let sandbox = sinon.sandbox.create();
chai.should();
chai.use(chaiAsPromised);

describe('getperformancedata', () => {
  before(() => {
    driver = new AndroidDriver();
    driver.bootstrap = new Bootstrap();
    sandbox.stub(driver, 'validateLocatorStrategy');
    sandbox.stub(driver.bootstrap, 'sendAction');
  });
  after(() => {
    sandbox.restore();
  });
  describe('performance', () => {
    it('should get the list of available getPerformance data type', () => {
      driver.getPerformanceDataTypes().should.exist;
    });
    it('should get the amount of cpu by user and kernel process', () => {
      driver.getPerformanceData('io.appium.android.apis', 'cpuinfo', 1000).should.exist;
    });
    it('should get the amount of memory used by the process', () => {
      driver.getPerformanceData('io.appium.android.apis', 'memoryinfo', 1000).should.exist;
    });
    it('should get the remaining battery power', () => {
      driver.getPerformanceData('io.appium.android.apis', 'batteryinfo', 1000).should.exist;
    });
    it('should get the network statistics', () => {
      driver.getPerformanceData('io.appium.android.apis', 'networkinfo', 1000).should.exist;
    });
  });
});
