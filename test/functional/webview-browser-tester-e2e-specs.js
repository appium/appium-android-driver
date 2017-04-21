import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../..';
import { sleep } from 'asyncbox';
import { ensureAVDExists } from './helpers';
import { CHROME_CAPS } from './desired';
import _ from 'lodash';
import path from 'path';


chai.should();
chai.use(chaiAsPromised);

const AVD_ANDROID_24_WITHOUT_GMS = process.env.ANDROID_24_NO_GMS_AVD || 'Nexus_5_API_24';
const capabilities = _.defaults({
  browserName: "chromium-webview",
  avd: AVD_ANDROID_24_WITHOUT_GMS,
  platformVersion: "7.0",
  chromedriverExecutable: path.join(process.cwd(), "chromedriver")
}, CHROME_CAPS);

describe('Android 7 Webview Browser tester', function () {
  let driver;

  before(async function () {
    if (process.env.REAL_DEVICE) {
      return this.skip();
    }
    if (!await ensureAVDExists(this, capabilities.avd)) {
      return;
    }
  });
  beforeEach(async () => {
    driver = new AndroidDriver();
    await driver.createSession(capabilities);
  });
  afterEach(async () => {
    if (driver) {
      await driver.deleteSession();
    }
  });

  // TODO: figure out what the custom chromedriver stuff above is all about
  it('should start android session using webview browser tester', async () => {
    await driver.setUrl('http://google.com');
    await driver.getContexts().should.eventually.include("CHROMIUM");
    if (await driver.getCurrentContext() !== 'CHROMIUM') {
      await driver.setContext("CHROMIUM");
    }
    let el = await driver.findElOrEls("id", "lst-ib", false);
    await driver.click(el.ELEMENT);
    await sleep(500);
    await driver.setElementValue("android", el.ELEMENT);
    await sleep(1500);
    el = await driver.findElOrEls("id", "tsbb", false);
    el.should.not.equal(null);
    await driver.click(el.ELEMENT);
    await sleep(5000);
  });
});
