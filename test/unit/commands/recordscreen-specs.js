import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../..';
import { withMocks } from 'appium-test-support';
import { fs } from 'appium-support';
import temp from 'temp';
import ADB from 'appium-adb';


chai.should();
chai.use(chaiAsPromised);

let driver = new AndroidDriver();
let adb = new ADB();
driver.adb = adb;
describe('recording the screen', function () {
  this.timeout(60000);

  describe('basic', withMocks({adb, driver, fs, temp}, (mocks) => {
    it('should fail to recording the screen on an older emulator', async function () {
      mocks.driver.expects('isEmulator').returns(true);
      mocks.adb.expects('getApiLevel').returns(26);

      await driver.startRecordingScreen().should.eventually.be.rejectedWith(/Screen recording does not work on emulators/);
    });

    it('should fail to recording the screen on a device with API level 18', async function () {
      mocks.driver.expects('isEmulator').returns(false);
      mocks.adb.expects('getApiLevel').returns(18);

      await driver.startRecordingScreen().should.eventually.be.rejectedWith(/Screen recording not available on API Level 18. Minimum API Level is 19/);
    });
  }));
});
