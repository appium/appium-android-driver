import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../..';
import sampleApps from 'sample-apps';

chai.should();
chai.use(chaiAsPromised);

let driver;
let defaultCaps = {
  app: sampleApps('ApiDemos-debug'),
  deviceName: 'Android',
  platformName: 'Android'
};

describe('Commands', function () {
  before(() => {
    driver = new AndroidDriver();
  });
  afterEach(async () => {
    await driver.deleteSession();
  });
  describe('Alerts', async () => {
    it('should throw a notYetImplemented error for alert methods', async () => {
      await driver.createSession(defaultCaps);
      await driver.getAlertText().should.eventually.be.rejectedWith(/implemented/);
      await driver.setAlertText('new text').should.eventually.be.rejectedWith(/implemented/);
      await driver.postAcceptAlert().should.eventually.be.rejectedWith(/implemented/);
      await driver.postDismissAlert().should.eventually.be.rejectedWith(/implemented/);
    });
  });
});
