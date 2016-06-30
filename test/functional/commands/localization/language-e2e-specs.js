import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../../..';
import sampleApps from 'sample-apps';

chai.should();
chai.use(chaiAsPromised);

let driver;
let defaultCaps = {
  app: sampleApps('ApiDemos-debug'),
  deviceName: 'Android',
  platformName: 'Android'
};

describe('Localization - language and country @skip-ci @skip-real-device', function () {
  before(async () => {
    driver = new AndroidDriver();
    await driver.createSession(defaultCaps);
  });
  after(async () => {
    await driver.deleteSession();
  });
  it('should set language to FR', async () => {
    await driver.adb.setDeviceLanguage('FR');
    await driver.adb.getDeviceLanguage().should.eventually.equal('fr');
  });
  it('should set country to US', async () => {
    await driver.adb.setDeviceCountry('US');
    await driver.adb.getDeviceCountry().should.eventually.equal('US');
  });
});

describe('Localization - locale @skip-ci @skip-real-device', function () {
  // Stalls on API 23, works in CI
  beforeEach(async () => {
    driver = new AndroidDriver();
  });
  after(async () => {
    await driver.deleteSession();
  });
  it('should start as FR', async () => {
    let frCaps = Object.assign({}, defaultCaps, {locale: 'FR'});
    await driver.createSession(frCaps);
    await driver.adb.getDeviceCountry().should.eventually.equal('FR');
  });
  it('should start as US', async () => {
    let usCaps = Object.assign({}, defaultCaps, {locale: 'US'});
    await driver.createSession(usCaps);
    await driver.adb.getDeviceCountry().should.eventually.equal('US');
  });
});
