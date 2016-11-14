import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
//import sinon from 'sinon';
//import Bootstrap from 'appium-android-bootstrap';
import AndroidDriver from '../../..';
//import { SUPPORTED_PERFORMANCE_DATA_TYPES } from '../../../lib/commands/performance.js';//,CPU_KEYS,
import _ from 'lodash';
import { withMocks } from 'appium-test-support';
import ADB from 'appium-adb';

chai.should();
chai.use(chaiAsPromised);

const NETWORK_KEYS = [['bucketStart', 'activeTime', 'rxBytes', 'rxPackets', 'txBytes', 'txPackets', 'operations', 'bucketDuration'], ["st", "activeTime", "rb", "rp", "tb", "tp", "op", "bucketDuration"]];
const CPU_KEYS = ["user", "kernel"];
const BATTERY_KEYS = ["power"];
const MEMORY_KEYS = ["totalPrivateDirty", "nativePrivateDirty", "dalvikPrivateDirty", "eglPrivateDirty", "glPrivateDirty", "totalPss", "nativePss", "dalvikPss", "eglPss", "glPss", "nativeHeapAllocatedSize", "nativeHeapSize"];

const SUPPORTED_PERFORMANCE_DATA_TYPES = {
  cpuinfo: 'the amount of cpu by user and kernel process - cpu information for applications on real devices and simulators',
  memoryinfo: 'the amount of memory used by the process - memory information for applications on real devices and simulators',
  batteryinfo: 'the remaining battery power - battery power information for applications on real devices and simulators',
  networkinfo: 'the network statistics - network rx/tx information for applications on real devices and simulators'
};

describe('getperformancedata', () => {
  let adb = new ADB();
  let driver = new AndroidDriver();
  driver.adb = adb;

  describe('performance', withMocks({driver, adb}, (mocks) => {
    it('should get the list of available getPerformance data type', () => {
      let returnValue = _.keys(SUPPORTED_PERFORMANCE_DATA_TYPES);
      mocks.driver.expects('getPerformanceDataTypes').withExactArgs().returns(returnValue);
      let capability = driver.getPerformanceDataTypes();
      capability.should.eql(_.keys(SUPPORTED_PERFORMANCE_DATA_TYPES));
    });
    it('should get the amount of cpu by user and kernel process', () => {
      let returnValue = [['user', 'kernel'], [0.9, 1.3]];
      mocks.driver.expects('getPerformanceData').withExactArgs('io.appium.android.apis', 'cpuinfo', 1000).returns(returnValue);
      let cpu = driver.getPerformanceData('io.appium.android.apis', 'cpuinfo', 1000);
      cpu.length.should.be.above(0);
      cpu[0].should.eql(CPU_KEYS);
      if (cpu.length > 1) {
        for (let i = 1; i < cpu.length; ++i){
          cpu[0].length.should.equal(cpu[i].length);
        }
      }
    });
    it('should get the amount of memory used by the process', () => {
      let returnValue = [['totalPrivateDirty', 'nativePrivateDirty', 'dalvikPrivateDirty', 'eglPrivateDirty', 'glPrivateDirty', 'totalPss', 'nativePss', 'dalvikPss', 'eglPss', 'glPss', 'nativeHeapAllocatedSize', 'nativeHeapSize'], [18360, 8296, 6132, null, null, 42588, 8406, 7024, null, null, 26519, 10344]];
      mocks.driver.expects('getPerformanceData').withExactArgs('io.appium.android.apis', 'memoryinfo', 1000).returns(returnValue);
      let memory = driver.getPerformanceData('io.appium.android.apis', 'memoryinfo', 1000);
      memory.length.should.be.above(0);
      memory[0].should.eql(MEMORY_KEYS);
      if (memory.length > 1) {
        for (let i = 1; i < memory.length; ++i){
          memory[0].length.should.equal(memory[i].length);
        }
      }
    });
    it('should get the remaining battery power', () => {
      let returnValue = [['power'], [23]];
      mocks.driver.expects('getPerformanceData').withExactArgs('io.appium.android.apis', 'batteryinfo', 1000).returns(returnValue);
      let battery = driver.getPerformanceData('io.appium.android.apis', 'batteryinfo', 1000);
      battery.length.should.be.above(0);
      battery[0].should.eql(BATTERY_KEYS);
      if (battery.length > 1) {
        for (let i = 1; i < battery.length; ++i){
          battery[0].length.should.equal(battery[i].length);
        }
      }      
    });
    it('should get the network statistics', () => {
      let returnValue = [['bucketStart', 'activeTime', 'rxBytes', 'rxPackets', 'txBytes', 'txPackets', 'operations', 'bucketDuration'], [1478091600000, 1099075, 610947, 928, 114362, 769, 0, 3600000], [1478095200000, 1306300, 405997, 509, 46359, 370, 0, 3600000]];
      mocks.driver.expects('getPerformanceData').withExactArgs('io.appium.android.apis', 'networkinfo', 1000).returns(returnValue);
      let network = driver.getPerformanceData('io.appium.android.apis', 'networkinfo', 1000);
      network.length.should.be.above(0);
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
      
    });
  }));
});