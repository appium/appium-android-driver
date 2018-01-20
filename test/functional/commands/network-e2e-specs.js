// This currently does not work reliably in CI
// Further, our CI does not respect skip or @skip-ci
// investigate and reinstate

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import _ from 'lodash';
import AndroidDriver from '../../..';
import DEFAULT_CAPS from '../desired';


chai.should();
chai.use(chaiAsPromised);

let driver;
let caps = _.defaults({
  appActivity: '.view.TextFields'
}, DEFAULT_CAPS);

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
