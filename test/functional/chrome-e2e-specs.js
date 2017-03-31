import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../..';

chai.should();
chai.use(chaiAsPromised);

const capabilities = {
  "browserName": "chrome",
  "avd": "Nexus_5_API_25",
  "platformName": "Android",
  "platformVersion": "7.1",
  "deviceName": "Android Emulator",
  "chromeOptions": {
    "args": ["--no-first-run"]
  }  
};

describe('createSession', function () {
  let driver;
  before(() => {
    driver = new AndroidDriver();
  });
  afterEach(async () => {
    await driver.deleteSession();
  });
  it('should start chrome and dismiss the welcome dialog', async () => {
    await driver.createSession(capabilities);
    let appActivity = await driver.getCurrentActivity();
    appActivity.should.not.equal("org.chromium.chrome.browser.firstrun.FirstRunActivity");
  });
});
