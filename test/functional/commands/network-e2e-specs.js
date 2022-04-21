// This currently does not work reliably in CI
// Further, our CI does not respect skip or @skip-ci
// investigate and reinstate

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../../lib/driver';
import { DEFAULT_CAPS, amendCapabilities } from '../capabilities';


chai.should();
chai.use(chaiAsPromised);

let driver;
let caps = amendCapabilities(DEFAULT_CAPS, {
  'appium:appActivity': '.view.TextFields'
});

describe.skip('network connection', function () {
  this.timeout(120000);
  before(async function () {
    driver = new AndroidDriver();
    await driver.createSession(caps);
  });
  after(async function () {
    await driver.deleteSession();
  });
  describe('setNetworkConnection @skip-ci', function () {
    function test (value) {
      it(`should be able to set to ${value}`, async function () {
        await driver.setNetworkConnection(value);
        await driver.getNetworkConnection().should.eventually.equal(value);
      });
    }
    for (let value of [1, 2, 4, 6]) {
      test(value);
    }
  });
});
