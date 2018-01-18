import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import AndroidDriver from '../../..';
import { SUPPORTED_PERFORMANCE_DATA_TYPES, NETWORK_KEYS, CPU_KEYS, BATTERY_KEYS,
         MEMORY_KEYS} from '../../../lib/commands/performance.js';
import _ from 'lodash';
import ADB from 'appium-adb';
import * as asyncbox from 'asyncbox';

chai.should();
chai.use(chaiAsPromised);

const PACKAGE_NAME = 'io.appium.android.apis';
const RETRY_PAUSE = 1000;
const RETRY_COUNT = 2;

let sandbox = sinon.sandbox.create();
let adb;
let driver;

describe('performance data', function () {
  beforeEach(async function () {
    adb = new ADB();
    driver = new AndroidDriver();
    driver.adb = adb;
    sandbox.stub(adb);
    sandbox.stub(asyncbox, 'retryInterval', async (times, sleepMs, fn) => {
      return await fn();
    });
  });
  afterEach(async function () {
    sandbox.restore();
  });
  describe('getPerformanceDataTypes', function () {
    it('should get the list of available getPerformance data type', function () {
      let types = driver.getPerformanceDataTypes();
      types.should.eql(_.keys(SUPPORTED_PERFORMANCE_DATA_TYPES));
    });
  });
  describe('getPerformanceData', function () {
    it('should return battery info', async function () {
      sandbox.stub(driver, 'getBatteryInfo').returns('data');
      await driver.getPerformanceData(null, 'batteryinfo').should.become('data');
    });
    it('should return cpu info', async function () {
      sandbox.stub(driver, 'getCPUInfo').withArgs('pkg').returns('data');
      await driver.getPerformanceData('pkg', 'cpuinfo').should.become('data');
    });
    it('should return memory info', async function () {
      sandbox.stub(driver, 'getMemoryInfo').withArgs('pkg').returns('data');
      await driver.getPerformanceData('pkg', 'memoryinfo').should.become('data');
    });
    it('should return network info', async function () {
      sandbox.stub(driver, 'getNetworkTrafficInfo').returns('data');
      await driver.getPerformanceData(null, 'networkinfo').should.become('data');
    });
    it('should throw error if data type is not valid', async function () {
      await driver.getPerformanceData(null, 'invalid')
        .should.be.rejectedWith(/No performance data of type 'invalid' found./);
    });
  });
  describe('getCPUInfo', function () {
    it('should return cpu data', async function () {
      adb.shell.withArgs(['dumpsys', 'cpuinfo', '|', 'grep', `'${PACKAGE_NAME}'`])
        .returns(' +0% 2209/io.appium.android.apis: 14% user + 23% kernel');
      (await driver.getCPUInfo(PACKAGE_NAME)).should.be.deep
        .equal([CPU_KEYS, ['14', '23']]);
      asyncbox.retryInterval.calledWith(RETRY_COUNT, RETRY_PAUSE).should.be.true;
    });
    it('should throw error if no data', async function () {
      adb.shell.returns(null);
      await driver.getCPUInfo(PACKAGE_NAME, 1).should.be
        .rejectedWith(/No data from dumpsys/);
    });
    it('should throw error if cpu data is not in valid format', async function () {
      adb.shell.returns('invalid data');
      await driver.getCPUInfo(PACKAGE_NAME, 1).should.be
        .rejectedWith(/Unable to parse cpu data/);
    });
  });
  describe('getBatteryInfo', function () {
    it('should return battery info', async function () {
      adb.shell.withArgs(['dumpsys', 'battery', '|', 'grep', 'level'])
        .returns('  level: 47');
      await driver.getBatteryInfo().should.become([BATTERY_KEYS, ['47']]);
      asyncbox.retryInterval.calledWith(RETRY_COUNT, RETRY_PAUSE).should.be.true;
    });
    it('should throw error if data is not valid', async function () {
      adb.shell.returns('invalid data');
      await driver.getBatteryInfo(1).should.be
        .rejectedWith(/Unable to parse battery data/);
    });
    it('should throw error if no data', async function () {
      adb.shell.returns(null);
      await driver.getBatteryInfo(1).should.be.rejectedWith(/No data from dumpsys/);
    });
  });
  describe('getMemoryInfo', function () {
    const shellArgs = ['dumpsys', 'meminfo', `'${PACKAGE_NAME}'`, '|', 'grep', '-E', "'Native|Dalvik|EGL|GL|TOTAL'"];
    const dumpsysDataAPI19 = `
                          Pss  Private  Private  Swapped     Heap     Heap     Heap
                        Total    Dirty    Clean    Dirty     Size    Alloc     Free
                       ------   ------   ------   ------   ------   ------   ------
         Native Heap      107      102        0        0      112      111      555
         Dalvik Heap      108      103        0        0      555      555      555
        Dalvik Other      555      555        0        0
          EGL mtrack      109      104        0      555        0        0        0
           GL mtrack      110      105        0      555        0        0        0
               TOTAL      555      555      555        0               555      555
               TOTAL      106      101      555        0      555      555      555`;
    const dumpsysDataAPI18 = `
                                Shared  Private     Heap     Heap     Heap
                          Pss    Dirty    Dirty     Size    Alloc     Free
                       ------   ------   ------   ------   ------   ------
              Native      107      555      102      112      111      555
              Dalvik      108      555      103      555      555      555
                 EGL      109      555      104      555        0        0
                  GL      110      555      105      555        0        0
               TOTAL      106      555      101      555      555      555`;
    const expectedResult = [MEMORY_KEYS,
      ['101', '102', '103', '104', '105', // private dirty total|native|dalvik|egl|gl
       '106', '107', '108', '109', '110', // pss           total|native|dalvik|egl|gl
       '111', '112']];                    // native        heap_alloc|heap_size
    it('should return memory info for API>18', async function () {
      adb.getApiLevel.returns(19);
      adb.shell.withArgs(shellArgs).returns(dumpsysDataAPI19);
      (await driver.getMemoryInfo(PACKAGE_NAME)).should.be.deep
        .equal(expectedResult);
      asyncbox.retryInterval.calledWith(RETRY_COUNT, RETRY_PAUSE).should.be.true;
    });
    it('should return memory info for API<=18', async function () {
      adb.getApiLevel.returns(18);
      adb.shell.withArgs(shellArgs).returns(dumpsysDataAPI18);
      (await driver.getMemoryInfo(PACKAGE_NAME)).should.be.deep
        .equal(expectedResult);
      asyncbox.retryInterval.calledWith(RETRY_COUNT, RETRY_PAUSE).should.be.true;
    });
    it('should throw error if data is not valid', async function () {
      adb.shell.returns('TOTAL nodex nodex nodex nodex nodex nodex nodex');
      await driver.getMemoryInfo(PACKAGE_NAME, 1).should.be
        .rejectedWith(/Unable to parse memory data/);
    });
    it('should throw error if no data', async function () {
      adb.shell.returns(null);
      await driver.getMemoryInfo(PACKAGE_NAME, 1).should.be
        .rejectedWith(/No data from dumpsys/);
    });
  });
  describe('getNetworkTrafficInfo', function () {
    const shellArgs = ['dumpsys', 'netstats'];
    const header = `
      Xt stats:
        Pending bytes: pbytes
        History since boot:
        ident=[[type=MOBILE, subType=COMBINED, subscriberId=555]] uid=-1 set=ALL tag=0x0
          NetworkStatsHistory: bucketDuration=dur`;
    const data = header + `
            st=start1 rb=rb1 rp=rp1 tb=tb1 tp=tp1 op=op1
            st=start2 rb=rb2 rp=rp2 tb=tb2 tp=tp2 op=op2`;
    const dataInOldFormat = header + `
            bucketStart=start1 activeTime=time1 rxBytes=rb1 rxPackets=rp1 txBytes=tb1 txPackets=tp1 operations=op1
            bucketStart=start2 activeTime=time2 rxBytes=rb2 rxPackets=rp2 txBytes=tb2 txPackets=tp2 operations=op2`;
    it('should return network stats', async function () {
      adb.shell.withArgs(shellArgs).returns(data);
      (await driver.getNetworkTrafficInfo()).should.be.deep
        .equal([NETWORK_KEYS[1], ['start1', undefined, 'rb1', 'rp1', 'tb1', 'tp1', 'op1', 'dur'],
                                 ['start2', undefined, 'rb2', 'rp2', 'tb2', 'tp2', 'op2', 'dur']]);
      asyncbox.retryInterval.calledWith(RETRY_COUNT, RETRY_PAUSE).should.be.true;
    });
    it('should be able to parse data in old format', async function () {
      adb.shell.withArgs(shellArgs).returns(dataInOldFormat);
      (await driver.getNetworkTrafficInfo()).should.be.deep
        .equal([NETWORK_KEYS[0], ['start1', 'time1', 'rb1', 'rp1', 'tb1', 'tp1', 'op1', 'dur'],
                                 ['start2', 'time2', 'rb2', 'rp2', 'tb2', 'tp2', 'op2', 'dur']]);
      asyncbox.retryInterval.calledWith(RETRY_COUNT, RETRY_PAUSE).should.be.true;
    });
    it('should be fulfilled if history is empty', async function () {
      adb.shell.returns(header);
      (await driver.getNetworkTrafficInfo()).should.be.deep.equal([]);
    });
    it('should throw error if data is not valid', async function () {
      adb.shell.returns('nodex');
      await driver.getNetworkTrafficInfo(1).should.be
        .rejectedWith(/Unable to parse network traffic data/);
    });
    it('should throw error if no data', async function () {
      adb.shell.returns(null);
      await driver.getNetworkTrafficInfo(1).should.be
        .rejectedWith(/No data from dumpsys/);
    });
  });
});
