import assert from 'node:assert/strict';
import {describe, it, beforeEach, afterEach} from 'node:test';

import * as support from '@appium/support';
import {ADB} from 'appium-adb';
import sinon from 'sinon';

import {AndroidDriver} from '../../../lib/driver.js';

let driver: AndroidDriver;
const sandbox = sinon.createSandbox();

describe('File Actions', function () {
  beforeEach(function () {
    driver = new AndroidDriver();
    driver.adb = new ADB();
  });
  afterEach(function () {
    sandbox.restore();
  });

  describe('pullFile', function () {
    it('should be able to pull file from device', async function () {
      const localFile = 'local/tmp_file';
      sandbox.stub(support.tempDir, 'path').resolves(localFile);
      const pullStub1 = sandbox.stub(driver.adb, 'pull');
      sandbox.stub(support.util, 'toInMemoryBase64').withArgs(localFile).resolves(Buffer.from('YXBwaXVt', 'utf8'));
      sandbox.stub(support.fs, 'exists').withArgs(localFile).resolves(true);
      const unlinkStub4 = sandbox.stub(support.fs, 'unlink');
      assert.strictEqual(await driver.pullFile('remote_path'), 'YXBwaXVt');
      assert.strictEqual(pullStub1.calledWithExactly('remote_path', localFile), true);
      assert.strictEqual(unlinkStub4.calledWithExactly(localFile), true);
    });

    it('should be able to pull file located in application container from the device', async function () {
      const localFile = 'local/tmp_file';
      const packageId = 'com.myapp';
      const remotePath = 'path/in/container';
      const tmpPath = '/data/local/tmp/container';
      sandbox.stub(support.tempDir, 'path').resolves(localFile);
      const pullStub = sandbox.stub(driver.adb, 'pull');
      const shellStub2 = sandbox.stub(driver.adb, 'shell');
      sandbox.stub(support.util, 'toInMemoryBase64').withArgs(localFile).resolves(Buffer.from('YXBwaXVt', 'utf8'));
      sandbox.stub(support.fs, 'exists').withArgs(localFile).resolves(true);
      const unlinkStub3 = sandbox.stub(support.fs, 'unlink');
      assert.strictEqual(await driver.pullFile(`@${packageId}/${remotePath}`), 'YXBwaXVt');
      assert.strictEqual(pullStub.calledWithExactly(tmpPath, localFile), true);
      assert.strictEqual(
        shellStub2.calledWithExactly(['run-as', packageId, `chmod 777 '/data/data/${packageId}/${remotePath}'`]),
        true,
      );
      assert.strictEqual(
        shellStub2.calledWithExactly([
          'run-as',
          packageId,
          `cp -f '/data/data/${packageId}/${remotePath}' '${tmpPath}'`,
        ]),
        true,
      );
      assert.strictEqual(unlinkStub3.calledWithExactly(localFile), true);
      assert.strictEqual(shellStub2.calledWithExactly(['rm', '-f', tmpPath]), true);
    });
  });

  describe('pushFile', function () {
    it('should be able to push file to device', async function () {
      const localFile = 'local/tmp_file';
      const content = 'appium';
      sandbox.stub(support.tempDir, 'path').resolves(localFile);
      const pushStub1 = sandbox.stub(driver.adb, 'push');
      sandbox.stub(driver.adb, 'shell');
      const writeFileStub1 = sandbox.stub(support.fs, 'writeFile');
      sandbox.stub(support.fs, 'exists').withArgs(localFile).resolves(true);
      const unlinkStub1 = sandbox.stub(support.fs, 'unlink');
      await driver.pushFile('remote_path', 'YXBwaXVt');
      assert.strictEqual(writeFileStub1.calledWithExactly(localFile, content, 'binary'), true);
      assert.strictEqual(unlinkStub1.calledWithExactly(localFile), true);
      assert.strictEqual(pushStub1.calledWithExactly(localFile, 'remote_path'), true);
    });

    it('should be able to push file located in application container to the device', async function () {
      const localFile = 'local/tmp_file';
      const content = 'appium';
      const packageId = 'com.myapp';
      const remotePath = 'path/in/container';
      const tmpPath = '/data/local/tmp/container';
      sandbox.stub(support.tempDir, 'path').resolves(localFile);
      const pushStub2 = sandbox.stub(driver.adb, 'push');
      const writeFileStub = sandbox.stub(support.fs, 'writeFile');
      sandbox.stub(support.fs, 'exists').withArgs(localFile).resolves(true);
      const unlinkStub2 = sandbox.stub(support.fs, 'unlink');
      const shellStub = sandbox.stub(driver.adb, 'shell');
      await driver.pushFile(`@${packageId}/${remotePath}`, 'YXBwaXVt');
      assert.strictEqual(writeFileStub.calledWithExactly(localFile, content, 'binary'), true);
      assert.strictEqual(pushStub2.calledWithExactly(localFile, tmpPath), true);
      assert.strictEqual(
        shellStub.calledWithExactly(['run-as', packageId, `mkdir -p '/data/data/${packageId}/path/in'`]),
        true,
      );
      assert.strictEqual(
        shellStub.calledWithExactly(['run-as', packageId, `touch '/data/data/${packageId}/${remotePath}'`]),
        true,
      );
      assert.strictEqual(
        shellStub.calledWithExactly(['run-as', packageId, `chmod 777 '/data/data/${packageId}/${remotePath}'`]),
        true,
      );
      assert.strictEqual(
        shellStub.calledWithExactly([
          'run-as',
          packageId,
          `cp -f '${tmpPath}' '/data/data/${packageId}/${remotePath}'`,
        ]),
        true,
      );
      assert.strictEqual(unlinkStub2.calledWithExactly(localFile), true);
      assert.strictEqual(shellStub.calledWithExactly(['rm', '-f', tmpPath]), true);
    });
  });
});
