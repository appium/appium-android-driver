import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { AndroidDriver, startServer } from '../..';
import { ensureAVDExists, getChromedriver220Asset } from './helpers';
import { CHROME_CAPS } from './desired';
import _ from 'lodash';
import { util } from 'appium-support';


chai.should();
chai.use(chaiAsPromised);

const AVD_ANDROID_24_WITHOUT_GMS = process.env.ANDROID_24_NO_GMS_AVD || 'Nexus_5_API_24';
const CHROMEDRIVER_2_20_EXECUTABLE = process.env.CHROME_2_20_EXECUTABLE;

// for reasons that remain unclear, this particular webview-based browser
// will not connect to localhost/loopback, even on emulators
const HOST = util.localIp();
const PORT = 4723;

describe('Android 7 Webview Browser tester', function () {
  let driver;
  let server;

  before(async function () {
    if (process.env.REAL_DEVICE) {
      return this.skip();
    }
    if (!await ensureAVDExists(this, AVD_ANDROID_24_WITHOUT_GMS)) {
      return;
    }
  });
  beforeEach(async function () {
    const capabilities = _.defaults({
      browserName: 'chromium-webview',
      avd: AVD_ANDROID_24_WITHOUT_GMS,
      platformVersion: '7.0',
      chromedriverExecutable: CHROMEDRIVER_2_20_EXECUTABLE || await getChromedriver220Asset(),
    }, CHROME_CAPS);

    driver = new AndroidDriver();
    await driver.createSession(capabilities);
    server = await startServer(PORT, HOST);
  });
  afterEach(async function () {
    if (driver) {
      await driver.deleteSession();
    }
    if (server) {
      await server.close();
    }
  });

  it('should start android session using webview browser tester', async function () {
    // await driver.setUrl('http://google.com');
    await driver.setUrl(`http://${HOST}:${PORT}/test/guinea-pig`);

    // make sure we are in the right context
    await driver.getCurrentContext().should.eventually.eql("CHROMIUM");

    let el = await driver.findElement('id', 'i am a link');
    await driver.click(el.ELEMENT);

    el = await driver.findElement('id', 'I am another page title');
    el.should.exist;
  });
});
