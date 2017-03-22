import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../..';
import _ from 'lodash';
import DEFAULT_CAPS from '../desired';


chai.should();
chai.use(chaiAsPromised);

let driver;
let caps = _.defaults({
  appActivity: '.view.TextFields'
}, DEFAULT_CAPS);

describe('element', function () {
  let el;
  before(async () => {
    driver = new AndroidDriver();
    await driver.createSession(caps);
    el = _.last(await driver.findElOrEls('class name', 'android.widget.EditText', true));
    el.should.exist;
  });
  after(async () => {
    await driver.deleteSession();
  });
  afterEach(async () => {
    await driver.clear(el.ELEMENT);
  });

  describe('setValueImmediate', () => {
    it('should set the text on the element', async () => {
      await driver.setValueImmediate('original value', el.ELEMENT);
      await driver.getText(el.ELEMENT).should.eventually.equal('original value');
    });
  });
  describe('setValue', () => {
    it('should set the text on the element', async () => {
      await driver.setValue('original value', el.ELEMENT);
      await driver.getText(el.ELEMENT).should.eventually.equal('original value');
    });
  });
});
