import sinon from 'sinon';
import {AndroidDriver} from '../../../lib/driver';

/** @type {AndroidDriver} */
let driver;
let sandbox = sinon.createSandbox();

describe('Emulator Actions', function () {
  let chai;

  before(async function () {
    chai = await import('chai');
    const chaiAsPromised = await import('chai-as-promised');

    chai.should();
    chai.use(chaiAsPromised.default);
  });

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
      sensorSetStub.calledWith('light', 0).should.be.true;
    });
    it('should be reject if arguments are missing', function () {
      driver
        .execute('mobile: sensorSet', [{sensor: 'light', value: 0}])
        .should.eventually.be.rejectedWith(`'sensorType' argument is required`);
      driver
        .execute('mobile:  sensorSet', [{sensorType: 'light', val: 0}])
        .should.eventually.be.rejectedWith(`'value' argument is required`);
    });
  });
});
