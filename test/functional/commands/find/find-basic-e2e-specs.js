import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { AndroidDriver } from '../../../..';
import sampleApps from 'sample-apps';
import ADB from 'appium-adb';

chai.should();
chai.use(chaiAsPromised);

let driver;
let defaultCaps = {
  app: sampleApps('ApiDemos-debug'),
  deviceName: 'Android',
  platformName: 'Android'
};

describe('Find - basic', function () {
  let singleResourceId;
  before(async () => {
    driver = new AndroidDriver();
    await driver.createSession(defaultCaps);
    let adb = new ADB({});
    // the app behaves differently on different api levels when it comes to
    // which resource ids are available for testing, so we switch here to make
    // sure we're using the right resource id below
    singleResourceId = await adb.getApiLevel() >= 21 ? 'decor_content_parent' : 'home';
  });
  after(async () => {
    await driver.deleteSession();
  });
  it('should find a single element by content-description', async () => {
    let el = await driver.findElOrEls('accessibility id', 'Animation', false);
    await driver.getText(el.ELEMENT).should.eventually.equal('Animation');
  });
  it('should find an element by class name', async () => {
    let el = await driver.findElOrEls('class name', 'android.widget.TextView', false);
    await driver.getText(el.ELEMENT).should.eventually.equal('API Demos');
  });
  it('should find multiple elements by class name', async () => {
    await driver.findElOrEls('class name', 'android.widget.TextView', true)
      .should.eventually.have.length.at.least(10);
  });
  it('should not find an element that doesnt exist', async () => {
    await driver.findElOrEls('class name', 'blargimarg', false)
      .should.be.rejectedWith(/could not be located/);
  });
  it('should not find multiple elements that doesnt exist', async () => {
    await driver.findElOrEls('class name', 'blargimarg', true)
      .should.eventually.have.length(0);
  });
  it('should fail on empty locator', async () => {
    await driver.findElOrEls('class name', '', true).should.be.rejectedWith(/selector/);
  });
  it('should find a single element by string id @skip-android-all', async () => {
    let el = await driver.findElOrEls('id', 'activity_sample_code', false);
    await driver.getText(el.ELEMENT).should.eventually.equal('API Demos');
  });
  it('should find a single element by resource-id', async () => {
    await driver.findElOrEls('id', `android:id/${singleResourceId}`, false)
      .should.eventually.exist;
  });
  it('should find multiple elements by resource-id', async () => {
    await driver.findElOrEls('id', 'android:id/text1', true)
      .should.eventually.have.length.at.least(10);
  });
  it('should find multiple elements by resource-id even when theres just one', async () => {
    await driver.findElOrEls('id', `android:id/${singleResourceId}`, true)
      .should.eventually.have.length(1);
  });
  it('should find a single element by resource-id with implicit package', async () => {
    await driver.findElOrEls('id', singleResourceId, false)
      .should.eventually.exist;
  });
  it('should find a single element by resource-id with implicit package', async () => {
    await driver.findElOrEls('id', 'text1', true)
      .should.eventually.have.length.at.least(10);
  });
  it('should find multiple elements by resource-id with implicit package even when theres just one', async () => {
    await driver.findElOrEls('id', singleResourceId, true)
      .should.eventually.have.length(1);
  });
  it('should respect implicit wait', async () => {
    let implicitWait = 5000;
    await driver.implicitWait(implicitWait);
    let beforeMs = Date.now();
    await driver.findElOrEls('id', 'there_is_nothing_called_this', true)
      .should.eventually.have.length(0);
    let afterMs = Date.now();
    (afterMs - beforeMs).should.be.below(implicitWait + 2000);
    (afterMs - beforeMs).should.be.above(implicitWait);
  });
});
