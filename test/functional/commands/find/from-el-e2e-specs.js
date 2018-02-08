import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../../..';
import DEFAULT_CAPS from '../../desired';
import { util } from 'appium-support';


chai.should();
chai.use(chaiAsPromised);

const atv = 'android.widget.TextView';
const alv = 'android.widget.ListView';

describe('Find - from element', function () {
  let driver;
  let parentEl;

  before(async function () {
    driver = new AndroidDriver();
    await driver.createSession(DEFAULT_CAPS);
    parentEl = await driver.findElement('class name', alv);
    parentEl = util.unwrapElement(parentEl);
  });
  after(async function () {
    await driver.deleteSession();
  });
  it('should find a single element by tag name', async function () {
    let innerEl = await driver.findElementFromElement('class name', atv, parentEl);
    await driver.getText(innerEl.ELEMENT).should.eventually.equal("Access'ibility");
  });
  it('should find multiple elements by tag name', async function () {
    let innerEl = await driver.findElementsFromElement('class name', atv, parentEl);
    await driver.getText(innerEl[0].ELEMENT).should.eventually.have.length.above(10);
  });
  it('should not find an element that does not exist', async function () {
    await driver.findElementFromElement('class name', 'blargimarg', parentEl)
      .should.be.rejectedWith(/could not be located/);
  });
  it('should not find multiple elements that do not exist', async function () {
    await driver.findElementFromElement('class name', 'blargimarg', parentEl)
      .should.be.rejectedWith(/could not be located/);
  });
});
