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
  before(async function () {
    driver = new AndroidDriver();
    await driver.createSession(DEFAULT_CAPS);
  });
  after(async function () {
    await driver.deleteSession();
  });
  it('should throw when matching nothing', async function () {
    await driver.findElement('xpath', '//whatthat').should.eventually.be.rejectedWith(/could not be located/);
  });
  it('should throw with status 7 for hierarchy root', async function () {
    await driver.findElement('xpath', '/*').should.eventually.be.rejectedWith(/could not be located/);
  });
  it('should find element by type', async function () {
    let el = await driver.findElement('xpath', `//${atv}`);
    await driver.getText(el.ELEMENT).should.eventually.equal('API Demos');
  });
  it('should find element by text', async function () {
    let el = await driver.findElement('xpath', `//${atv}[@text='Accessibility']`);
    await driver.getText(el.ELEMENT).should.eventually.equal('Accessibility');
  });
  it('should find exactly one element via elementsByXPath', async function () {
    let el = await driver.findElements('xpath', `//${atv}[@text='Accessibility']`);
    el.length.should.equal(1);
    await driver.getText(el[0].ELEMENT).should.eventually.equal('Accessibility');
  });
  it('should find element by partial text', async function () {
    let el = await driver.findElement('xpath', `//${atv}[contains(@text, 'Accessibility')]`);
    await driver.getText(el.ELEMENT).should.eventually.equal('Accessibility');
  });
  it('should find the last element', async function () {
    let el = await driver.findElement('xpath', `(//${atv})[last()]`);
    let text = await driver.getText(el.ELEMENT);
    ["OS", "Text", "Views", "Preference"].should.include(text);
  });

  // TODO: Doesn't work on CI. Works locally on API_LEVEL 23
  //it('should find element by xpath index and child @skip-ci', async () => {
    // let alv = 'android.widget.ListView';
    // let el = await driver.findElement('xpath', `//${f}[2]/${alv}[1]/${atv}[4]`);
    // await driver.getText(el.ELEMENT).should.eventually.equal('App');
  //});

  it('should find element by index and embedded desc', async function () {
    let el = await driver.findElement('xpath', `//${f}//${atv}[5]`);
    await driver.getText(el.ELEMENT).should.eventually.equal('Content');
  });
  it('should find all elements', async function () {
    let els = await driver.findElements('xpath', `//*`);
    els.length.should.be.above(2);
  });
  it('should find the first element when searching for all elements', async function () {
    let el = await driver.findElements('xpath', `//*`);
    el[0].should.exist;
  });
  it('should find less elements with compression turned on', async function () {
    await driver.updateSettings({ignoreUnimportantViews: false});
    let elementsWithoutCompression = await driver.findElements('xpath', `//*`);
    await driver.updateSettings({ignoreUnimportantViews: true});
    let elementsWithCompression = await driver.findElements('xpath', `//*`);
    elementsWithoutCompression.length.should.be.greaterThan(elementsWithCompression.length);
  });
});
