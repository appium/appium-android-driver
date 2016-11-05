import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../..';
import sampleApps from 'sample-apps';
import { SUPPORTED_PERFORMANCE_DATA_TYPES, CPU_KEYS, MEMORY_KEYS, BATTERY_KEYS, NETWORK_KEYS } from '../../../lib/commands/performance.js';//SUPPORTED_PERFORMANCE_DATA_TYPES,CPU_KEYS,
import _ from 'lodash';

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
      let capability = await driver.getPerformanceDataTypes();
      capability.should.eventually.equal(_.keys(SUPPORTED_PERFORMANCE_DATA_TYPES));
    });
    
    it('should throw an Error for unsupported capability data type ', () => {
      (driver.getPerformanceData('io.appium.android.apis', 'info', 1000)).should.eventually.be.rejected;
    });
    
    it('should get the amount of cpu by user and kernel process', async () => {
      let cpu = await driver.getPerformanceData('io.appium.android.apis', 'cpuinfo', 1000);
      cpu.length.should.be.above(0);
      cpu[0].should.eventually.equal(CPU_KEYS);
      if (cpu.length > 1) {
        for (let i = 1; i < cpu.length; ++i){
          cpu[0].length.should.eventually.equal(cpu[i].length);
        }
      }
    });
    it('should get the amount of memory used by the process', async () => {
      let memory = await driver.getPerformanceData('io.appium.android.apis', 'memoryinfo', 1000);
      memory.length.should.be.above(0);
      memory[0].sohuld.eventually.equal(MEMORY_KEYS);
      if (memory.length > 1) {
        for (let i = 1; i < memory.length; ++i){
          memory[0].length.should.eventually.equal(memory[i].length);
        }
      }
    });
    it('should get the remaining battery power', () => {
      let battery = driver.getPerformanceData('io.appium.android.apis', 'batteryinfo', 1000);
      battery.length.should.be.above(0);
      battery[0].should.eventually.equal(BATTERY_KEYS);
      if (battery.length > 1) {
        for (let i = 1; i < battery.length; ++i){
          battery[0].length.should.eventually.equal(battery[i].length);
        }
      }      
    });
    it('should get the network statistics', () => {
      let network = driver.getPerformanceData('io.appium.android.apis', 'networkinfo', 1000);
      network.should.be.above(0);
      _.indexOf(NETWORK_KEYS, network[0]).should.be.above(-1);
      if (network.length > 1) {
        for (let i = 1; i < network.length; ++i){
          network[0].length.should.eventually.equal(network[i].length);
        }
      }
    });
  });
});
