import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../..';
import sampleApps from 'sample-apps';
import { sleep } from 'asyncbox';
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
      capability.should.eql(_.keys(SUPPORTED_PERFORMANCE_DATA_TYPES));
    });
    
    it('should throw an Error for unsupported capability data type ', () => {
      (driver.getPerformanceData('io.appium.android.apis', 'info', 1000)).should.be.rejected;
    });
    
    it('should get the amount of cpu by user and kernel process', async () => {
      let cpu = await driver.getPerformanceData('io.appium.android.apis', 'cpuinfo', 1000);
      cpu.length.should.be.above(0);
      cpu[0].should.eql(CPU_KEYS);
      if (cpu.length > 1) {
        for (let i = 1; i < cpu.length; ++i){
          cpu[0].length.should.equal(cpu[i].length);
        }
      }
    });
    it('should get the amount of memory used by the process', async () => {
      let memory = await driver.getPerformanceData('io.appium.android.apis', 'memoryinfo', 1000);
      memory.length.should.be.above(0);
      memory[0].should.eql(MEMORY_KEYS);
      if (memory.length > 1) {
        for (let i = 1; i < memory.length; ++i){
          memory[0].length.should.equal(memory[i].length);
        }
      }
    });
    it('should get the remaining battery power', () => {
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
      data = await driver.adb.shell(cmd); 

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
      data = await driver.adb.shell(cmd); 

      data.length.should.equal(0);

      // get the file size
      cmd = ['ls', '-al', '/sdcard/test.mp4'];
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
  });
});
