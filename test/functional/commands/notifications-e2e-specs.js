import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../../lib/driver';
import B from 'bluebird';
import ADB from 'appium-adb';
import { retry } from 'asyncbox';
import { DEFAULT_CAPS, amendCapabilities } from '../capabilities';


chai.should();
chai.use(chaiAsPromised);

let driver;
let defaultCaps = amendCapabilities(DEFAULT_CAPS, {
  'appium:appActivity': '.app.StatusBarNotifications'
});

describe('apidemo - notifications', function () {
  before(async function () {
    // TODO: why does this fail?
    let adb = new ADB();
    let apiLevel = await adb.getApiLevel();
    if ([21, 22].indexOf(apiLevel) >= 0) {
      return this.skip();
    }
    driver = new AndroidDriver();
    await driver.createSession(defaultCaps);
  });
  after(async function () {
    if (driver) {
      await driver.deleteSession();
    }
  });

  it('should open the notification shade @skip-ci', async function () {
    let el = await driver.findElement('accessibility id', ':-|');
    await driver.click(el.ELEMENT);

    // give the app a second to catch up before opening notifications
    await B.delay(1000);
    await driver.openNotifications();

    await retry(4, async () => {
      let textViews = await driver.findElements('class name', 'android.widget.TextView');
      let text = [];
      for (let view of textViews) {
        text.push(await driver.getText(view.ELEMENT));
      }
      text.should.include('Mood ring');
    });

    // go back to the app
    await driver.keyevent(4);
    await driver.getText(el.ELEMENT).should.become(':-|');
  });
});
