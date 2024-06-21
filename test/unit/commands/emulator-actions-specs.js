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
      sandbox.stub(driver, 'sensorSet');
      await driver.executeMobile('sensorSet', {sensorType: 'light', value: 0});
      driver.sensorSet.calledWithExactly({sensorType: 'light', value: 0}).should.be.true;
    });
    it('should be reject if arguments are missing', function () {
      driver
        .executeMobile('sensorSet', {sensor: 'light', value: 0})
        .should.eventually.be.rejectedWith(`'sensorType' argument is required`);
      driver
        .executeMobile('sensorSet', {sensorType: 'light', val: 0})
        .should.eventually.be.rejectedWith(`'value' argument is required`);
    });
  });
});
