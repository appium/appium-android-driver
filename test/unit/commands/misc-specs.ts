import sinon from 'sinon';
import {AndroidDriver} from '../../../lib/driver';
import {ADB} from 'appium-adb';
import {expect, use} from 'chai';
import chaiAsPromised from 'chai-as-promised';

use(chaiAsPromised);

let driver: AndroidDriver;
const sandbox = sinon.createSandbox();

describe('General', function () {
  beforeEach(function () {
    driver = new AndroidDriver();
    driver.adb = new ADB();
    driver.caps = {} as any;
    driver.opts = {} as any;
  });
  afterEach(function () {
    sandbox.restore();
  });
  describe('setUrl', function () {
    it('should set url', async function () {
      driver.opts = {appPackage: 'pkg'} as any;
      const startUriStub = sandbox.stub(driver.adb, 'startUri');
      await driver.setUrl('url');
      expect(startUriStub.calledWithExactly('url', 'pkg')).to.be.true;
    });
  });
  describe('getDisplayDensity', function () {
    it('should return the display density of a device', async function () {
      driver.adb.shell = (() => Promise.resolve('123')) as any;
      expect(await driver.getDisplayDensity()).to.equal(123);
    });
    it('should return the display density of an emulator', async function () {
      driver.adb.shell = ((cmd: any) => {
        const joinedCmd = cmd.join(' ');
        if (joinedCmd.indexOf('ro.sf') !== -1) {
          // device property look up
          return Promise.resolve('');
        } else if (joinedCmd.indexOf('qemu.sf') !== -1) {
          // emulator property look up
          return Promise.resolve('456');
        }
        return Promise.resolve('');
      }) as any;
      expect(await driver.getDisplayDensity()).to.equal(456);
    });
    it("should throw an error if the display density property can't be found", async function () {
      driver.adb.shell = (() => Promise.resolve('')) as any;
      await expect(driver.getDisplayDensity()).to.be.rejectedWith(
        /Failed to get display density property/,
      );
    });
    it('should throw and error if the display density is not a number', async function () {
      driver.adb.shell = (() => Promise.resolve('abc')) as any;
      await expect(driver.getDisplayDensity()).to.be.rejectedWith(
        /Failed to get display density property/,
      );
    });
  });
});
