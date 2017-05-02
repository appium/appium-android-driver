import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../..';
import _ from 'lodash';
import DEFAULT_CAPS from '../desired';


chai.should();
chai.use(chaiAsPromised);

const PNG_MAGIC = '89504e47';
const PNG_MAGIC_LENGTH = 4;

let driver;
let caps = _.defaults({
  appPackage: 'io.appium.android.apis',
  appActivity: '.view.TextFields'
}, DEFAULT_CAPS);


describe('actions', () => {
  before(async () => {
    driver = new AndroidDriver();
    await driver.createSession(caps);
  });
  after(async () => {
    await driver.deleteSession();
  });

  describe('replaceValue', function () {
    it('should replace existing value in a text field', async () => {
      let el = _.last(await driver.findElOrEls('class name', 'android.widget.EditText', true));
      el.should.exist;
      await driver.setValue('original value', el.ELEMENT);
      await driver.getText(el.ELEMENT).should.eventually.equal('original value');

      await driver.replaceValue('replaced value', el.ELEMENT);
      await driver.getText(el.ELEMENT).should.eventually.equal('replaced value');
    });
  });

  describe('key codes', function () {
    beforeEach(async () => {
      await driver.startActivity(caps.appPackage, caps.appActivity);
    });

    it('should press key code 3 without metastate', async () => {
      await driver.pressKeyCode(3).should.not.be.rejected;
    });
    it('should press key code 3 with metastate', async () => {
      await driver.pressKeyCode(3, 193).should.not.be.rejected;
    });
    it('should long press key code 3 without metastate', async () => {
      await driver.longPressKeyCode(3).should.not.be.rejected;
    });
    it('should long press key code 3 with metastate', async () => {
      await driver.longPressKeyCode(3, 193).should.not.be.rejected;
    });
  });

  describe('getScreenshot', function () {
    it('should return valid base64-encoded screenshot', async () => {
      const base64screenshot = await driver.getScreenshot();
      const imageMagic = new Buffer(base64screenshot, 'base64').toString('hex', 0, PNG_MAGIC_LENGTH);
      imageMagic.should.be.equal(PNG_MAGIC);
    });
  });
});
