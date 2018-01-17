import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import _ from 'lodash';
import AndroidDriver from '../..';
import DEFAULT_CAPS from './desired';
import { sleep } from 'asyncbox';

chai.should();
chai.use(chaiAsPromised);

let defaultCaps = _.defaults({
  androidInstallTimeout: 90000,
  browserName: 'chrome'
}, DEFAULT_CAPS);

describe('toggle wifi tests', function () {
  let driver;

  describe('functional', function () {
    before(function () {
      if (process.env.TRAVIS) {
        return this.skip();
      }
      if (!process.env.REAL_DEVICE) {
        return this.skip();
      }
      driver = new AndroidDriver();
    });
    afterEach(async function () {
      await driver.deleteSession();
    });
    it('should toggle wifi on real devices', async function () {
      await driver.createSession(defaultCaps);
      let isWifiOn = await driver.isWifiOn();
      if (isWifiOn) {
        await driver.setWifiState(0, false);
        await sleep(500);
        isWifiOn = await driver.isWifiOn();
        isWifiOn.should.be.false;
      } else {
        await driver.setWifiState(1, false);
        // enabling wifi takes time
        await sleep(2500);
        isWifiOn = await driver.isWifiOn();
        isWifiOn.should.be.true;
      }
    });
  });
});
