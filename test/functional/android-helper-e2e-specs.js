import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import helpers from '../../lib/android-helpers';
import sampleApps from 'sample-apps';
import ADB from 'appium-adb';

let apiDemos = sampleApps('ApiDemos-debug');
let appPackage = 'io.appium.android.apis';

chai.should();
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
  describe('ensureDeviceLocale', () => {
    it('should set device language and country', async function () {
      var adb = await ADB.createADB();
      await helpers.ensureDeviceLocale(adb, 'fr', 'FR');
      await adb.getDeviceLanguage().should.eventually.equal('fr');
      await adb.getDeviceCountry().should.eventually.equal('FR');
      // cleanup
      await helpers.ensureDeviceLocale(adb, 'en', 'US');
    });
  });
});
