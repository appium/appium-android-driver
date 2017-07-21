import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../../..';
import DEFAULT_CAPS from '../../desired';


chai.should();
chai.use(chaiAsPromised);

describe('apidemo - attributes', function () {
  let driver;
  let animationEl;

  before(async () => {
    driver = new AndroidDriver();
    await driver.createSession(DEFAULT_CAPS);
    let animation = await driver.findElOrEls('accessibility id', 'Animation', false);
    animationEl = animation.ELEMENT;
  });
  after(async () => {
    await driver.deleteSession();
  });
  it('should be able to find resourceId attribute', async () => {
    await driver.getAttribute('resourceId', animationEl).should.eventually.become('android:id/text1');
  });
  it('should be able to find text attribute', async () => {
    await driver.getAttribute('text', animationEl).should.eventually.become('Animation');
  });
  it('should be able to find name attribute', async () => {
    await driver.getAttribute('name', animationEl).should.eventually.become('Animation');
  });
  it('should be able to find name attribute, falling back to text', async () => {
    await driver.click(animationEl);
    let textView = await driver.findElOrEls('class name', 'android.widget.TextView', true);
    let textViewEl = textView[1].ELEMENT;
    await driver.getAttribute('name', textViewEl).should.eventually.become('Bouncing Balls');
    await driver.back();
  });
  it('should be able to find content description attribute', async () => {
    await driver.getAttribute('contentDescription', animationEl).should.eventually.become("Animation");
  });
  it('should be able to find displayed attribute', async () => {
    await driver.getAttribute('displayed', animationEl).should.eventually.become('true');
  });
  it('should be able to find displayed attribute through normal func', async () => {
    await driver.elementDisplayed(animationEl).should.eventually.become(true);
  });
  it('should be able to get element location using getLocation', async () => {
    let location = await driver.getLocation(animationEl);
    location.x.should.be.at.least(0);
    location.y.should.be.at.least(0);
  });
  it('should be able to get element location using getLocationInView', async () => {
    let location = await driver.getLocationInView(animationEl);
    location.x.should.be.at.least(0);
    location.y.should.be.at.least(0);
  });
  it('should be able to get element size', async () => {
    let size = await driver.getSize(animationEl);
    size.width.should.be.at.least(0);
    size.height.should.be.at.least(0);
  });
});
