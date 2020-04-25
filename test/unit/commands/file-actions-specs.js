import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import AndroidDriver from '../../..';
import * as support from 'appium-support';
import ADB from 'appium-adb';


let driver;
let sandbox = sinon.createSandbox();
chai.should();
chai.use(chaiAsPromised);

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
      let localFile = 'local/tmp_file';
      sandbox.stub(support.tempDir, 'path').returns(localFile);
      sandbox.stub(driver.adb, 'pull');
      sandbox.stub(support.util, 'toInMemoryBase64')
        .withArgs(localFile)
        .returns(Buffer.from('YXBwaXVt', 'utf8'));
      sandbox.stub(support.fs, 'exists').withArgs(localFile).returns(true);
      sandbox.stub(support.fs, 'unlink');
      await driver.pullFile('remote_path').should.become('YXBwaXVt');
      driver.adb.pull.calledWithExactly('remote_path', localFile)
        .should.be.true;
      support.fs.unlink.calledWithExactly(localFile).should.be.true;
    });

    it('should be able to pull file located in application container from the device', async function () {
      let localFile = 'local/tmp_file';
      const packageId = 'com.myapp';
      const remotePath = 'path/in/container';
      const tmpPath = '/data/local/tmp/container';
      sandbox.stub(support.tempDir, 'path').returns(localFile);
      sandbox.stub(driver.adb, 'pull');
      sandbox.stub(driver.adb, 'shell');
      sandbox.stub(support.util, 'toInMemoryBase64')
        .withArgs(localFile)
        .returns(Buffer.from('YXBwaXVt', 'utf8'));
      sandbox.stub(support.fs, 'exists').withArgs(localFile).returns(true);
      sandbox.stub(support.fs, 'unlink');
      await driver.pullFile(`@${packageId}/${remotePath}`).should.become('YXBwaXVt');
      driver.adb.pull.calledWithExactly(tmpPath, localFile).should.be.true;
      driver.adb.shell.calledWithExactly(['run-as', packageId, `chmod 777 '/data/data/${packageId}/${remotePath}'`]).should.be.true;
      driver.adb.shell.calledWithExactly(['cp', '-f', `/data/data/${packageId}/${remotePath}`, tmpPath]).should.be.true;
      support.fs.unlink.calledWithExactly(localFile).should.be.true;
      driver.adb.shell.calledWithExactly(['rm', '-f', tmpPath]).should.be.true;
    });
  });

  describe('pushFile', function () {
    it('should be able to push file to device', async function () {
      let localFile = 'local/tmp_file';
      let content = 'appium';
      sandbox.stub(support.tempDir, 'path').returns(localFile);
      sandbox.stub(driver.adb, 'push');
      sandbox.stub(driver.adb, 'shell');
      sandbox.stub(support.fs, 'writeFile');
      sandbox.stub(support.fs, 'exists').withArgs(localFile).returns(true);
      sandbox.stub(support.fs, 'unlink');
      await driver.pushFile('remote_path', 'YXBwaXVt');
      support.fs.writeFile.calledWithExactly(localFile, content, 'binary').should.be.true;
      support.fs.unlink.calledWithExactly(localFile).should.be.true;
      driver.adb.push.calledWithExactly(localFile, 'remote_path').should.be.true;
    });

    it('should be able to push file located in application container to the device', async function () {
      let localFile = 'local/tmp_file';
      let content = 'appium';
      const packageId = 'com.myapp';
      const remotePath = 'path/in/container';
      const tmpPath = '/data/local/tmp/container';
      sandbox.stub(support.tempDir, 'path').returns(localFile);
      sandbox.stub(driver.adb, 'push');
      sandbox.stub(driver.adb, 'shell');
      sandbox.stub(support.fs, 'writeFile');
      sandbox.stub(support.fs, 'exists').withArgs(localFile).returns(true);
      sandbox.stub(support.fs, 'unlink');
      await driver.pushFile(`@${packageId}/${remotePath}`, 'YXBwaXVt');
      support.fs.writeFile.calledWithExactly(localFile, content, 'binary').should.be.true;
      driver.adb.push.calledWithExactly(localFile, tmpPath).should.be.true;
      driver.adb.shell.calledWithExactly(['run-as', packageId, `mkdir -p '/data/data/${packageId}/path/in'`]).should.be.true;
      driver.adb.shell.calledWithExactly(['run-as', packageId, `touch '/data/data/${packageId}/${remotePath}'`]).should.be.true;
      driver.adb.shell.calledWithExactly(['run-as', packageId, `chmod 777 '/data/data/${packageId}/${remotePath}'`]).should.be.true;
      driver.adb.shell.calledWithExactly(['cp', '-f', tmpPath, `/data/data/${packageId}/${remotePath}`]).should.be.true;
      support.fs.unlink.calledWithExactly(localFile).should.be.true;
      driver.adb.shell.calledWithExactly(['rm', '-f', tmpPath]).should.be.true;
    });
  });

});
