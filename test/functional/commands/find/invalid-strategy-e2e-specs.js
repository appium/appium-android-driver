import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../../..';
import DEFAULT_CAPS from '../../desired';


chai.should();
chai.use(chaiAsPromised);

describe('Find - invalid strategy', function () {
  let driver;
  before(async function () {
    driver = new AndroidDriver();
    await driver.createSession(DEFAULT_CAPS);
  });
  after(async function () {
    await driver.deleteSession();
  });
  it('should not accept -ios uiautomation locator strategy', async function () {
    await driver.findElement('-ios uiautomation', '.elements()')
      .should.eventually.be.rejectedWith(/not supported/);
  });
});
