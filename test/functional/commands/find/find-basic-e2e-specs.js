import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../../..';
import ADB from 'appium-adb';
import DEFAULT_CAPS from '../../desired';


chai.should();
chai.use(chaiAsPromised);

describe('Find - basic', function () {
  let driver;
  let singleResourceId;
  before(async function () {
    driver = new AndroidDriver();
    await driver.createSession(DEFAULT_CAPS);
    let adb = new ADB({});
    // the app behaves differently on different api levels when it comes to
    // which resource ids are available for testing, so we switch here to make
    // sure we're using the right resource id below
    singleResourceId = await adb.getApiLevel() >= 21 ? 'decor_content_parent' : 'home';
  });
  after(async function () {
    await driver.deleteSession();
  });
  it('should find a single element by content-description', async function () {
    let el = await driver.findElOrEls('accessibility id', 'Animation', false);
    await driver.getText(el.ELEMENT).should.eventually.equal('Animation');
  });
  it('should find an element by class name', async function () {
    let el = await driver.findElOrEls('class name', 'android.widget.TextView', false);
    await driver.getText(el.ELEMENT).should.eventually.equal('API Demos');
  });
  it('should find multiple elements by class name', async function () {
    await driver.findElOrEls('class name', 'android.widget.TextView', true)
      .should.eventually.have.length.at.least(10);
  });
  it('should not find an element that doesnt exist', async function () {
    await driver.findElOrEls('class name', 'blargimarg', false)
      .should.be.rejectedWith(/could not be located/);
  });
  it('should not find multiple elements that doesnt exist', async function () {
    await driver.findElOrEls('class name', 'blargimarg', true)
      .should.eventually.have.length(0);
  });
  it('should fail on empty locator', async function () {
    await driver.findElOrEls('class name', '', true).should.be.rejectedWith(/selector/);
  });
  it('should find a single element by string id @skip-android-all', async function () {
    let el = await driver.findElOrEls('id', 'activity_sample_code', false);
    await driver.getText(el.ELEMENT).should.eventually.equal('API Demos');
  });
  it('should find a single element by resource-id', async function () {
    await driver.findElOrEls('id', `android:id/${singleResourceId}`, false)
      .should.eventually.exist;
  });
  it('should find multiple elements by resource-id', async function () {
    await driver.findElOrEls('id', 'android:id/text1', true)
      .should.eventually.have.length.at.least(10);
  });
  it('should find multiple elements by resource-id even when theres just one', async function () {
    await driver.findElOrEls('id', `android:id/${singleResourceId}`, true)
      .should.eventually.have.length(1);
  });
  it('should find a single element by resource-id with implicit package', async function () {
    await driver.findElOrEls('id', singleResourceId, false)
      .should.eventually.exist;
  });
  it('should find a single element by resource-id with implicit package', async function () {
    await driver.findElOrEls('id', 'text1', true)
      .should.eventually.have.length.at.least(10);
  });
  it('should find multiple elements by resource-id with implicit package even when theres just one', async function () {
    await driver.findElOrEls('id', singleResourceId, true)
      .should.eventually.have.length(1);
  });
  describe('implicit wait', function () {
    let implicitWait = 5000;
    before(async function () {
      await driver.implicitWait(implicitWait);
    });
    it('should respect implicit wait with multiple elements', async function () {
      let beforeMs = Date.now();
      await driver.findElOrEls('id', 'there_is_nothing_called_this', true)
        .should.eventually.have.length(0);
      let afterMs = Date.now();
      (afterMs - beforeMs).should.be.below(implicitWait + 5000);
      (afterMs - beforeMs).should.be.above(implicitWait);
    });
    it('should respect implicit wait with a single element', async function () {
      let beforeMs = Date.now();
      await driver.findElOrEls('id', 'there_is_nothing_called_this', false)
        .should.eventually.be.rejectedWith(/could not be located/);
      let afterMs = Date.now();
      (afterMs - beforeMs).should.be.below(implicitWait + 5000);
      (afterMs - beforeMs).should.be.above(implicitWait);
    });
  });
});
