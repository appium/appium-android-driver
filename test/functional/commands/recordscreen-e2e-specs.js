import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../..';
import { sleep } from 'asyncbox';
import _ from 'lodash';
import DEFAULT_CAPS from '../desired';

chai.should();
chai.use(chaiAsPromised);

let driver;
let caps = _.defaults({
  appPackage: 'io.appium.android.apis',
  appActivity: '.view.TextFields'
}, DEFAULT_CAPS);

describe('recording the screen', () => {
  before(async () => {
    driver = new AndroidDriver();
    await driver.createSession(caps);
  });

  after(async () => {
    await driver.deleteSession();
  });

  describe('recording the screen', function () {
    beforeEach(async () => {
      await driver.startActivity(caps.appPackage, caps.appActivity);
    });

    it('should start and stop recording the screen', async () => {

      let cmd, data, length, result_ls_testmp4_toArray, availableDataIndex, fileSizeBefore, fileSizeAfter, isEmulated;
      cmd = ['ls', '/sdcard/test.mp4', '|', 'grep', 'No such file'];
      data = await driver.adb.shell(cmd); 

      length = _.size(data);
      // the same file is exist, then delete the file
      if (length <= 0){
        cmd = ['rm', '/sdcard/test.mp4'];
        data = await driver.adb.shell(cmd); 
      }
      
      isEmulated = await driver.adb.isEmulatorConnected('emulator-5554');

      if (isEmulated)
        await driver.startRecordingScreen('/sdcard/test.mp4', 'default', -1, -1).should.eventually.be.rejectedWith(/Android screen recording does not work on emulators/);
      else {
        // start recording the screen
        await driver.startRecordingScreen('/sdcard/test.mp4', 'default', -1, -1);

        // check the file is created
        cmd = ['ls', '/sdcard/test.mp4', '|', 'grep', 'No such file'];
        data = await driver.adb.shell(cmd); 

        data.length.should.equal(0);

        // get the file size
        cmd = ['ls', '-al', '/sdcard/test.mp4'];
        data = await driver.adb.shell(cmd); 

        result_ls_testmp4_toArray = data.split(" ");
        length = _.size(result_ls_testmp4_toArray);
        availableDataIndex = 0;
        
        for (let i = 0 ; i < length ; ++ i){
          if ( _.size(result_ls_testmp4_toArray[i]) > 0 ){
            availableDataIndex++;
            //check it is started to capture the screen
            if (availableDataIndex === 4){
              fileSizeBefore = result_ls_testmp4_toArray[i] * 1;
              break;
            }
          }
        }

        // wait for 3 seconds
        await sleep(3000);  
        
        // get the file size
        cmd = ['ls', '-al', '/sdcard/test.mp4'];
        data = await driver.adb.shell(cmd); 

        result_ls_testmp4_toArray = data.split(" ");
        length = _.size(result_ls_testmp4_toArray);
        availableDataIndex = 0;
        
        for (let i = 0 ; i < length ; ++ i){
          if ( _.size(result_ls_testmp4_toArray[i]) > 0 ){
            availableDataIndex++;
            //check it is started to capture the screen
            if (availableDataIndex === 4){
              fileSizeAfter = result_ls_testmp4_toArray[i] * 1;
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

        result_ls_testmp4_toArray = data.split(" ");
        length = _.size(result_ls_testmp4_toArray);
        availableDataIndex = 0;
        
        for (let i = 0 ; i < length ; ++ i){
          if ( _.size(result_ls_testmp4_toArray[i]) > 0 ){
            availableDataIndex++;
            //check it is started to capture the screen
            if (availableDataIndex === 4){
              fileSizeBefore = result_ls_testmp4_toArray[i] * 1;
              break;
            }
          }
        }

        // wait for 3 seconds
        await sleep(3000);

        // get the file size
        cmd = ['ls', '-al', '/sdcard/test.mp4'];
        data = await driver.adb.shell(cmd); 

        result_ls_testmp4_toArray = data.split(" ");
        length = _.size(result_ls_testmp4_toArray);
        availableDataIndex = 0;
        
        for (let i = 0 ; i < length ; ++ i){
          if ( _.size(result_ls_testmp4_toArray[i]) > 0 ){
            availableDataIndex++;
            //check it is started to capture the screen
            if (availableDataIndex === 4){
              fileSizeAfter = result_ls_testmp4_toArray[i] * 1;
              break;
            }
          }
        }

        // check the file size is increased than 3 seconds ago
        fileSizeAfter.should.be.eql(fileSizeBefore);
      }
    });
  });
});
