import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../..';
import _ from 'lodash';
import DEFAULT_CAPS from '../desired';


chai.should();
chai.use(chaiAsPromised);

let driver;
let caps = _.defaults({
  appPackage: 'io.appium.android.apis',
  appActivity: '.view.TextFields'
}, DEFAULT_CAPS);

describe('recording the screen', function () {
  before(async function () {
    driver = new AndroidDriver();
    await driver.createSession(caps);
  });

  after(async function () {
    await driver.deleteSession();
  });

  it('should start and stop recording the screen', async function () {
    if (await driver.isEmulator() || await driver.adb.getApiLevel() < 19) {
      return this.skip();
    }

    await driver.startRecordingScreen();

    // do some interacting, to take some time
    let el = await driver.findElement('class name', 'android.widget.EditText');
    el = el.ELEMENT;
    await driver.setValue('Recording the screen!', el);
    let text = await driver.getText(el);
    text.should.eql('Recording the screen!');

    (await driver.stopRecordingScreen()).should.not.be.empty;
  });
});
