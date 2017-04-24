import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../..';
import { SUPPORTED_PERFORMANCE_DATA_TYPES, NETWORK_KEYS, CPU_KEYS, BATTERY_KEYS,
         MEMORY_KEYS} from '../../../lib/commands/performance.js';
import _ from 'lodash';
import { withMocks } from 'appium-test-support';
import ADB from 'appium-adb';


chai.should();
chai.use(chaiAsPromised);

const PACKAGE_NAME = 'io.appium.android.apis';

let adb = new ADB();
let driver = new AndroidDriver();
driver.adb = adb;

describe('getperformancedata', withMocks({adb, driver}, (mocks) => {
  it('should get the list of available getPerformance data type', () => {
    let types = driver.getPerformanceDataTypes();
    types.should.eql(_.keys(SUPPORTED_PERFORMANCE_DATA_TYPES));
  });

  async function runTest (type, expectedKeys, expectedData) {
    let data = await driver.getPerformanceData(PACKAGE_NAME, type);

    // make sure we got something
    Array.isArray(data).should.be.true;
    data.length.should.eql(2);

    data[0].should.eql(expectedKeys);
    data[1].should.eql(expectedData);
  }

  let types = [
    {
      cmd: 'cpuinfo',
      description: 'the amount of cpu by user and kernel process',
      args: ['dumpsys', 'cpuinfo', '|', 'grep', `'${PACKAGE_NAME}'`],
      dumpsysData: ` +0% 2209/io.appium.android.apis: 14% user + 23% kernel`,
      keys: CPU_KEYS,
      data: ['14', '23'],
    },
    {
      cmd: 'memoryinfo',
      description: 'the amount of memory used by the process (API level 19)',
      args: ['dumpsys', 'meminfo', `'${PACKAGE_NAME}'`, '|', 'grep', '-E', "'Native|Dalvik|EGL|GL|TOTAL'"],
      dumpsysData: `  Native Heap     2469     2332        0        0    20480    13920     6559
   Dalvik Heap      873      808        0        0     1526      578      948
  Dalvik Other      148      148        0        0
         TOTAL     7757     4012      976        0    22006    14498     7507`,
      keys: MEMORY_KEYS,
      data: ['4012', '2332', '808', undefined, undefined,
             '7757', '2469', '873', undefined, undefined,
             '13920', '20480'],
      apiLevel: '19',
    },
    {
      cmd: 'memoryinfo',
      description: 'the amount of memory used by the process (API level 19)',
      args: ['dumpsys', 'meminfo', `'${PACKAGE_NAME}'`, '|', 'grep', '-E', "'Native|Dalvik|EGL|GL|TOTAL'"],
      dumpsysData: `Native|Dalvik|EGL|GL|TOTAL'
       Native     1050     1236      968     7580     7428       31
       Dalvik     2637     5592     2288     3960     3453      507
        TOTAL     6796    11688     4288    11540    10881      538`,
      keys: MEMORY_KEYS,
      data: ['4288', '968', '2288', undefined, undefined,
             '6796', '1050', '2637', undefined, undefined,
             '7428', '7580'],
      apiLevel: '18',
    },
    {
      cmd: 'batteryinfo',
      description: 'the remaining battery power',
      args: ['dumpsys', 'battery', '|', 'grep', 'level'],
      dumpsysData: '  level: 47',
      keys: BATTERY_KEYS,
      data: ['47'],
    },
  ];
  for (let type of types) {
    describe(type.cmd, () => {
      afterEach(() => {
        mocks.adb.verify();
      });
      it(`should get ${type.description}`, async () => {
        if (type.apiLevel) {
          mocks.adb
            .expects('getApiLevel')
            .returns(type.apiLevel);
        }
        mocks.adb
          .expects('shell')
          .withExactArgs(type.args)
          .returns(type.dumpsysData);
        await runTest(type.cmd, type.keys, type.data);
      });
      it('should retry if the data is not initially found', async () => {
        if (type.apiLevel) {
          mocks.adb
            .expects('getApiLevel')
            .returns(type.apiLevel);
        }
        mocks.adb
          .expects('shell')
          .twice()
          .withExactArgs(type.args)
          .onCall(0)
            .returns()
          .onCall(1)
            .returns(type.dumpsysData);
        await runTest(type.cmd, type.keys, type.data);
      });
      it('should error out if too many failures', async () => {
        mocks.adb
          .expects('shell')
          .twice()
          .withExactArgs(type.args)
          .onCall(0)
            .returns()
          .onCall(1)
            .returns();
        await runTest(type.cmd, type.keys, type.data).should.be.rejected;
      });
    });
  }

  describe('networkinfo', () => {
    it('should get the network statistics', () => {
      let returnValue = [
        ['bucketStart', 'activeTime', 'rxBytes', 'rxPackets', 'txBytes', 'txPackets', 'operations', 'bucketDuration'],
        [1478091600000, 1099075, 610947, 928, 114362, 769, 0, 3600000],
        [1478095200000, 1306300, 405997, 509, 46359, 370, 0, 3600000],
      ];
      mocks.driver.expects('getPerformanceData').withExactArgs('io.appium.android.apis', 'networkinfo', 1000).returns(returnValue);
      let network = driver.getPerformanceData('io.appium.android.apis', 'networkinfo', 1000);
      network.length.should.eql(3);
      let compare = false;

      for ( let j= 0 ; j < NETWORK_KEYS.length ; ++ j){
        if (_.isEqual( NETWORK_KEYS[j], network[0])){
          compare = true;
        }
      }

      compare.should.equal(true);

      if (network.length > 1) {
        for (let i = 1; i < network.length; ++i){
          network[0].length.should.equal(network[i].length);
        }
      }
      mocks.driver.verify();
    });
  });
}));
