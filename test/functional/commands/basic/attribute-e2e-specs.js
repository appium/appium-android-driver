import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../../..';
import DEFAULT_CAPS from '../../desired';


chai.should();
chai.use(chaiAsPromised);

describe('apidemo - attributes', function () {
  let driver;
  let animationEl;

  before(async function () {
    driver = new AndroidDriver();
    await driver.createSession(DEFAULT_CAPS);
    let animation = await driver.findElement('accessibility id', 'Animation');
    animationEl = animation.ELEMENT;
  });
  after(async function () {
    await driver.deleteSession();
  });
  it('should be able to find resourceId attribute', async function () {
    await driver.getAttribute('resourceId', animationEl).should.eventually.become('android:id/text1');
  });
  it('should be able to find text attribute', async function () {
    await driver.getAttribute('text', animationEl).should.eventually.become('Animation');
  });
  it('should be able to find name attribute', async function () {
    await driver.getAttribute('name', animationEl).should.eventually.become('Animation');
  });
  it('should be able to find name attribute, falling back to text', async function () {
    await driver.click(animationEl);
    let textView = await driver.findElements('class name', 'android.widget.TextView');
    let textViewEl = textView[1].ELEMENT;
    await driver.getAttribute('name', textViewEl).should.eventually.become('Bouncing Balls');
    await driver.back();
  });
  it('should be able to find content description attribute', async function () {
    await driver.getAttribute('contentDescription', animationEl).should.eventually.become("Animation");
  });
  it('should be able to find displayed attribute', async function () {
    await driver.getAttribute('displayed', animationEl).should.eventually.become('true');
  });
  it('should be able to find displayed attribute through normal func', async function () {
    await driver.elementDisplayed(animationEl).should.eventually.become(true);
  });
  it('should be able to get element location using getLocation', async function () {
    let location = await driver.getLocation(animationEl);
    location.x.should.be.at.least(0);
    location.y.should.be.at.least(0);
  });
  it('should be able to get element location using getLocationInView', async function () {
    let location = await driver.getLocationInView(animationEl);
    location.x.should.be.at.least(0);
    location.y.should.be.at.least(0);
  });
  it('should be able to get element size', async function () {
    let size = await driver.getSize(animationEl);
    size.width.should.be.at.least(0);
    size.height.should.be.at.least(0);
  });
});
