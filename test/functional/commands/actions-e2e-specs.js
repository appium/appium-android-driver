import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { AndroidDriver } from '../../..';
import sampleApps from 'sample-apps';
import _ from 'lodash';


chai.should();
chai.use(chaiAsPromised);

let driver;
let caps = {
  app: sampleApps('ApiDemos-debug'),
  deviceName: 'Android',
  platformName: 'Android',
  appPackage: 'io.appium.android.apis',
  appActivity: '.view.TextFields'
};


describe('actions', () => {
  before(async () => {
    driver = new AndroidDriver();
    await driver.createSession(caps);
  });
  after(async () => {
    await driver.deleteSession();
  });

  describe('lock', function () {
    it('should lock the device for 4 seconds (+/- 30 secs)', async () => {
      // there is a lot of variance in time for locking and unlocking
      let before = new Date().getTime() / 1000;
      await driver.lock(4);
      let now = (new Date().getTime() / 1000);
      (now - before).should.be.above(4);
      (now - before).should.be.below(4 + 30);

      // for some reason adb.getFocusedPackageAndActivity does not return anything in this case
      await driver.getPageSource().should.eventually.include('package="io.appium.android.apis"');
    });
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
});
