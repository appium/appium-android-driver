import assert from 'node:assert/strict';
import {afterEach, beforeEach, describe, it} from 'node:test';

import {ADB} from 'appium-adb';
import sinon from 'sinon';

import {AndroidDriver} from '../../../lib/driver.js';

let driver: AndroidDriver;
const sandbox = sinon.createSandbox();

describe('Intent', function () {
  beforeEach(function () {
    driver = new AndroidDriver();
    driver.adb = new ADB();
    driver.caps = {} as any;
    driver.opts = {} as any;
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('mobileStartActivity', function () {
    it('should place positional intent argument after option flags and extras', async function () {
      const shellStub = sandbox.stub(driver.adb, 'shell').resolves('Starting: Intent');
      await driver.mobileStartActivity(
        true,
        true,
        1,
        2,
        0,
        '0',
        'com.myapp/.MainActivity',
        'android.intent.action.MAIN',
        'com.myapp',
        'https://appium.io',
        'text/plain',
        'id1',
        'com.myapp/.SplashActivity',
        ['android.intent.category.LAUNCHER', 'android.intent.category.DEFAULT'],
        [
          ['s', 'jwtToken', 'eyJhbGciOi'],
          ['sn', 'nullExtra'],
        ],
        '0x10200000',
      );
      assert.deepEqual(shellStub.firstCall.args[0], [
        'am',
        'start-activity',
        '--user',
        '0',
        '-W',
        '-S',
        '--windowingMode',
        '1',
        '--activityType',
        '2',
        '--display',
        '0',
        '-a',
        'android.intent.action.MAIN',
        '-d',
        'https://appium.io',
        '-t',
        'text/plain',
        '-i',
        'id1',
        '-c',
        'android.intent.category.LAUNCHER',
        '-c',
        'android.intent.category.DEFAULT',
        '-n',
        'com.myapp/.SplashActivity',
        '-p',
        'com.myapp',
        '--es',
        'jwtToken',
        'eyJhbGciOi',
        '--esn',
        'nullExtra',
        '-f',
        '0x10200000',
        'com.myapp/.MainActivity',
      ]);
    });

    it('should validate invalid extras arguments', async function () {
      await assert.rejects(
        driver.mobileStartActivity(
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          'com.myapp/.MainActivity',
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          'invalid' as any,
        ),
        /'extras' must be an array/,
      );

      await assert.rejects(
        driver.mobileStartActivity(
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          'com.myapp/.MainActivity',
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          [['unknown', 'key', 'val']],
        ),
        /Extra argument type 'unknown' is not known/,
      );

      await assert.rejects(
        driver.mobileStartActivity(
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          'com.myapp/.MainActivity',
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          [['s', ' ', 'val']],
        ),
        /must be a valid string identifier/,
      );

      await assert.rejects(
        driver.mobileStartActivity(
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          'com.myapp/.MainActivity',
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          [['s', 'key']],
        ),
        /requires a valid value to be provided/,
      );
    });
  });

  describe('mobileBroadcast', function () {
    it('should build broadcast command with positional intent at the end', async function () {
      const shellStub = sandbox.stub(driver.adb, 'shell').resolves('Broadcasting: Intent');
      await driver.mobileBroadcast(
        'com.myapp.PERMISSION',
        true,
        'current',
        'com.myapp/.MyReceiver',
        'com.myapp.ACTION',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'android.intent.category.DEFAULT',
        [['s', 'token', 'abc']],
      );
      assert.deepEqual(shellStub.firstCall.args[0], [
        'am',
        'broadcast',
        '--user',
        'current',
        '--receiver-permission',
        'com.myapp.PERMISSION',
        '--allow-background-activity-starts',
        '-a',
        'com.myapp.ACTION',
        '-c',
        'android.intent.category.DEFAULT',
        '--es',
        'token',
        'abc',
        'com.myapp/.MyReceiver',
      ]);
    });
  });

  describe('mobileStartService', function () {
    it('should build start-foreground-service command with positional intent at the end', async function () {
      const shellStub = sandbox.stub(driver.adb, 'shell').resolves('Starting service: Intent');
      await driver.mobileStartService(
        true,
        '0',
        'com.myapp/.MyService',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        [['s', 'key', 'value']],
      );
      assert.deepEqual(shellStub.firstCall.args[0], [
        'am',
        'start-foreground-service',
        '--user',
        '0',
        '--es',
        'key',
        'value',
        'com.myapp/.MyService',
      ]);
    });
  });

  describe('mobileStopService', function () {
    it('should return stderr if service was already stopped with code 255', async function () {
      sandbox.stub(driver.adb, 'shell').rejects({
        code: 255,
        stderr: 'Service stopped',
      });
      const res = await driver.mobileStopService('0', 'com.myapp/.MyService');
      assert.strictEqual(res, 'Service stopped');
    });
  });
});
