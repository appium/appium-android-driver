import sinon from 'sinon';
import {ADB} from 'appium-adb';
import {AndroidDriver} from '../../../lib/driver';
import {getDeviceTime} from '../../../lib/commands/time';

import {expect, use} from 'chai'; // expect is used
import chaiAsPromised from 'chai-as-promised';
import {describe, it, beforeEach, afterEach} from 'node:test';

use(chaiAsPromised);

describe('Time Commands', function () {
  let driver: AndroidDriver;
  const sandbox = sinon.createSandbox();

  beforeEach(function () {
    const adb = new ADB();
    driver = new AndroidDriver();
    driver.adb = adb;
  });
  afterEach(function () {
    sandbox.verifyAndRestore();
  });

  describe('getDeviceTime', function () {
    it('return formatted device time with timezone offset', async function () {
      sandbox
        .stub(driver.adb, 'shell')
        .withArgs(['date', '+%Y-%m-%dT%T%z'])
        .resolves('2026-07-08T15:30:45+0200\n');

      const result = await getDeviceTime.call(driver, 'YYYY-MM-DD HH:mm:ss Z');

      expect(result).to.equal('2026-07-08 15:30:45 +02:00');
    });

    it('use the default format when no format is provided', async function () {
      sandbox
        .stub(driver.adb, 'shell')
        .withArgs(['date', '+%Y-%m-%dT%T%z'])
        .resolves('2026-07-08T15:30:45+0200');

      const result = await getDeviceTime.call(driver);

      expect(result).to.equal('2026-07-08T15:30:45+02:00');
    });

    it('return the original timestamp when parsing fails', async function () {
      sandbox
        .stub(driver.adb, 'shell')
        .withArgs(['date', '+%Y-%m-%dT%T%z'])
        .resolves('invalid-date');

      const result = await getDeviceTime.call(driver, 'YYYY-MM-DD HH:mm:ss');

      expect(result).to.equal('invalid-date');
    });
  });
});
