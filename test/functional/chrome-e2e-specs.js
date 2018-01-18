import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../..';
import { ensureAVDExists } from './helpers';
import { CHROME_CAPS } from './desired';
import _ from 'lodash';


chai.should();
chai.use(chaiAsPromised);

const avd = process.env.ANDROID_25_AVD || 'Nexus_5_API_25';
const capabilities = _.defaults({
  avd,
  platformVersion: "7.1",
  chromeOptions: {
    args: ["--no-first-run"]
  }
}, CHROME_CAPS);

describe('createSession', function () {
  let driver;
  before(async function () {
    if (!await ensureAVDExists(this, capabilities.avd)) {
      return;
    }

    driver = new AndroidDriver();
  });
  afterEach(async function () {
    await driver.deleteSession();
  });
  it('should start chrome and dismiss the welcome dialog', async function () {
    await driver.createSession(capabilities);
    let appActivity = await driver.getCurrentActivity();
    appActivity.should.not.equal("org.chromium.chrome.browser.firstrun.FirstRunActivity");
  });
});
