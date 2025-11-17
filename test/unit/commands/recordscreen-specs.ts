import {AndroidDriver} from '../../../lib/driver';
import {withMocks} from '@appium/test-support';
import {fs, tempDir} from '@appium/support';
import {ADB} from 'appium-adb';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';

use(chaiAsPromised);

const driver = new AndroidDriver();
const adb = new ADB();
driver.adb = adb;
describe('recording the screen', function () {
  this.timeout(60000);

  describe(
    'basic',
    withMocks({adb, driver, fs, tempDir}, (mocks: any) => {
      it('should fail to recording the screen on an older emulator', async function () {
        mocks.driver.expects('isEmulator').returns(true);
        mocks.adb.expects('getApiLevel').returns(26);

        await expect(driver.startRecordingScreen()).to.be.rejectedWith(/Screen recording does not work on emulators/);
      });
    })
  );
});

