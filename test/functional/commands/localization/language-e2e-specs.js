import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import ADB from 'appium-adb';
import AndroidDriver from '../../../..';
import DEFAULT_CAPS from '../../desired';
import { MOCHA_TIMEOUT } from '../../helpers';


chai.should();
chai.use(chaiAsPromised);

describe('Localization - locale @skip-ci @skip-real-device', function () {
  this.timeout(MOCHA_TIMEOUT);

  before(function () {
    if (process.env.TRAVIS) return this.skip();
  });

  let driver;
  beforeEach(async function () {
    // restarting doesn't work on Android 7
    let adb = new ADB();
    if (await adb.getApiLevel() > 23) return this.skip();

    driver = new AndroidDriver();
  });
  after(async () => {
    if (driver) {
      await driver.adb.setDeviceCountry('US');

      await driver.deleteSession();
    }
  });

  async function getLocale (adb) {
    if (await adb.getApiLevel() < 23) {
      return await adb.getDeviceCountry();
    } else {
      return await driver.adb.getDeviceLocale();
    }
  }

  it('should start as FR', async () => {
    let frCaps = Object.assign({}, DEFAULT_CAPS, {locale: 'FR'});
    await driver.createSession(frCaps);
    await getLocale(driver.adb).should.eventually.equal('FR');
  });
  it('should start as US', async () => {
    let usCaps = Object.assign({}, DEFAULT_CAPS, {locale: 'US'});
    await driver.createSession(usCaps);
    await getLocale(driver.adb).should.eventually.equal('US');
  });
});
