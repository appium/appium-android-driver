import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../..';
import sampleApps from 'sample-apps';



chai.should();
chai.use(chaiAsPromised);

let driver;
let caps = {
  app: sampleApps('ApiDemos-debug'),
  deviceName: 'Android',
  platformName: 'Android',
  appPackage: 'io.appium.android.apis',
  appActivity: '.view.TextFields'
};


describe('performance', () => {
  before(async () => {
    driver = new AndroidDriver();
    await driver.createSession(caps);
  });
  after(async () => {
    await driver.deleteSession();
  });

  describe('getPerformanceData', function () {
    beforeEach(async () => {
      await driver.startActivity(caps.appPackage, caps.appActivity);
    });

    it('should get the performancedata', async () => {
      await driver.getPerformanceData('io.appium.android.apis', 'cpuinfo', 1000).should.exist;
    });
    it('should press key code 3 with metastate', async () => {
      await driver.getPerformanceData('io.appium.android.apis', 'memoryinfo', 1000).should.exist;
    });
    it('should long press key code 3 without metastate', async () => {
      await driver.getPerformanceData('io.appium.android.apis', 'batteryinfo', 1000).should.exist;
    });
    it('should long press key code 3 with metastate', async () => {
      await driver.getPerformanceData('io.appium.android.apis', 'networkinfo', 1000).should.exist;
    });
  });
});
