import sinon from 'sinon';
import {AndroidDriver} from '../../../lib/driver';
import {expect, use} from 'chai';
import chaiAsPromised from 'chai-as-promised';

use(chaiAsPromised);

let driver: AndroidDriver;
const sandbox = sinon.createSandbox();

describe('Emulator Actions', function () {
  beforeEach(function () {
    driver = new AndroidDriver();
  });
  afterEach(function () {
    sandbox.restore();
  });
  describe('sensorSet', function () {
    it('should call sensorSet', async function () {
      const sensorSetStub = sandbox.stub(driver, 'sensorSet');
      await driver.execute('mobile:sensorSet', [{sensorType: 'light', value: 0}]);
      expect(sensorSetStub.calledWith('light', 0)).to.be.true;
    });
    it('should be reject if arguments are missing', async function () {
      await expect(
        driver.execute('mobile: sensorSet', [{sensor: 'light', value: 0}]),
      ).to.eventually.be.rejectedWith(/sensorType/);
      await expect(
        driver.execute('mobile:  sensorSet', [{sensorType: 'light', val: 0}]),
      ).to.eventually.be.rejectedWith(/value/);
    });
  });
});
