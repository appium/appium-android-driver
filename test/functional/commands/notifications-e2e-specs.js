import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../..';
import B from 'bluebird';
import _ from 'lodash';
import ADB from 'appium-adb';
import { retry } from 'asyncbox';
import DEFAULT_CAPS from '../desired';


chai.should();
chai.use(chaiAsPromised);

let driver;
let defaultCaps = _.defaults({
  appActivity: '.app.StatusBarNotifications'
}, DEFAULT_CAPS);

describe('apidemo - notifications', function () {
  before(async function () {
    // TODO: why does this fail?
    let adb = new ADB();
    let apiLevel = await adb.getApiLevel();
    if (apiLevel === '22' || apiLevel === '21') {
      return this.skip();
    }
    driver = new AndroidDriver();
    await driver.createSession(defaultCaps);
  });
  after(async () => {
    if (driver) {
      await driver.deleteSession();
    }
  });

  it('should open the notification shade @skip-ci', async () => {
    let el = await driver.findElOrEls('accessibility id', ':-|', false);
    await driver.click(el.ELEMENT);

    // give the app a second to catch up before opening notifications
    await B.delay(1000);
    await driver.openNotifications();

    await retry(4, async () => {
      let textViews = await driver.findElOrEls('class name', 'android.widget.TextView', true);
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
