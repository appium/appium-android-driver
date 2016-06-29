import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import helpers from '../../lib/android-helpers';
import sampleApps from 'sample-apps';
import ADB from 'appium-adb';

let opts = {
  localApkPath : sampleApps('ApiDemos-debug'),
  pkg : 'io.appium.android.apis',
  androidInstallTimeout : 90000
};

chai.should();
chai.use(chaiAsPromised);

describe('android-helpers e2e', () => {
  describe('installApkRemotely', () => {
    it('installs an apk by pushing it to the device then installing it from within', async function () {
      this.timeout(15000);
      var adb = await ADB.createADB();
      await adb.uninstallApk(opts.pkg);
      await adb.isAppInstalled(opts.pkg).should.eventually.be.false;
      await helpers.installApkRemotely(adb, opts);
      await adb.isAppInstalled(opts.pkg).should.eventually.be.true;
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
