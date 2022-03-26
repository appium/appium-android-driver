import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../../../lib/driver';
import _ from 'lodash';
import DEFAULT_CAPS, { amendCapabilities } from '../../capabilities';


chai.should();
chai.use(chaiAsPromised);

let driver;
let caps = amendCapabilities(DEFAULT_CAPS, {
  'appium:appActivity': '.view.TextFields'
});

describe('element', function () {
  this.retries(5);
  let el;
  before(async function () {
    driver = new AndroidDriver();
    await driver.createSession(caps);
    el = _.last(await driver.findElements('class name', 'android.widget.EditText'));
    el.should.exist;
  });
  after(async function () {
    await driver.deleteSession();
  });
  afterEach(async function () {
    try {
      await driver.clear(el.ELEMENT);
    } catch (ign) {}
  });

  // Tests below are unstable
  describe('setValueImmediate', function () {
    it.skip('should set the text on the element', async function () {
      await driver.clear(el.ELEMENT);
      await driver.setValueImmediate('original value', el.ELEMENT);
      'original value'.should.include(await driver.getText(el.ELEMENT));
    });
  });
  describe('setValue', function () {
    it.skip('should set the text on the element', async function () {
      await driver.setValue('original value', el.ELEMENT);
      'original value'.should.include(await driver.getText(el.ELEMENT));
    });
  });
});
