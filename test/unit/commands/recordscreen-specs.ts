import {AndroidDriver} from '../../../lib/driver';
import {ADB} from 'appium-adb';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';

use(chaiAsPromised);

describe('recording the screen', function () {
  this.timeout(60000);

  let driver: AndroidDriver;
  let adb: ADB;
  const sandbox = sinon.createSandbox();

  beforeEach(function () {
    driver = new AndroidDriver();
    adb = new ADB();
    driver.adb = adb;
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('basic', function () {
    it('should fail to recording the screen on an older emulator', async function () {
      sandbox.stub(driver, 'isEmulator').returns(true);
      sandbox.stub(adb, 'getApiLevel').returns(26);

      await expect(driver.startRecordingScreen()).to.be.rejectedWith(/Screen recording does not work on emulators/);
    });
  });
});

