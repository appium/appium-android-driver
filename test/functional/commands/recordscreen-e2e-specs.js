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

describe('recording the screen', () => {
  before(async () => {
    driver = new AndroidDriver();
    await driver.createSession(caps);
  });

  after(async () => {
    await driver.deleteSession();
  });

  it('should start and stop recording the screen', async function () {
    if (await driver.isEmulator() || await driver.adb.getApiLevel() < 19) {
      return this.skip();
    }

    let remoteFile = '/sdcard/test.mp4';

    // make sure we don't already have the file on the device
    if (await driver.adb.fileExists(remoteFile)) {
      await driver.adb.shell(['rm', remoteFile]);
    }

    await driver.startRecordingScreen(remoteFile);

    // do some interacting, to take some time
    let el = await driver.findElOrEls('class name', 'android.widget.EditText', false);
    el = el.ELEMENT;
    await driver.setValue('Recording the screen!', el);
    let text = await driver.getText(el);
    text.should.eql('Recording the screen!');

    await driver.stopRecordingScreen();

    (await driver.adb.fileExists(remoteFile)).should.be.true;
  });
});
