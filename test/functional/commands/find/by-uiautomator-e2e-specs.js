import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../../..';
import DEFAULT_CAPS from '../../desired';


chai.should();
chai.use(chaiAsPromised);

describe('Find - uiautomator', function () {
  let driver;
  before(async function () {
    driver = new AndroidDriver();
    await driver.createSession(DEFAULT_CAPS);
  });
  after(async function () {
    await driver.deleteSession();
  });
  it('should find elements with a boolean argument', async function () {
    await driver.findElements('-android uiautomator', 'new UiSelector().clickable(true)')
      .should.eventually.have.length.at.least(10);
  });
  it('should find elements within the context of another element', async function () {
    let els = await driver
      .findElements('-android uiautomator', 'new UiSelector().className("android.widget.TextView")');
    els.length.should.be.above(8);
    els.length.should.be.below(14);
  });
  it('should find elements without prepending "new UiSelector()"', async function () {
    await driver.findElements('-android uiautomator', '.clickable(true)')
      .should.eventually.have.length.at.least(10);
  });
  it('should find elements without prepending "new UiSelector()"', async function () {
    await driver.findElements('-android uiautomator', '.clickable(true)')
      .should.eventually.have.length.at.least(10);
  });
  it('should find elements without prepending "new UiSelector()"', async function () {
    await driver.findElements('-android uiautomator', 'clickable(true)')
      .should.eventually.have.length.at.least(10);
  });
  it('should find elements without prepending "new "', async function () {
    await driver.findElements('-android uiautomator', 'UiSelector().clickable(true)')
      .should.eventually.have.length.at.least(10);
  });
  it('should ignore trailing semicolons', async function () {
    await driver.findElements('-android uiautomator', 'new UiSelector().clickable(true);')
      .should.eventually.have.length.at.least(10);
  });
  it('should find an element with an int argument', async function () {
    let el = await driver.findElement('-android uiautomator', 'new UiSelector().index(0)');
    await driver.getName(el.ELEMENT).should.eventually.equal('android.widget.FrameLayout');
  });
  it('should find an element with a string argument', async function () {
    await driver
      .findElement('-android uiautomator', 'new UiSelector().description("Animation")')
      .should.eventually.exist;
  });
  it('should find an element with an overloaded method argument', async function () {
    await driver.findElements('-android uiautomator', 'new UiSelector().className("android.widget.TextView")')
      .should.eventually.have.length.at.least(10);
  });
  it('should find an element with a Class<T> method argument', async function () {
    await driver.findElements('-android uiautomator', 'new UiSelector().className(android.widget.TextView)')
      .should.eventually.have.length.at.least(10);
  });
  it('should find an element with a long chain of methods', async function () {
    let el = await driver.findElement('-android uiautomator', 'new UiSelector().clickable(true).className(android.widget.TextView).index(1)');
    await driver.getText(el.ELEMENT).should.eventually.equal('Accessibility');
  });
  it('should find an element with recursive UiSelectors', async function () {
    // TODO: figure out why this fails with 7.1.1
    if (await driver.adb.getApiLevel() >= 24) return this.skip(); //eslint-disable-line curly

    await driver.findElements('-android uiautomator', 'new UiSelector().childSelector(new UiSelector().clickable(true)).clickable(true)')
      .should.eventually.have.length(1);
  });
  it('should not find an element with bad syntax', async function () {
    await driver.findElements('-android uiautomator', 'new UiSelector().clickable((true)')
      .should.eventually.be.rejectedWith(/resource could not be found/);
  });
  it('should not find an element with bad syntax', async function () {
    await driver.findElements('-android uiautomator', 'new UiSelector().drinkable(true)')
      .should.eventually.be.rejectedWith(/resource could not be found/);
  });
  it('should not find an element which does not exist', async function () {
    await driver.findElements('-android uiautomator', 'new UiSelector().description("chuckwudi")')
      .should.eventually.have.length(0);
  });
  it('should allow multiple selector statements and return the Union of the two sets', async function () {
    let clickable = await driver.findElements('-android uiautomator', 'new UiSelector().clickable(true)');
    clickable.length.should.be.above(0);
    let notClickable = await driver.findElements('-android uiautomator', 'new UiSelector().clickable(false)');
    notClickable.length.should.be.above(0);
    let both = await driver.findElements('-android uiautomator', 'new UiSelector().clickable(true); new UiSelector().clickable(false);');
    both.should.have.length(clickable.length + notClickable.length);
  });
  it('should allow multiple selector statements and return the Union of the two sets', async function () {
    let clickable = await driver.findElements('-android uiautomator', 'new UiSelector().clickable(true)');
    clickable.length.should.be.above(0);
    let clickableClickable = await driver.findElements('-android uiautomator', 'new UiSelector().clickable(true); new UiSelector().clickable(true);');
    clickableClickable.length.should.be.above(0);
    clickableClickable.should.have.length(clickable.length);
  });
  it('should find an element in the second selector if the first finds no elements', async function () {
    let selector = 'new UiSelector().className("not.a.class"); new UiSelector().className("android.widget.TextView")';
    await driver.findElements('-android uiautomator', selector)
      .should.eventually.exist;
  });
  it('should scroll to, and return elements using UiScrollable', async function () {
    let selector = 'new UiScrollable(new UiSelector().scrollable(true).instance(0)).scrollIntoView(new UiSelector().text("Views").instance(0))';
    let el = await driver.findElement('-android uiautomator', selector);
    await driver.getText(el.ELEMENT).should.eventually.equal('Views');
  });
  it('should allow chaining UiScrollable methods', async function () {
    let selector = 'new UiScrollable(new UiSelector().scrollable(true).instance(0)).setMaxSearchSwipes(10).scrollIntoView(new UiSelector().text("Views").instance(0))';
    let el = await driver.findElement('-android uiautomator', selector);
    await driver.getText(el.ELEMENT).should.eventually.equal('Views');
  });
  it('should allow UiScrollable scrollIntoView', async function () {
    let selector = 'new UiScrollable(new UiSelector().scrollable(true).instance(0)).scrollIntoView(new UiSelector().text("Views").instance(0));';
    let el = await driver.findElement('-android uiautomator', selector);
    await driver.getText(el.ELEMENT).should.eventually.equal('Views');
  });
  it('should error reasonably if a UiScrollable does not return a UiObject', async function () {
    let selector = 'new UiScrollable(new UiSelector().scrollable(true).instance(0)).setMaxSearchSwipes(10)';
    await driver.findElement('-android uiautomator', selector)
      .should.eventually.be.rejectedWith(/resource could not be found/);
  });
  it('should allow UiScrollable with unicode string', async function () {
    await driver.startActivity('io.appium.android.apis', '.text.Unicode');
    let selector = 'new UiSelector().text("عربي").instance(0);';
    let el = await driver.findElement('-android uiautomator', selector);
    await driver.getText(el.ELEMENT).should.eventually.equal('عربي');
  });
});
