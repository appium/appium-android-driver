import sinon from 'sinon';
import {AndroidDriver} from '../../../lib/driver';
import ADB from 'appium-adb';

/** @type {AndroidDriver} */
let driver;
let sandbox = sinon.createSandbox();

describe('General', function () {
  let chai;

  before(async function () {
    chai = await import('chai');
    const chaiAsPromised = await import('chai-as-promised');

    chai.should();
    chai.use(chaiAsPromised.default);
  });

  beforeEach(function () {
    driver = new AndroidDriver();
    driver.adb = new ADB();
    driver.caps = {};
    driver.opts = {};
  });
  afterEach(function () {
    sandbox.restore();
  });
  describe('setUrl', function () {
    it('should set url', async function () {
      driver.opts = {appPackage: 'pkg'};
      sandbox.stub(driver.adb, 'startUri');
      await driver.setUrl('url');
      driver.adb.startUri.calledWithExactly('url', 'pkg').should.be.true;
    });
  });
  describe('getDisplayDensity', function () {
    it('should return the display density of a device', async function () {
      driver.adb.shell = () => '123';
      (await driver.getDisplayDensity()).should.equal(123);
    });
    it('should return the display density of an emulator', async function () {
      driver.adb.shell = (cmd) => {
        let joinedCmd = cmd.join(' ');
        if (joinedCmd.indexOf('ro.sf') !== -1) {
          // device property look up
          return '';
        } else if (joinedCmd.indexOf('qemu.sf') !== -1) {
          // emulator property look up
          return '456';
        }
        return '';
      };
      (await driver.getDisplayDensity()).should.equal(456);
    });
    it("should throw an error if the display density property can't be found", async function () {
      driver.adb.shell = () => '';
      await driver
        .getDisplayDensity()
        .should.be.rejectedWith(/Failed to get display density property/);
    });
    it('should throw and error if the display density is not a number', async function () {
      driver.adb.shell = () => 'abc';
      await driver
        .getDisplayDensity()
        .should.be.rejectedWith(/Failed to get display density property/);
    });
  });
});
