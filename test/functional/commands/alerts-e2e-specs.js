import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../..';
import DEFAULT_CAPS from '../desired';


chai.should();
chai.use(chaiAsPromised);

describe('Commands', function () {
  let driver;
  before(() => {
    driver = new AndroidDriver();
  });
  afterEach(async () => {
    await driver.deleteSession();
  });
  describe('Alerts', async () => {
    it('should throw a notYetImplemented error for alert methods', async () => {
      await driver.createSession(DEFAULT_CAPS);
      await driver.getAlertText().should.eventually.be.rejectedWith(/implemented/);
      await driver.setAlertText('new text').should.eventually.be.rejectedWith(/implemented/);
      await driver.postAcceptAlert().should.eventually.be.rejectedWith(/implemented/);
      await driver.postDismissAlert().should.eventually.be.rejectedWith(/implemented/);
    });
  });
});
