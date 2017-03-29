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
  let driver = new AndroidDriver();
  let adb = new ADB();
  driver.adb = adb;

  describe('recording the screen', withMocks({adb, driver}, (mocks) => {
    it('should start and stop recording the screen', async () => {
      let cmd, data, length, result_ls_al_testfile_toArray, availableDataIndex, fileSizeBefore, fileSizeAfter;

      // the test file is already exist, then delete the file
      cmd = ['rm', '/sdcard/test.mp4'];   
      mocks.adb.expects('shell').withExactArgs(cmd).returns("");     
      data = await adb.shell(cmd); 

      // start recording the screen
      mocks.driver.expects('startRecordingScreen').withExactArgs('/sdcard/test.mp4', 'default', -1, -1).returns("");
      await driver.startRecordingScreen('/sdcard/test.mp4', 'default', -1, -1);

      // check the file is created
      cmd = ['ls', '/sdcard/test.mp4', '|', 'grep', 'No such file'];
      mocks.adb.expects('shell').withExactArgs(cmd).returns("");
      data = await adb.shell(cmd); 

      data.length.should.equal(0);

      // get the file size
      cmd = ['ls', '-al', '/sdcard/test.mp4'];
      mocks.adb.expects('shell').withExactArgs(cmd).returns("-rw-rw---- root     sdcard_rw   109135 2017-03-20 21:37 test.mp4");
      data = await adb.shell(cmd); 

      result_ls_al_testfile_toArray = data.split(" ");
      length = _.size(result_ls_al_testfile_toArray);
      availableDataIndex = 0;
      
      for (let i = 0 ; i < length ; ++ i){
        if ( _.size(result_ls_al_testfile_toArray[i]) > 0 ){
          availableDataIndex++;
          //check it is started to capture the screen
          if (availableDataIndex === 4){
            fileSizeBefore = result_ls_al_testfile_toArray[i] * 1;
            break;
          }
        }
      }

      // wait for 3 seconds
      await sleep(3000);  
      
      // get the file size
      cmd = ['ls', '-al', '/sdcard/test.mp4'];
      mocks.adb.expects('shell').withExactArgs(cmd).returns("-rw-rw---- root     sdcard_rw   209135 2017-03-20 21:37 test.mp4");
      data = await adb.shell(cmd); 

      result_ls_al_testfile_toArray = data.split(" ");
      length = _.size(result_ls_al_testfile_toArray);
      availableDataIndex = 0;
      
      for (let i = 0 ; i < length ; ++ i){
        if ( _.size(result_ls_al_testfile_toArray[i]) > 0 ){
          availableDataIndex++;
          //check it is started to capture the screen
          if (availableDataIndex === 4){
            fileSizeAfter = result_ls_al_testfile_toArray[i] * 1;
            break;
          }
        }
      }

      // check the file size is increased than 3 seconds ago
      fileSizeAfter.should.be.above(fileSizeBefore);

      //stop recording the screen
      mocks.driver.expects('stopRecordingScreen').returns("");      
      await driver.stopRecordingScreen(); 

      // get the file size
      cmd = ['ls', '-al', '/sdcard/test.mp4'];
      mocks.adb.expects('shell').withExactArgs(cmd).returns("-rw-rw---- root     sdcard_rw   309135 2017-03-20 21:37 test.mp4");
      data = await adb.shell(cmd); 

      result_ls_al_testfile_toArray = data.split(" ");
      length = _.size(result_ls_al_testfile_toArray);
      availableDataIndex = 0;
      
      for (let i = 0 ; i < length ; ++ i){
        if ( _.size(result_ls_al_testfile_toArray[i]) > 0 ){
          availableDataIndex++;
          //check it is started to capture the screen
          if (availableDataIndex === 4){
            fileSizeBefore = result_ls_al_testfile_toArray[i] * 1;
            break;
          }
        }
      }

      // wait for 3 seconds
      await sleep(3000);

      // get the file size
      cmd = ['ls', '-al', '/sdcard/test.mp4'];
      mocks.adb.expects('shell').withExactArgs(cmd).returns("-rw-rw---- root     sdcard_rw   309135 2017-03-20 21:37 test.mp4");
      data = await adb.shell(cmd); 

      result_ls_al_testfile_toArray = data.split(" ");
      length = _.size(result_ls_al_testfile_toArray);
      availableDataIndex = 0;
      
      for (let i = 0 ; i < length ; ++ i){
        if ( _.size(result_ls_al_testfile_toArray[i]) > 0 ){
          availableDataIndex++;
          //check it is started to capture the screen
          if (availableDataIndex === 4){
            fileSizeAfter = result_ls_al_testfile_toArray[i] * 1;
            break;
          }
        }
      }

      // check the file size is increased than 3 seconds ago
      fileSizeAfter.should.be.eql(fileSizeBefore);
      
    });
  }));
});