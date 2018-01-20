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

  let initialLocale;

  before(async function () {
    if (process.env.TRAVIS) return this.skip(); //eslint-disable-line curly

    // restarting doesn't work on Android 7
    let adb = new ADB();
    if (await adb.getApiLevel() > 23) return this.skip(); //eslint-disable-line curly

    initialLocale = await getLocale(adb);
  });

  let driver;
  beforeEach(async function () {
    driver = new AndroidDriver();
  });
  after(async function () {
    if (driver) {
      await driver.adb.setDeviceCountry(initialLocale);

      await driver.deleteSession();
    }
  });

  async function getLocale (adb) {
    if (await adb.getApiLevel() < 23) {
      return await adb.getDeviceCountry();
    } else {
      return await adb.getDeviceLocale();
    }
  }

  it('should start as FR', async function () {
    let frCaps = Object.assign({}, DEFAULT_CAPS, {locale: 'FR'});
    await driver.createSession(frCaps);
    await getLocale(driver.adb).should.eventually.equal('FR');
  });
  it('should start as US', async function () {
    let usCaps = Object.assign({}, DEFAULT_CAPS, {locale: 'US'});
    await driver.createSession(usCaps);
    await getLocale(driver.adb).should.eventually.equal('US');
  });
});
