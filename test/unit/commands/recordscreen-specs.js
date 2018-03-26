import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../..';
import { withMocks } from 'appium-test-support';
import { fs } from 'appium-support';
import temp from 'temp';
import ADB from 'appium-adb';
import sinon from 'sinon';
import B from 'bluebird';


chai.should();
chai.use(chaiAsPromised);

let driver = new AndroidDriver();
let adb = new ADB();
driver.adb = adb;
describe('recording the screen', function () {
  this.timeout(60000);

  describe('basic', withMocks({adb, driver, fs, temp}, (mocks) => {
    const localFile = '/path/to/local.mp4';
    const mediaContent = new Buffer('appium');

    it('should fail to recording the screen on an older emulator', async function () {
      mocks.driver.expects('isEmulator').returns(true);
      mocks.adb.expects('getApiLevel').returns(26);

      await driver.startRecordingScreen().should.eventually.be.rejectedWith(/Screen recording does not work on emulators/);
    });

    it('should fail to recording the screen on a device with API level 18', async function () {
      mocks.driver.expects('isEmulator').returns(false);
      mocks.adb.expects('getApiLevel').returns(18);

      await driver.startRecordingScreen().should.eventually.be.rejectedWith(/Screen recording not available on API Level 18. Minimum API Level is 19/);
    });

    describe('beginning the recording', function () {
      beforeEach(function () {
        driver._recentScreenRecordingPath = null;
        mocks.driver.expects('isEmulator').atLeast(1).returns(false);
        mocks.adb.expects('getApiLevel').atLeast(1).returns(19);
        mocks.adb.expects('getPIDsByName')
          .atLeast(1).withExactArgs('screenrecord').returns([]);
      });
      afterEach(function () {
        mocks.driver.verify();
        mocks.adb.verify();
        mocks.fs.verify();
        mocks.temp.verify();
      });

      it('should call adb to start screen recording', async function () {
        mocks.adb.expects('shell').once().returns(new B(() => {}));
        mocks.adb.expects('fileSize').once().returns(39571);

        await driver.startRecordingScreen();
        driver._recentScreenRecordingPath.should.not.be.empty;
      });

      it('should return previous capture before starting a new recording', async function () {
        const remotePath = '/sdcard/video.mp4';

        mocks.adb.expects('shell').returns(new B(() => {}));
        mocks.adb.expects('fileSize').once().returns(39571);
        mocks.adb.expects('pull').once().withExactArgs(remotePath, localFile);
        mocks.fs.expects('readFile').once().withExactArgs(localFile).returns(mediaContent);
        mocks.adb.expects('rimraf').once().withExactArgs(remotePath);
        mocks.fs.expects('rimraf').withExactArgs(localFile).once();
        mocks.fs.expects('stat').once().withExactArgs(localFile).returns({size: 100});
        mocks.temp.expects('path').once().returns(localFile);

        driver._recentScreenRecordingPath = remotePath;
        (await driver.startRecordingScreen())
          .should.be.eql(mediaContent.toString('base64'));
        driver._recentScreenRecordingPath.should.not.be.empty;
        driver._recentScreenRecordingPath.should.not.be.eql(localFile);
      });

      it('should fail if adb screen recording errors out', async function () {
        mocks.adb.expects('fileSize').returns(31);
        let shellStub = sinon.stub(adb, 'shell');
        try {
          shellStub
            .returns(B.reject(new Error('shell command failed')));

          await driver.startRecordingScreen().should.eventually.be.rejectedWith(/shell command failed/);
        } finally {
          shellStub.restore();
        }
      });

      it('should call ls multiple times until size is big enough', async function () {
        mocks.adb.expects('shell').once().returns(new B(() => {}));
        let fileSizeStub = sinon.stub(adb, 'fileSize');
        try {
          fileSizeStub
              .onCall(0)
                .returns(31)
              .onCall(1)
                .returns(42);

          await driver.startRecordingScreen();
        } finally {
          fileSizeStub.restore();
        }
      });

      it('should call ls multiple times and fail if size never gets big enough', async function () {
        mocks.adb.expects('shell').once().returns(new B(() => {}));
        let fileSizeStub = sinon.stub(adb, 'fileSize');
        try {
          fileSizeStub.withArgs().returns(31);

          await driver.startRecordingScreen().should.eventually.be.rejectedWith(/is still too small: 31 bytes/);
        } finally {
          fileSizeStub.restore();
        }
      });
    });

    describe('stopRecordingScreen', function () {
      const psOutput = `
      USER           PID  PPID     VSZ    RSS WCHAN            ADDR S NAME
      root          8384     2       0      0 worker_thread       0 S [kworker/0:1]
      u0_a43        8400  1510 1449772  90992 ep_poll             0 S com.google.android.apps.messaging:rcs
      root          8423     2       0      0 worker_thread       0 S [kworker/u4:2]
      u0_a43        8435  1510 1452544  93576 ep_poll             0 S com.google.android.apps.messaging
      u0_a7         8471  1510 1427536  79804 ep_poll             0 S android.process.acore
      root          8669     2       0      0 worker_thread       0 S [kworker/u5:1]
      u0_a35        8805  1510 1426428  61540 ep_poll             0 S com.google.android.apps.wallpaper
      u0_a10        8864  1510 1427412  69752 ep_poll             0 S android.process.media
      root          8879     2       0      0 worker_thread       0 S [kworker/1:1]
      u0_a60        8897  1510 1490420 108852 ep_poll             0 S com.google.android.apps.photos
      shell         9136  1422    7808   2784 0            ebddfaf0 R ps
      `;

      beforeEach(function () {
        mocks.driver.expects('isEmulator').atLeast(1).returns(false);
        mocks.adb.expects('getApiLevel').atLeast(1).returns(19);
      });
      afterEach(function () {
        mocks.driver.verify();
        mocks.adb.verify();
        mocks.fs.verify();
        mocks.temp.verify();
      });

      it('should kill the process and get the content of the created mp4 file using lsof', async function () {
        const pids = ['1'];
        driver._recentScreenRecordingPath = null;
        const remotePath = '/sdcard/file.mp4';
        mocks.adb.expects('getPIDsByName').withExactArgs('screenrecord')
          .atLeast(1).returns(pids);
        mocks.adb.expects('shell').withExactArgs(['lsof', '-p', pids.join(',')]).returns({output: `
          screenrec 11328      shell  mem       REG              253,0   1330160        554 /system/bin/linker64
          screenrec 11328      shell    0u     unix                          0t0      99935 socket
          screenrec 11328      shell    1u     unix                          0t0      99935 socket
          screenrec 11328      shell    2u     unix                          0t0      99937 socket
          screenrec 11328      shell    3u      CHR              10,64       0t0      12300 /dev/binder
          screenrec 11328      shell    4u     unix                          0t0     101825 socket
          screenrec 11328      shell    5w      CHR              254,0       0t0       2923 /dev/pmsg0
          screenrec 11328      shell    6u      CHR              10,62       0t0      11690 /dev/ashmem
          screenrec 11328      shell    7u      CHR              10,62       0t0      11690 /dev/ashmem
          screenrec 11328      shell    8w      REG                0,5         0       6706 /sys/kernel/debug/tracing/trace_marker
          screenrec 11328      shell    9u      REG               0,19     11521     294673 ${remotePath}
        `});
        mocks.adb.expects('shell').withExactArgs(['kill', '-2', ...pids]);
        mocks.adb.expects('shell').withExactArgs(['ps']).returns(psOutput);
        mocks.adb.expects('pull').once().withExactArgs(remotePath, localFile);
        mocks.fs.expects('readFile').once().withExactArgs(localFile).returns(mediaContent);
        mocks.adb.expects('rimraf').once().withExactArgs(remotePath);
        mocks.fs.expects('rimraf').once().withExactArgs(localFile);
        mocks.fs.expects('stat').once().withExactArgs(localFile).returns({size: 100});
        mocks.temp.expects('path').once().returns(localFile);

        (await driver.stopRecordingScreen()).should.eql(mediaContent.toString('base64'));
      });

      it('should use the remembered file path if present', async function () {
        const pids = ['1'];
        driver._recentScreenRecordingPath = '/sdcard/file.mp4';
        mocks.adb.expects('getPIDsByName').withExactArgs('screenrecord')
          .atLeast(1).returns(pids);
        mocks.adb.expects('shell').withExactArgs(['kill', '-2', ...pids]);
        mocks.adb.expects('shell').withExactArgs(['ps']).returns(psOutput);
        mocks.adb.expects('pull').once().withExactArgs(driver._recentScreenRecordingPath, localFile);
        mocks.fs.expects('readFile').once().withExactArgs(localFile).returns(mediaContent);
        mocks.adb.expects('rimraf').once().withExactArgs(driver._recentScreenRecordingPath);
        mocks.fs.expects('rimraf').withExactArgs(localFile).once();
        mocks.fs.expects('stat').once().withExactArgs(localFile).returns({size: 100});
        mocks.temp.expects('path').once().returns(localFile);

        (await driver.stopRecordingScreen()).should.eql(mediaContent.toString('base64'));
      });

      it('should fail if the recorded file is too large', async function () {
        const pids = ['1'];
        driver._recentScreenRecordingPath = '/sdcard/file.mp4';
        mocks.adb.expects('getPIDsByName').withExactArgs('screenrecord')
          .atLeast(1).returns(pids);
        mocks.adb.expects('shell').withExactArgs(['kill', '-2', ...pids]);
        mocks.adb.expects('shell').withExactArgs(['ps']).returns(psOutput);
        mocks.adb.expects('pull').once().withExactArgs(driver._recentScreenRecordingPath, localFile);
        mocks.adb.expects('rimraf').once().withExactArgs(driver._recentScreenRecordingPath);
        mocks.fs.expects('rimraf').withExactArgs(localFile).once();
        mocks.fs.expects('stat').once().withExactArgs(localFile)
          .returns({size: process.memoryUsage().heapTotal});
        mocks.temp.expects('path').once().returns(localFile);

        await driver.stopRecordingScreen().should.eventually.be.rejectedWith(/is too large/);
      });

      it('should return empty string if no recording processes are running', async function () {
        driver._recentScreenRecordingPath = null;
        mocks.adb.expects('getPIDsByName')
          .atLeast(1).withExactArgs('screenrecord').returns([]);

        (await driver.stopRecordingScreen()).should.eql('');
      });
    });
  }));
});
