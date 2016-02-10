import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { AndroidDriver } from '../../../..';
import sampleApps from 'sample-apps';


chai.should();
chai.use(chaiAsPromised);

let driver;
let caps = {
  app: sampleApps('ApiDemos-debug'),
  deviceName: 'Android',
  platformName: 'Android',
  appActivity: '.view.TextFields'
};

describe('network connection', function () {
  this.timeout(180000);

  // these operations get flakier the more times you do them in one
  // session, so break them out
  beforeEach(async () => {
    driver = new AndroidDriver();
    await driver.createSession(caps);
  });
  afterEach(async () => {
    try {
      await driver.deleteSession();
    } catch (err) {
      console.log('Unable to delete session. Continueing anyway.');
    }
  });
  describe('setNetworkConnection @skip-ci', () => {
    it('should be able to set to 1', async () => {
      await driver.setNetworkConnection(1);
      await driver.getNetworkConnection().should.eventually.equal(1);
    });
    it('should be able to set to 2', async () => {
      await driver.setNetworkConnection(2);
      await driver.getNetworkConnection().should.eventually.equal(2);
    });
    it('should be able to set to 4', async () => {
      await driver.setNetworkConnection(4);
      await driver.getNetworkConnection().should.eventually.equal(4);
    });
    it('should be able to set to 6', async () => {
      await driver.setNetworkConnection(6);
      await driver.getNetworkConnection().should.eventually.equal(6);
    });
  });
});
