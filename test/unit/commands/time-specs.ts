import sinon from 'sinon';
import {AndroidDriver} from '../../../lib/driver';
import {ADB} from 'appium-adb';
import {expect, use} from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { adjustTimeZone } from '../../../lib/commands/time';

use(chaiAsPromised);

describe('Time', function () {
  let driver: AndroidDriver;
  const sandbox = sinon.createSandbox();

  beforeEach(function () {
    driver = new AndroidDriver();
    driver.adb = new ADB();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('getDeviceTime', function () {
    it('should get device time with default ISO8601 format', async function () {
      sandbox.stub(driver.adb, 'shell').resolves('2024-01-15T10:30:45+0530');
      const result = await driver.getDeviceTime();
      expect(result).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
    });

    it('should get device time with custom format', async function () {
      sandbox.stub(driver.adb, 'shell').resolves('2024-01-15T10:30:45+0530');
      const result = await driver.getDeviceTime('YYYY-MM-DD HH:mm:ss');
      expect(result).to.equal('2024-01-15 10:30:45');
    });

    it('should handle timestamps with colon in timezone offset', async function () {
      sandbox.stub(driver.adb, 'shell').resolves('2024-01-15T10:30:45+05:30');
      const result = await driver.getDeviceTime('YYYY-MM-DD');
      expect(result).to.equal('2024-01-15');
    });

    it('should handle timestamps without timezone offset', async function () {
      sandbox.stub(driver.adb, 'shell').resolves('2024-01-15T10:30:45Z');
      const result = await driver.getDeviceTime('HH:mm:ss');
      expect(result).to.match(/^\d{2}:\d{2}:\d{2}$/);
    });

    it('should return raw timestamp if parsing fails', async function () {
      const invalidTimestamp = 'invalid-timestamp';
      sandbox.stub(driver.adb, 'shell').resolves(invalidTimestamp);
      const result = await driver.getDeviceTime();
      expect(result).to.equal(invalidTimestamp);
    });

    it('should handle various format tokens', async function () {
      sandbox.stub(driver.adb, 'shell').resolves('2024-01-15T09:05:03+0000');

      const yyyyResult = await driver.getDeviceTime('YYYY');
      expect(yyyyResult).to.equal('2024');

      const mmResult = await driver.getDeviceTime('MM');
      expect(mmResult).to.equal('01');

      const ddResult = await driver.getDeviceTime('DD');
      expect(ddResult).to.equal('15');

      const hhResult = await driver.getDeviceTime('HH');
      expect(hhResult).to.equal('09');

      const minResult = await driver.getDeviceTime('mm');
      expect(minResult).to.equal('05');

      const ssResult = await driver.getDeviceTime('ss');
      expect(ssResult).to.equal('03');
    });

    it('should handle single-digit format tokens', async function () {
      sandbox.stub(driver.adb, 'shell').resolves('2024-01-05T03:02:01+0000');

      const mResult = await driver.getDeviceTime('M');
      expect(mResult).to.equal('1');

      const dResult = await driver.getDeviceTime('D');
      expect(dResult).to.equal('5');

      const hResult = await driver.getDeviceTime('H');
      expect(hResult).to.equal('3');
    });

    it('should handle complex format strings', async function () {
      sandbox.stub(driver.adb, 'shell').resolves('2024-12-25T15:30:45+0530');
      const result = await driver.getDeviceTime('YYYY/MM/DD HH:mm:ss');
      expect(result).to.equal('2024/12/25 15:30:45');
    });

    it('should trim whitespace from device timestamp', async function () {
      sandbox.stub(driver.adb, 'shell').resolves('  2024-01-15T10:30:45+0530  \n');
      const result = await driver.getDeviceTime('YYYY-MM-DD');
      expect(result).to.equal('2024-01-15');
    });
  });

  describe('mobileGetDeviceTime', function () {
    it('should call getDeviceTime with default format', async function () {
      const getDeviceTimeStub = sandbox.stub(driver, 'getDeviceTime').resolves('2024-01-15T10:30:45+05:30');
      await driver.mobileGetDeviceTime();
      expect(getDeviceTimeStub.calledOnce).to.be.true;
      expect(getDeviceTimeStub.calledWith(undefined)).to.be.true;
    });

    it('should call getDeviceTime with custom format', async function () {
      const getDeviceTimeStub = sandbox.stub(driver, 'getDeviceTime').resolves('2024-01-15');
      await driver.mobileGetDeviceTime('YYYY-MM-DD');
      expect(getDeviceTimeStub.calledOnce).to.be.true;
      expect(getDeviceTimeStub.calledWith('YYYY-MM-DD')).to.be.true;
    });

    it('should return the result from getDeviceTime', async function () {
      const expectedResult = '2024-01-15T10:30:45+05:30';
      sandbox.stub(driver, 'getDeviceTime').resolves(expectedResult);
      const result = await driver.mobileGetDeviceTime();
      expect(result).to.equal(expectedResult);
    });
  });

  describe('adjustTimeZone', function () {
    it('should set valid timezone', async function () {
      const shellStub = sandbox.stub(driver.adb, 'shell').resolves('');
      await adjustTimeZone.bind(driver)('America/New_York');
      expect(shellStub.calledOnce).to.be.true;
      expect(shellStub.firstCall.args[0]).to.deep.equal([
        'service',
        'call',
        'alarm',
        '3',
        's16',
        'America/New_York',
      ]);
    });

    it('should set timezone for Europe/London', async function () {
      const shellStub = sandbox.stub(driver.adb, 'shell').resolves('');
      await adjustTimeZone.bind(driver)('Europe/London');
      expect(shellStub.calledOnce).to.be.true;
      expect(shellStub.firstCall.args[0]).to.deep.equal([
        'service',
        'call',
        'alarm',
        '3',
        's16',
        'Europe/London',
      ]);
    });

    it('should set timezone for Asia/Tokyo', async function () {
      const shellStub = sandbox.stub(driver.adb, 'shell').resolves('');
      await adjustTimeZone.bind(driver)('Asia/Tokyo');
      expect(shellStub.calledOnce).to.be.true;
      expect(shellStub.firstCall.args[0][5]).to.equal('Asia/Tokyo');
    });

    it('should throw error for invalid timezone', async function () {
      await expect(adjustTimeZone.bind(driver)('Invalid/Timezone'))
        .to.be.rejectedWith(/The provided time zone identifier 'Invalid\/Timezone' is not known/);
    });

    it('should throw error for empty timezone', async function () {
      await expect(adjustTimeZone.bind(driver)(''))
        .to.be.rejectedWith(/The provided time zone identifier '' is not known/);
    });

    it('should throw error for malformed timezone', async function () {
      await expect(adjustTimeZone.bind(driver)('America_New_York'))
        .to.be.rejectedWith(/The provided time zone identifier 'America_New_York' is not known/);
    });

    it('should accept UTC timezone', async function () {
      const shellStub = sandbox.stub(driver.adb, 'shell').resolves('');
      await adjustTimeZone.bind(driver)('UTC');
      expect(shellStub.calledOnce).to.be.true;
      expect(shellStub.firstCall.args[0][5]).to.equal('UTC');
    });

    it('should accept GMT timezone', async function () {
      const shellStub = sandbox.stub(driver.adb, 'shell').resolves('');
      await adjustTimeZone.bind(driver)('GMT');
      expect(shellStub.calledOnce).to.be.true;
      expect(shellStub.firstCall.args[0][5]).to.equal('GMT');
    });

    it('should not call shell if timezone validation fails', async function () {
      const shellStub = sandbox.stub(driver.adb, 'shell').resolves('');
      try {
        await adjustTimeZone.bind(driver)('BadTimeZone');
      } catch {
        // Expected error
      }
      expect(shellStub.called).to.be.false;
    });
  });
});
