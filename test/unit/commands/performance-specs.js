import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
//import sinon from 'sinon';
//import Bootstrap from 'appium-android-bootstrap';
import AndroidDriver from '../../..';
//import { SUPPORTED_PERFORMANCE_DATA_TYPES } from '../../../lib/commands/performance.js';//,CPU_KEYS,
import _ from 'lodash';
import { withMocks } from 'appium-test-support';
import ADB from 'appium-adb';
import { sleep } from 'asyncbox';

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
    it('should start and stop recording the screen', async () => {
      let cmd, data, length, arrayList2, availableDataIndex, fileSizeBefore, fileSizeAfter;
      cmd = ['ls', '/sdcard/test.mp4', '|', 'grep', '\'No such file\''];
      mocks.adb.expects('shell').withExactArgs(cmd).returns("/sdcard/test.mp4: No such file or directory");

      data = await adb.shell(cmd); 

      length = _.size(data);
      // the same file is exist, then delete the file
      if (length <= 0){
        cmd = ['rm', '/sdcard/test.mp4'];        
        data = await driver.adb.shell(cmd); 
      }

      // start recording the screen
      await driver.startRecordingScreen('/sdcard/test.mp4', "default", -1, -1);

      // check the file is created
      cmd = ['ls', '/sdcard/test.mp4', '|', 'grep', '\'No such file\''];
      mocks.adb.expects('shell').withExactArgs(cmd).returns("");
      data = await driver.adb.shell(cmd); 

      data.length.should.equal(0);

      // get the file size
      cmd = ['ls', '-al', '/sdcard/test.mp4'];
      mocks.adb.expects('shell').withExactArgs(cmd).returns("-rw-rw---- root     sdcard_rw   109135 2017-03-20 21:37 test.mp4");
      data = await driver.adb.shell(cmd); 

      arrayList2 = data.split(" ");
      length = _.size(arrayList2);
      availableDataIndex = 0;
      
      for (let i = 0 ; i < length ; ++ i){
        if ( _.size(arrayList2[i]) > 0 ){
          availableDataIndex++;
          //check it is started to capture the screen
          if (availableDataIndex === 4){
            fileSizeBefore = arrayList2[i] * 1;
            break;
          }
        }
      }

      // wait for 3 seconds
      await sleep(3000);  
      
      // get the file size
      cmd = ['ls', '-al', '/sdcard/test.mp4'];
      mocks.adb.expects('shell').withExactArgs(cmd).returns("-rw-rw---- root     sdcard_rw   209135 2017-03-20 21:37 test.mp4");
      data = await driver.adb.shell(cmd); 

      arrayList2 = data.split(" ");
      length = _.size(arrayList2);
      availableDataIndex = 0;
      
      for (let i = 0 ; i < length ; ++ i){
        if ( _.size(arrayList2[i]) > 0 ){
          availableDataIndex++;
          //check it is started to capture the screen
          if (availableDataIndex === 4){
            fileSizeAfter = arrayList2[i] * 1;
            break;
          }
        }
      }

      // check the file size is increased than 3 seconds ago
      fileSizeAfter.should.be.above(fileSizeBefore);

      //stop recording the screen      
      await driver.stopRecordingScreen(); 

      // get the file size
      cmd = ['ls', '-al', '/sdcard/test.mp4'];
      mocks.adb.expects('shell').withExactArgs(cmd).returns("-rw-rw---- root     sdcard_rw   309135 2017-03-20 21:37 test.mp4");
      data = await driver.adb.shell(cmd); 

      arrayList2 = data.split(" ");
      length = _.size(arrayList2);
      availableDataIndex = 0;
      
      for (let i = 0 ; i < length ; ++ i){
        if ( _.size(arrayList2[i]) > 0 ){
          availableDataIndex++;
          //check it is started to capture the screen
          if (availableDataIndex === 4){
            fileSizeBefore = arrayList2[i] * 1;
            break;
          }
        }
      }

      // wait for 3 seconds
      await sleep(3000);

      // get the file size
      cmd = ['ls', '-al', '/sdcard/test.mp4'];
      mocks.adb.expects('shell').withExactArgs(cmd).returns("-rw-rw---- root     sdcard_rw   309135 2017-03-20 21:37 test.mp4");
      data = await driver.adb.shell(cmd); 

      arrayList2 = data.split(" ");
      length = _.size(arrayList2);
      availableDataIndex = 0;
      
      for (let i = 0 ; i < length ; ++ i){
        if ( _.size(arrayList2[i]) > 0 ){
          availableDataIndex++;
          //check it is started to capture the screen
          if (availableDataIndex === 4){
            fileSizeAfter = arrayList2[i] * 1;
            break;
          }
        }
      }

      // check the file size is increased than 3 seconds ago
      fileSizeAfter.should.be.eql(fileSizeBefore);
      
    });
  }));
});