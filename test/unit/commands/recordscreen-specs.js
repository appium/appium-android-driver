import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../..';
import { withMocks } from 'appium-test-support';
import ADB from 'appium-adb';
import sinon from 'sinon';
import B from 'bluebird';


chai.should();
chai.use(chaiAsPromised);

let driver = new AndroidDriver();
let adb = new ADB();
driver.adb = adb;

describe('recording the screen', withMocks({adb, driver}, (mocks) => {
  let remoteFile = '/sdcard/test.mp4';

  it('should fail to recording the screen on an emulator', async function () {
    mocks.driver.expects('isEmulator').returns(true);

    await driver.startRecordingScreen(remoteFile).should.eventually.be.rejectedWith(/Screen recording does not work on emulators/);
  });
  it('should fail to recording the screen on a device with API level 18', async function () {
    mocks.driver.expects('isEmulator').returns(false);
    mocks.adb.expects('getApiLevel').returns(18);

    await driver.startRecordingScreen(remoteFile).should.eventually.be.rejectedWith(/Screen recording not available on API Level 18. Minimum API Level is 19/);
  });
  it('should fail if the specified file already exists', async function () {
    mocks.driver.expects('isEmulator').returns(false);
    mocks.adb.expects('getApiLevel').returns(19);
    mocks.adb.expects('fileExists').returns(true);
    await driver.startRecordingScreen(remoteFile).should.eventually.be.rejectedWith(`Screen recording failed: '${remoteFile}' already exists.`);
  });

  describe('running adb', function () {
    beforeEach(function () {
      mocks.driver.expects('isEmulator').returns(false);
      mocks.adb.expects('getApiLevel').returns(19);
      mocks.adb.expects('fileExists').returns(false);
    });
    afterEach(function () {
      mocks.driver.verify();
      mocks.adb.verify();
    });
    it('should call adb to start screen recording', async function () {
      mocks.adb.expects('shell').once()
        .withExactArgs(['screenrecord', remoteFile]).returns(new B(() => {}));
      mocks.adb.expects('shell').once()
        .withExactArgs(['ls', '-al', remoteFile]).returns('-rw-rw---- 1 root sdcard_rw 39571 2017-06-23 07:33 /sdcard/test.mp4');

      await driver.startRecordingScreen(remoteFile);
    });

    it('should call adb to start screen recording with non-default videoSize', async function () {
      mocks.adb.expects('shell').once()
        .withExactArgs(['screenrecord', remoteFile, '--size', 100]).returns(new B(() => {}));
      mocks.adb.expects('shell').once()
        .withExactArgs(['ls', '-al', remoteFile]).returns('-rw-rw---- 1 root sdcard_rw 39571 2017-06-23 07:33 /sdcard/test.mp4');

      await driver.startRecordingScreen(remoteFile, 100);
    });

    it('should call adb to start screen recording with non-default timeLimit', async function () {
      mocks.adb.expects('shell').once()
        .withExactArgs(['screenrecord', remoteFile, '--time-limit', 100]).returns(new B(() => {}));
      mocks.adb.expects('shell').once()
        .withExactArgs(['ls', '-al', remoteFile]).returns('-rw-rw---- 1 root sdcard_rw 39571 2017-06-23 07:33 /sdcard/test.mp4');

      await driver.startRecordingScreen(remoteFile, null, 100);
    });

    it('should call adb to start screen recording with non-default bitRate', async function () {
      mocks.adb.expects('shell').once()
        .withExactArgs(['screenrecord', remoteFile, '--bit-rate', 100]).returns(new B(() => {}));
      mocks.adb.expects('shell').once()
        .withExactArgs(['ls', '-al', remoteFile]).returns('-rw-rw---- 1 root sdcard_rw 39571 2017-06-23 07:33 /sdcard/test.mp4');

      await driver.startRecordingScreen(remoteFile, null, null, 100);
    });

    it('should fail if adb screen recording errors out', async function () {
      let shellStub = sinon.stub(adb, 'shell');
      shellStub
        .returns(B.reject(new Error('shell command failed')));

      await driver.startRecordingScreen(remoteFile).should.eventually.be.rejectedWith(/shell command failed/);

      shellStub.restore();
    });

    it('should call ls multiple times until size is big enough', async function () {
      let shellStub = sinon.stub(adb, 'shell');
      shellStub
        .withArgs(['screenrecord', remoteFile]).returns(new B(() => {}))
        .withArgs(['ls', '-al', remoteFile])
          .onCall(0)
            .returns('-rw-rw---- 1 root sdcard_rw 31 2017-06-23 07:33 /sdcard/test.mp4')
          .onCall(1)
            .returns('-rw-rw---- 1 root sdcard_rw 42 2017-06-23 07:33 /sdcard/test.mp4');

      await driver.startRecordingScreen(remoteFile);

      shellStub.restore();
    });

    it('should call ls multiple times and fail if size never gets big enough', async function () {
      let shellStub = sinon.stub(adb, 'shell');
      shellStub
        .withArgs(['screenrecord', remoteFile]).returns(new B(() => {}))
        .withArgs(['ls', '-al', remoteFile])
            .returns('-rw-rw---- 1 root sdcard_rw 31 2017-06-23 07:33 /sdcard/test.mp4');

      await driver.startRecordingScreen(remoteFile).should.eventually.be.rejectedWith(`Remote file '${remoteFile}' found but it is still too small: 31 bytes`);

      shellStub.restore();
    });

    it('should call ls multiple times and fail if ls returns something unparsable', async function () {
      let shellStub = sinon.stub(adb, 'shell');
      shellStub
        .withArgs(['screenrecord', remoteFile]).returns(new B(() => {}))
        .withArgs(['ls', '-al', remoteFile])
            .returns('-rw-rw---- 1 sdfd 2017-06-23 07:33 /sdcard/test.mp4');

      await driver.startRecordingScreen(remoteFile).should.eventually.be.rejectedWith(`Remote file '${remoteFile}' found but unable to parse size: '-rw-rw---- 1 sdfd 2017-06-23 07:33 /sdcard/test.mp4'`);

      shellStub.restore();
    });
  });

  describe('stopRecordingScreen', function () {
    afterEach(function () {
      mocks.adb.verify();
    });

    it('should kill the process', async function () {
      mocks.adb.expects('killProcessesByName').once()
        .withExactArgs('screenrecord');

      await driver.stopRecordingScreen();
    });
    it('should fail if killProcessesByName fails', async function () {
      mocks.adb.expects('killProcessesByName').once()
        .withExactArgs('screenrecord')
        .throws(new Error('process not killed'));

      await driver.stopRecordingScreen().should.eventually.be.rejectedWith(/Unable to stop screen recording: process not killed/);
    });
  });
}));
