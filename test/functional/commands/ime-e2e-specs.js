import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import _ from 'lodash';
import AndroidDriver from '../../..';
import DEFAULT_CAPS from '../desired';


chai.should();
chai.use(chaiAsPromised);

let driver;
let defaultCaps = _.defaults({
  unicodeKeyboard: true,
  resetKeyboard: true
}, DEFAULT_CAPS);
let unicodeImeId = 'io.appium.android.ime/.UnicodeIME';

describe('apidemo - IME', function () {
  before(async () => {
    driver = new AndroidDriver();
    await driver.createSession(defaultCaps);
  });
  beforeEach(async () => {
    await driver.startActivity('io.appium.android.apis', 'io.appium.android.apis.ApiDemos');
  });
  after(async () => {
    await driver.deleteSession();
  });
  it('should get the default (enabled) input method', async () => {
    await driver.getActiveIMEEngine().should.eventually.equal(unicodeImeId);
  });
  it('should get the available input methods', async () => {
    await driver.availableIMEEngines().should.eventually.have.length.at.least(4);
  });
  it('should activate an installed input method', async () => {
    await driver.activateIMEEngine(unicodeImeId).should.not.be.rejected;
  });
  it('should fail to activate an uninstalled input method', async () => {
    let invalidImeId = 'sdf.wer.gdasdfsf/.OsdfEfgd';
    await driver.activateIMEEngine(invalidImeId).should.eventually.be.rejectedWith(/not available/);
  });
  it('should deactivate the current input method', async () => {
    await driver.activateIMEEngine(unicodeImeId);
    await driver.getActiveIMEEngine().should.eventually.equal(unicodeImeId);
    await driver.deactivateIMEEngine();
    await driver.getActiveIMEEngine().should.eventually.not.equal(unicodeImeId);
  });
});
