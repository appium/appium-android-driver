import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import sinon from 'sinon';

import {AndroidDriver} from '../../lib/driver.js';

describe('AndroidDriver inheritance', function () {
  it('should attach commands to the prototype', function () {
    assert.ok(Object.hasOwn(AndroidDriver.prototype, 'mobileSetUiMode'));
    assert.ok(!Object.hasOwn(new AndroidDriver(), 'mobileSetUiMode'));
  });

  it('should allow descendants to override a command and call super', async function () {
    const baseStub = sinon.stub(AndroidDriver.prototype, 'getDeviceTime').resolves('base');
    try {
      class ChildDriver extends AndroidDriver {
        override async getDeviceTime(...args: Parameters<AndroidDriver['getDeviceTime']>) {
          return `child:${await super.getDeviceTime(...args)}`;
        }
      }
      assert.strictEqual(await new ChildDriver().getDeviceTime(), 'child:base');
      assert.ok(baseStub.calledOnce);
    } finally {
      baseStub.restore();
    }
  });

  it('should call the parent implementation in the log overrides', async function () {
    const driver = new AndroidDriver();
    assert.ok((await driver.getLogTypes()).includes('logcat'));
  });
});
