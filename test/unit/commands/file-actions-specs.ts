import sinon from 'sinon';
import {AndroidDriver} from '../../../lib/driver';
import * as support from '@appium/support';
import {ADB} from 'appium-adb';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';

use(chaiAsPromised);

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
      sandbox.stub(support.tempDir, 'path').returns(localFile);
      const pullStub1 = sandbox.stub(driver.adb, 'pull');
      sandbox
        .stub(support.util, 'toInMemoryBase64')
        .withArgs(localFile)
        .returns(Buffer.from('YXBwaXVt', 'utf8'));
      sandbox.stub(support.fs, 'exists').withArgs(localFile).returns(true);
      const unlinkStub4 = sandbox.stub(support.fs, 'unlink');
      await expect(driver.pullFile('remote_path')).to.become('YXBwaXVt');
      expect(pullStub1.calledWithExactly('remote_path', localFile)).to.be.true;
      expect(unlinkStub4.calledWithExactly(localFile)).to.be.true;
    });

    it('should be able to pull file located in application container from the device', async function () {
      const localFile = 'local/tmp_file';
      const packageId = 'com.myapp';
      const remotePath = 'path/in/container';
      const tmpPath = '/data/local/tmp/container';
      sandbox.stub(support.tempDir, 'path').returns(localFile);
      const pullStub = sandbox.stub(driver.adb, 'pull');
      const shellStub2 = sandbox.stub(driver.adb, 'shell');
      sandbox
        .stub(support.util, 'toInMemoryBase64')
        .withArgs(localFile)
        .returns(Buffer.from('YXBwaXVt', 'utf8'));
      sandbox.stub(support.fs, 'exists').withArgs(localFile).returns(true);
      const unlinkStub3 = sandbox.stub(support.fs, 'unlink');
      await expect(driver.pullFile(`@${packageId}/${remotePath}`)).to.become('YXBwaXVt');
      expect(pullStub.calledWithExactly(tmpPath, localFile)).to.be.true;
      expect(shellStub2.calledWithExactly([
        'run-as',
        packageId,
        `chmod 777 '/data/data/${packageId}/${remotePath}'`,
      ])).to.be.true;
      expect(shellStub2.calledWithExactly([
        'run-as',
        packageId,
        `cp -f '/data/data/${packageId}/${remotePath}' '${tmpPath}'`,
      ])).to.be.true;
      expect(unlinkStub3.calledWithExactly(localFile)).to.be.true;
      expect(shellStub2.calledWithExactly(['rm', '-f', tmpPath])).to.be.true;
    });
  });

  describe('pushFile', function () {
    it('should be able to push file to device', async function () {
      const localFile = 'local/tmp_file';
      const content = 'appium';
      sandbox.stub(support.tempDir, 'path').returns(localFile);
      const pushStub1 = sandbox.stub(driver.adb, 'push');
      sandbox.stub(driver.adb, 'shell');
      const writeFileStub1 = sandbox.stub(support.fs, 'writeFile');
      sandbox.stub(support.fs, 'exists').withArgs(localFile).returns(true);
      const unlinkStub1 = sandbox.stub(support.fs, 'unlink');
      await driver.pushFile('remote_path', 'YXBwaXVt');
      expect(writeFileStub1.calledWithExactly(localFile, content, 'binary')).to.be.true;
      expect(unlinkStub1.calledWithExactly(localFile)).to.be.true;
      expect(pushStub1.calledWithExactly(localFile, 'remote_path')).to.be.true;
    });

    it('should be able to push file located in application container to the device', async function () {
      const localFile = 'local/tmp_file';
      const content = 'appium';
      const packageId = 'com.myapp';
      const remotePath = 'path/in/container';
      const tmpPath = '/data/local/tmp/container';
      sandbox.stub(support.tempDir, 'path').returns(localFile);
      const pushStub2 = sandbox.stub(driver.adb, 'push');
      const writeFileStub = sandbox.stub(support.fs, 'writeFile');
      sandbox.stub(support.fs, 'exists').withArgs(localFile).returns(true);
      const unlinkStub2 = sandbox.stub(support.fs, 'unlink');
      const shellStub = sandbox.stub(driver.adb, 'shell');
      await driver.pushFile(`@${packageId}/${remotePath}`, 'YXBwaXVt');
      expect(writeFileStub.calledWithExactly(localFile, content, 'binary')).to.be.true;
      expect(pushStub2.calledWithExactly(localFile, tmpPath)).to.be.true;
      expect(shellStub.calledWithExactly([
        'run-as',
        packageId,
        `mkdir -p '/data/data/${packageId}/path/in'`,
      ])).to.be.true;
      expect(shellStub.calledWithExactly([
        'run-as',
        packageId,
        `touch '/data/data/${packageId}/${remotePath}'`,
      ])).to.be.true;
      expect(shellStub.calledWithExactly([
        'run-as',
        packageId,
        `chmod 777 '/data/data/${packageId}/${remotePath}'`,
      ])).to.be.true;
      expect(shellStub.calledWithExactly([
        'run-as',
        packageId,
        `cp -f '${tmpPath}' '/data/data/${packageId}/${remotePath}'`,
      ])).to.be.true;
      expect(unlinkStub2.calledWithExactly(localFile)).to.be.true;
      expect(shellStub.calledWithExactly(['rm', '-f', tmpPath])).to.be.true;
    });
  });
});

