import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../..';
import _ from 'lodash';
import { withMocks } from 'appium-test-support';
import ADB from 'appium-adb';
import { sleep } from 'asyncbox';

chai.should();
chai.use(chaiAsPromised);

describe('recording the screen', () => {
  let adb = new ADB();
  let driver = new AndroidDriver();
  driver.adb = adb;

  describe('recording the screen', withMocks({driver, adb}, (mocks) => {
    it('should start and stop recording the screen', async () => {
      let cmd, data, length, arrayList2, availableDataIndex, fileSizeBefore, fileSizeAfter;
      cmd = ['ls', '/sdcard/test.mp4', '|', 'grep', '\'No such file\''];
      mocks.adb.expects('shell').withExactArgs(cmd).returns("/sdcard/test.mp4: No such file or directory");

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
