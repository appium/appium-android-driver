import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../../..';
import DEFAULT_CAPS from '../../desired';


chai.should();
chai.use(chaiAsPromised);

describe('Find - invalid strategy', function () {
  let driver;
  before(async () => {
    driver = new AndroidDriver();
    await driver.createSession(DEFAULT_CAPS);
  });
  after(async () => {
    await driver.deleteSession();
  });
  it('should not accept -ios uiautomation locator strategy', async () => {
    await driver.findElOrEls('-ios uiautomation', '.elements()', false)
      .should.eventually.be.rejectedWith(/not supported/);
  });
});
