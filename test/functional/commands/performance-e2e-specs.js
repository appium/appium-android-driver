import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../..';
import { SUPPORTED_PERFORMANCE_DATA_TYPES, CPU_KEYS, MEMORY_KEYS, BATTERY_KEYS, NETWORK_KEYS } from '../../../lib/commands/performance';
import _ from 'lodash';
import DEFAULT_CAPS from '../desired';


chai.should();
chai.use(chaiAsPromised);

let driver;
let caps = _.defaults({
  appPackage: 'io.appium.android.apis',
  appActivity: '.view.TextFields'
}, DEFAULT_CAPS);

describe('performance', () => {
  before(async () => {
    driver = new AndroidDriver();
    await driver.createSession(caps);
  });
  after(async () => {
    await driver.deleteSession();
  });

  describe('getPerformanceData', () => {
    it('should get the performancedata', async () => {
      let capability = await driver.getPerformanceDataTypes();
      capability.should.eql(_.keys(SUPPORTED_PERFORMANCE_DATA_TYPES));
    });

    it('should throw an Error for unsupported capability data type ', async  () => {
      await driver.getPerformanceData(caps.appPackage, 'randominfo', 2).should.be.rejected;
    });

    it('should get the amount of cpu by user and kernel process', async function () {
      // TODO: why does this fail?
      let apiLevel = await driver.adb.getApiLevel();
      if (apiLevel === '25' || apiLevel === '24' || apiLevel === '21') {
        return this.skip();
      }
      let cpu = await driver.getPerformanceData(caps.appPackage, 'cpuinfo', 50);

      Array.isArray(cpu).should.be.true;
      cpu.length.should.be.above(1);
      cpu[0].should.eql(CPU_KEYS);
      if (cpu.length > 1) {
        for (let i = 1; i < cpu.length; i++) {
          cpu[0].length.should.equal(cpu[i].length);
        }
      }
    });
    it('should get the amount of memory used by the process', async () => {
      let memory = await driver.getPerformanceData(caps.appPackage, 'memoryinfo', 2);

      Array.isArray(memory).should.be.true;
      memory.length.should.be.above(1);
      memory[0].should.eql(MEMORY_KEYS);
      if (memory.length > 1) {
        for (let i = 1; i < memory.length; i++) {
          memory[0].length.should.equal(memory[i].length);
        }
      }
    });
    it('should get the remaining battery power', async () => {
      let battery = await driver.getPerformanceData(caps.appPackage, 'batteryinfo', 2);

      Array.isArray(battery).should.be.true;
      battery.length.should.be.above(1);
      battery[0].should.eql(BATTERY_KEYS);
      if (battery.length > 1) {
        for (let i = 1; i < battery.length; i++) {
          battery[0].length.should.equal(battery[i].length);
        }
      }
    });
    it('should get the network statistics', async function () {
      // TODO: why does adb fail with a null pointer exception on 5.1
      if (await driver.adb.getApiLevel() === '22') {
        return this.skip();
      }
      let network = await driver.getPerformanceData(caps.appPackage, 'networkinfo', 2);

      Array.isArray(network).should.be.true;
      network.length.should.be.above(1);

      let compare = false;
      for (let j = 0; j < NETWORK_KEYS.length; ++j) {
        if (_.isEqual(NETWORK_KEYS[j], network[0])) {
          compare = true;
        }
      }

      compare.should.equal(true);

      if (network.length > 1) {
        for (let i = 1; i < network.length; ++i) {
          network[0].length.should.equal(network[i].length);
        }
      }
    });
  });
});
