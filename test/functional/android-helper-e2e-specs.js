import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import 'mochawait';
//import * as helpers from '../../lib/android-helpers';
//import ADB from 'appium-adb';
//import { withMocks } from 'appium-test-support';
import helpers from '../../../build/lib/android-helpers';
import sampleApps from 'sample-apps';
import ADB from 'appium-adb';

let apiDemos = sampleApps('ApiDemos-debug');
let appPackage = 'io.appium.android.apis';

/*const should = */chai.should();
chai.use(chaiAsPromised);

describe('android-helpers e2e', () => {

  describe('installApkRemotely', () => {

    it('installs an apk by pushing it to the device then installing it from within', async function () {
      this.timeout(15000);
      var adb = await ADB.createADB();

      await adb.uninstallApk(appPackage);
      await adb.isAppInstalled(appPackage).should.eventually.be.false;

      await helpers.installApkRemotely(adb, apiDemos, appPackage);

      await adb.isAppInstalled(appPackage).should.eventually.be.true;
    });


  });

});
