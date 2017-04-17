import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import helpers from '../../lib/android-helpers';
import ADB from 'appium-adb';
import { app } from './desired';
import { MOCHA_TIMEOUT } from './helpers';


let opts = {
  app,
  appPackage : 'io.appium.android.apis',
  androidInstallTimeout : 90000
};

chai.should();
chai.use(chaiAsPromised);

describe('android-helpers e2e', () => {
  describe('installApkRemotely', () => {
    it('installs an apk by pushing it to the device then installing it from within', async function () {
      this.timeout(MOCHA_TIMEOUT);

      let adb = await ADB.createADB();
      await adb.uninstallApk(opts.appPackage);
      await adb.isAppInstalled(opts.appPackage).should.eventually.be.false;
      await helpers.installApkRemotely(adb, opts);
      await adb.isAppInstalled(opts.appPackage).should.eventually.be.true;
    });
  });
  describe('ensureDeviceLocale', () => {
    let adb;
    before(async function () {
      adb = await ADB.createADB();

      if (process.env.TRAVIS) return this.skip();
    });
    after(async () => {
      await helpers.ensureDeviceLocale(adb, 'en', 'US');
    });
    it('should set device language and country', async function () {
      await helpers.ensureDeviceLocale(adb, 'fr', 'FR');

      if (await adb.getApiLevel() < 23) {
        await adb.getDeviceLanguage().should.eventually.equal('fr');
        await adb.getDeviceCountry().should.eventually.equal('FR');
      } else {
        await adb.getDeviceLocale().should.eventually.equal('fr-FR');
      }
    });
  });
});
