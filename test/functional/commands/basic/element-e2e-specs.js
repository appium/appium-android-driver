import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../../..';
import _ from 'lodash';
import DEFAULT_CAPS from '../../desired';
import { retryInterval } from 'asyncbox';


chai.should();
chai.use(chaiAsPromised);

let driver;
let caps = _.defaults({
  appActivity: '.view.TextFields'
}, DEFAULT_CAPS);

describe('element', function () {
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
    await driver.clear(el.ELEMENT);
  });

  describe('setValueImmediate', function () {
    it('should set the text on the element', async function () {
      let retries = process.env.TRAVIS ? 10 : 1;
      await retryInterval(retries, 1000, async () => {
        await driver.clear(el.ELEMENT);
        await driver.setValueImmediate('original value', el.ELEMENT);
        await driver.getText(el.ELEMENT).should.eventually.equal('original value');
      });
    });
  });
  describe('setValue', function () {
    it('should set the text on the element', async function () {
      await driver.setValue('original value', el.ELEMENT);
      await driver.getText(el.ELEMENT).should.eventually.equal('original value');
    });
  });
});
