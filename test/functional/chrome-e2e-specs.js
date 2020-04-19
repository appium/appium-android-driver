import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../..';
import { ensureAVDExists } from './helpers';
import { CHROME_CAPS } from './desired';
import _ from 'lodash';
import path from 'path';


chai.should();
chai.use(chaiAsPromised);

function getChromedriver () {
  return process.env.CHROMEDRIVER_EXECUTABLE
    ? process.env.CHROMEDRIVER_EXECUTABLE
    : path.resolve(__dirname, '..', '..', '..', 'test', 'assets', 'chromedriver-2.20', 'mac', 'chromedriver');
}

const avd = process.env.ANDROID_25_AVD || 'Nexus_5_API_25';
const capabilities = _.defaults({
  avd,
  platformVersion: '7.1',
  chromeOptions: {
    args: ['--no-first-run'],
  },
  chromedriverExecutable: getChromedriver(),
  showChromedriverLog: true,
}, CHROME_CAPS);

describe('createSession', function () {
  let driver;
  before(async function () {
    if (!await ensureAVDExists(this, capabilities.avd)) {
      console.log(`Not running Chrome tests (file: '${__filename}') because the AVD '${avd}' does not exist`); // eslint-disable-line
      return;
    }

    driver = new AndroidDriver();
  });
  afterEach(async function () {
    if (driver) {
      await driver.deleteSession();
    }
  });
  it('should start chrome and dismiss the welcome dialog', async function () {
    await driver.createSession(capabilities);
    const appActivity = await driver.getCurrentActivity();
    appActivity.should.not.equal('org.chromium.chrome.browser.firstrun.FirstRunActivity');
  });
});
