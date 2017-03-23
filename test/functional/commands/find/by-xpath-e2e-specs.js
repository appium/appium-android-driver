import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../../..';
import DEFAULT_CAPS from '../../desired';


chai.should();
chai.use(chaiAsPromised);

const atv = 'android.widget.TextView';
const f = "android.widget.FrameLayout";

describe('Find - xpath', function () {
  let driver;
  before(async () => {
    driver = new AndroidDriver();
    await driver.createSession(DEFAULT_CAPS);
  });
  after(async () => {
    await driver.deleteSession();
  });
  it('should throw when matching nothing', async () => {
    await driver.findElOrEls('xpath', '//whatthat', false).should.eventually.be.rejectedWith(/could not be located/);
  });
  it('should throw with status 7 for hierarchy root', async () => {
    await driver.findElOrEls('xpath', '/*', false).should.eventually.be.rejectedWith(/could not be located/);
  });
  it('should find element by type', async () => {
    let el = await driver.findElOrEls('xpath', `//${atv}`, false);
    await driver.getText(el.ELEMENT).should.eventually.equal('API Demos');
  });
  it('should find element by text', async () => {
    let el = await driver.findElOrEls('xpath', `//${atv}[@text='Accessibility']`, false);
    await driver.getText(el.ELEMENT).should.eventually.equal('Accessibility');
  });
  it('should find exactly one element via elementsByXPath', async () => {
    let el = await driver.findElOrEls('xpath', `//${atv}[@text='Accessibility']`, true);
    el.length.should.equal(1);
    await driver.getText(el[0].ELEMENT).should.eventually.equal('Accessibility');
  });
  it('should find element by partial text', async () => {
    let el = await driver.findElOrEls('xpath', `//${atv}[contains(@text, 'Accessibility')]`, false);
    await driver.getText(el.ELEMENT).should.eventually.equal('Accessibility');
  });
  it('should find the last element', async () => {
    let el = await driver.findElOrEls('xpath', `(//${atv})[last()]`, false);
    let text = await driver.getText(el.ELEMENT);
    ["OS", "Text", "Views", "Preference"].should.include(text);
  });

  // TODO: Doesn't work on CI. Works locally on API_LEVEL 23
  //it('should find element by xpath index and child @skip-ci', async () => {
    // let alv = 'android.widget.ListView';
    // let el = await driver.findElOrEls('xpath', `//${f}[2]/${alv}[1]/${atv}[4]`, false);
    // await driver.getText(el.ELEMENT).should.eventually.equal('App');
  //});

  it('should find element by index and embedded desc', async () => {
    let el = await driver.findElOrEls('xpath', `//${f}//${atv}[5]`, false);
    await driver.getText(el.ELEMENT).should.eventually.equal('Content');
  });
  it('should find all elements', async () => {
    let el = await driver.findElOrEls('xpath', `//*`, true);
    el.length.should.be.above(2);
  });
  it('should find the first element when searching for all elements', async () => {
    let el = await driver.findElOrEls('xpath', `//*`, true);
    el[0].should.exist;
  });
  it('should find less elements with compression turned on', async () => {
    await driver.updateSettings({"ignoreUnimportantViews": false});
    let elementsWithoutCompression = await driver.findElOrEls('xpath', `//*`, true);
    await driver.updateSettings({"ignoreUnimportantViews": true});
    let elementsWithCompression = await driver.findElOrEls('xpath', `//*`, true);
    elementsWithoutCompression.length.should.be.greaterThan(elementsWithCompression.length);
  });
});
