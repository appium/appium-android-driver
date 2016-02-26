import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../..';
import sampleApps from 'sample-apps';
import B from 'bluebird';

chai.should();
chai.use(chaiAsPromised);

let driver;
let defaultCaps = {
  app: sampleApps('ApiDemos-debug'),
  deviceName: 'Android',
  platformName: 'Android',
  appActivity: '.app.StatusBarNotifications'
};

describe('apidemo - notifications', function () {
  before(async () => {
    driver = new AndroidDriver();
    await driver.createSession(defaultCaps);
  });
  after(async () => {
    await driver.deleteSession();
  });

  it('should open the notification shade @skip-ci', async () => {
    let el = await driver.findElOrEls('accessibility id', ':-|', false);
    await driver.click(el.ELEMENT);

    // give the app a second to catch up before opening notifications
    await B.delay(1000);
    await driver.openNotifications();

    let textViews = await driver.findElOrEls('class name', 'android.widget.TextView', true);
    let text = [];
    for (let view of textViews) {
      text.push(await driver.getText(view.ELEMENT));
    }
    text.should.include('Mood ring');

    // go back to the app
    await driver.keyevent(4);
    await driver.getText(el.ELEMENT).should.become(':-|');
  });
});
