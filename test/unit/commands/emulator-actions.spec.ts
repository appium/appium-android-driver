import assert from 'node:assert/strict';
import {describe, it, beforeEach, afterEach} from 'node:test';

import sinon from 'sinon';

import {AndroidDriver} from '../../../lib/driver.js';

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
      assert.strictEqual(sensorSetStub.calledWith('light', 0), true);
    });
    it('should be reject if arguments are missing', async function () {
      await assert.rejects(driver.execute('mobile: sensorSet', [{sensor: 'light', value: 0}]), /sensorType/);
      await assert.rejects(driver.execute('mobile:  sensorSet', [{sensorType: 'light', val: 0}]), /value/);
    });
  });
});
