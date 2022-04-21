import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import ADB from 'appium-adb';
import AndroidDriver from '../../../../lib/driver';
import { DEFAULT_CAPS, amendCapabilities } from '../../capabilities';
import { MOCHA_TIMEOUT } from '../../helpers';


chai.should();
chai.use(chaiAsPromised);

describe('Localization - locale @skip-ci @skip-real-device', function () {
  this.timeout(MOCHA_TIMEOUT);

  let initialLocale;

  before(async function () {
    let adb = new ADB();
    initialLocale = await getLocale(adb);
  });

  let driver;
  beforeEach(function () {
    driver = new AndroidDriver();
  });
  after(async function () {
    if (driver) {
      await driver.adb.setDeviceLocale(initialLocale);
      await driver.deleteSession();
    }
  });

  async function getLocale (adb) {
    if (await adb.getApiLevel() < 23) {
      const language = await adb.getDeviceLanguage();
      const country = await adb.getDeviceCountry();
      return `${language}-${country}`;
    } else {
      return await adb.getDeviceLocale();
    }
  }

  it('should start as FR', async function () {
    let frCaps = amendCapabilities(DEFAULT_CAPS, {
      'appium:language': 'fr',
      'appium:locale': 'FR'
    });
    await driver.createSession(frCaps);
    await getLocale(driver.adb).should.eventually.equal('fr-FR');
  });
  it('should start as US', async function () {
    let usCaps = amendCapabilities(DEFAULT_CAPS, {
      'appium:language': 'en',
      'appium:locale': 'US'
    });
    await driver.createSession(usCaps);
    await getLocale(driver.adb).should.eventually.equal('en-US');
  });
});
