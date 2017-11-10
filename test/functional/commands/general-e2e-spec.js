import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../..';
import DEFAULT_CAPS from '../desired';


chai.should();
chai.use(chaiAsPromised);

describe("general", function () {
  let driver;
  before(async () => {
    driver = new AndroidDriver();
    await driver.createSession(DEFAULT_CAPS);
  });
  after(async () => {
    await driver.deleteSession();
  });

  describe('broadcastIntent', () => {
    it('should fail if sent an unpermitted intent', async () => {
      await driver.broadcastIntent('android.intent.action.AIRPLANE_MODE').should.eventually.be.rejectedWith(/permission denial/i);
    });
    it('should send an arbitrary broadcast intent', async () => {
      await driver.broadcastIntent('android.intent.action.MAIN').should.eventually.be.resolved();
    });
  });
});
