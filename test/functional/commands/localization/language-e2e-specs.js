import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../../..';
import DEFAULT_CAPS from '../../desired';


chai.should();
chai.use(chaiAsPromised);

describe('Localization - locale @skip-ci @skip-real-device', function () {
  let driver;
  beforeEach(async () => {
    driver = new AndroidDriver();
  });
  after(async () => {
    await driver.adb.setDeviceCountry('US');

    await driver.deleteSession();
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
