import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import Bootstrap from 'appium-android-bootstrap';
import path from 'path';
import mockFS from 'mock-fs';
import AndroidDriver from '../../..';
import androidHelpers from '../../../lib/android-helpers';
import * as support from 'appium-support';
import temp from 'temp';
import ADB from 'appium-adb';
import jimp from 'jimp';
import helpers from '../../../lib/commands/actions';
import * as teen_process from 'teen_process';

let driver;
let sandbox = sinon.sandbox.create();
chai.should();
chai.use(chaiAsPromised);

describe('Actions', () => {
  beforeEach(() => {
    driver = new AndroidDriver();
    driver.adb = new ADB();
    driver.bootstrap = new Bootstrap();
    sandbox.stub(driver.bootstrap, 'sendAction');
  });
  afterEach(() => {
    sandbox.restore();
  });
  describe('keyevent', () => {
    it('shoudle be able to execute keyevent via pressKeyCode', async () => {
      sandbox.stub(driver, 'pressKeyCode');
      await driver.keyevent('66', 'meta');
      driver.pressKeyCode.calledWithExactly('66', 'meta').should.be.true;
    });
    it('should set metastate to null by default', async () => {
      sandbox.stub(driver, 'pressKeyCode');
      await driver.keyevent('66');
      driver.pressKeyCode.calledWithExactly('66', null).should.be.true;
    });
  });
  describe('pressKeyCode', () => {
    it('shoudle be able to press key code', async () => {
      await driver.pressKeyCode('66', 'meta');
      driver.bootstrap.sendAction
        .calledWithExactly('pressKeyCode', {keycode: '66', metastate: 'meta'})
        .should.be.true;
    });
    it('should set metastate to null by default', async () => {
      await driver.pressKeyCode('66');
      driver.bootstrap.sendAction
        .calledWithExactly('pressKeyCode', {keycode: '66', metastate: null})
        .should.be.true;
    });
  });
  describe('longPressKeyCode', () => {
    it('shoudle be able to press key code', async () => {
      await driver.longPressKeyCode('66', 'meta');
      driver.bootstrap.sendAction
        .calledWithExactly('longPressKeyCode', {keycode: '66', metastate: 'meta'})
        .should.be.true;
    });
    it('should set metastate to null by default', async () => {
      await driver.longPressKeyCode('66');
      driver.bootstrap.sendAction
        .calledWithExactly('longPressKeyCode', {keycode: '66', metastate: null})
        .should.be.true;
    });
  });
  describe('getOrientation', () => {
    it('shoudle be able to get orientation', async () => {
      driver.bootstrap.sendAction.withArgs('orientation', {naturalOrientation: false})
        .returns('landscape');
      await driver.getOrientation().should.become('LANDSCAPE');
      driver.bootstrap.sendAction
        .calledWithExactly('orientation', {naturalOrientation: false})
        .should.be.true;
    });
  });
  describe('setOrientation', () => {
    it('shoudle be able to set orientation', async () => {
      let opts = {orientation: 'SOMESCAPE', naturalOrientation: false};
      await driver.setOrientation('somescape');
      driver.bootstrap.sendAction.calledWithExactly('orientation', opts)
        .should.be.true;
    });
  });
  describe('fakeFlick', () => {
    it('shoudle be able to do fake flick', async () => {
      await driver.fakeFlick(12, 34);
      driver.bootstrap.sendAction
        .calledWithExactly('flick', {xSpeed: 12, ySpeed: 34}).should.be.true;
    });
  });
  describe('fakeFlickElement', () => {
    it('shoudle be able to do fake flick on element', async () => {
      await driver.fakeFlickElement(5000, 56, 78, 1.32);
      driver.bootstrap.sendAction
        .calledWithExactly('element:flick',
          {xoffset: 56, yoffset: 78, speed: 1.32, elementId: 5000})
        .should.be.true;
    });
  });
  describe('swipe', () => {
    it('should swipe an element', () => {
      let swipeOpts = {startX: 10, startY: 11, endX: 20, endY: 22,
                       steps: 3, elementId: 'someElementId'};
      driver.swipe(10, 11, 20, 22, 0.1, null, 'someElementId');
      driver.bootstrap.sendAction.calledWithExactly('element:swipe', swipeOpts)
        .should.be.true;
    });
    it('should swipe without an element', () => {
      driver.swipe(0, 0, 1, 1, 0, 1);
      driver.bootstrap.sendAction.calledWith('swipe').should.be.true;
    });
    it('should set start point to (0.5;0.5) if startX and startY are "null"', async () => {
      let swipeOpts = {startX: 0.5, startY: 0.5, endX: 0, endY: 0, steps: 0};
      sandbox.stub(driver, 'doSwipe');
      driver.swipe('null', 'null', 0, 0, 0);
      driver.doSwipe.calledWithExactly(swipeOpts).should.be.true;
    });
  });
  describe('pinchClose', () => {
    it('should be able to pinch in element', async () => {
      let pinchOpts = {direction: 'in', elementId: 'el01', percent: 0.5, steps: 5};
      await driver.pinchClose(null, null, null, null, null, 0.5, 5, 'el01');
      driver.bootstrap.sendAction.calledWithExactly('element:pinch', pinchOpts)
        .should.be.true;
    });
  });
  describe('pinchOpen', () => {
    it('should be able to pinch out element', async () => {
      let pinchOpts = {direction: 'out', elementId: 'el01', percent: 0.5, steps: 5};
      await driver.pinchOpen(null, null, null, null, null, 0.5, 5, 'el01');
      driver.bootstrap.sendAction.calledWithExactly('element:pinch', pinchOpts)
        .should.be.true;
    });
  });
  describe('flick', () => {
    it('should call fakeFlickElement if element is passed', async () => {
      sandbox.stub(driver, 'fakeFlickElement');
      await driver.flick('elem', null, null, 1, 2, 3);
      driver.fakeFlickElement.calledWith('elem', 1, 2, 3).should.be.true;
    });
    it('should call fakeFlick if element is not passed', async () => {
      sandbox.stub(driver, 'fakeFlick');
      await driver.flick(null, 1, 2);
      driver.fakeFlick.calledWith(1, 2).should.be.true;
    });
  });
  describe('drag', () => {
    let dragOpts = {
      elementId: 'elem1', destElId: 'elem2',
      startX: 1, startY: 2, endX: 3, endY: 4, steps: 1
    };
    it('should drag an element', async () => {
      driver.drag(1, 2, 3, 4, 0.02, null, 'elem1', 'elem2');
      driver.bootstrap.sendAction.calledWithExactly('element:drag', dragOpts)
        .should.be.true;
    });
    it('should drag without an element', async () => {
      dragOpts.elementId = null;
      driver.drag(1, 2, 3, 4, 0.02, null, null, 'elem2');
      driver.bootstrap.sendAction.calledWithExactly('drag', dragOpts)
        .should.be.true;
    });
  });
  describe('lock', () => {
    it('should call adb.lock()', async () => {
      sandbox.stub(driver.adb, 'lock');
      await driver.lock();
      driver.adb.lock.calledOnce.should.be.true;
    });
  });
  describe('isLocked', () => {
    it('should call adb.isScreenLocked()', async () => {
      sandbox.stub(driver.adb, 'isScreenLocked').returns('lock_status');
      await driver.isLocked().should.become('lock_status');
      driver.adb.isScreenLocked.calledOnce.should.be.true;
    });
  });
  describe('unlock', () => {
    it('should call android-helpers.unlock()', async () => {
      sandbox.stub(androidHelpers, 'unlock');
      await driver.unlock('caps');
      androidHelpers.unlock.calledWithExactly(driver, driver.adb, 'caps')
        .should.be.true;
    });
  });
  describe('openNotifications', () => {
    it('should be able to open notifications', async () => {
      await driver.openNotifications();
      driver.bootstrap.sendAction.calledWithExactly('openNotification')
        .should.be.true;
    });
  });
  describe('setLocation', () => {
    it('should be able to set location', async () => {
      sandbox.stub(driver.adb, 'sendTelnetCommand');
      await driver.setLocation('lat', 'long');
      driver.adb.sendTelnetCommand.calledWithExactly('geo fix long lat')
        .should.be.true;
    });
  });
  describe('pullFile', () => {
    it('should be able to pull file from device', async () => {
      let localFile = 'local/tmp_file';
      sandbox.stub(temp, 'path').returns(localFile);
      sandbox.stub(driver.adb, 'pull');
      sandbox.stub(support.fs, 'readFile').withArgs(localFile).returns('appium');
      sandbox.stub(support.fs, 'exists').withArgs(localFile).returns(true);
      sandbox.stub(support.fs, 'unlink');
      await driver.pullFile('remote_path').should.become('YXBwaXVt');
      driver.adb.pull.calledWithExactly('remote_path', localFile)
        .should.be.true;
      support.fs.unlink.calledWithExactly(localFile).should.be.true;
    });
  });
  describe('pushFile', () => {
    it('should be able to push file to device', async () => {
      let localFile = 'local/tmp_file';
      let content = 'appium';
      sandbox.stub(temp, 'path').returns(localFile);
      sandbox.stub(support, 'mkdirp');
      sandbox.stub(driver.adb, 'push');
      sandbox.stub(support.fs, 'writeFile');
      await driver.pushFile('remote_path', 'YXBwaXVt');
      support.fs.writeFile.calledWithExactly(localFile, content, 'binary').should.be.true;
      driver.adb.push.calledWithExactly(localFile, 'remote_path').should.be.true;
    });
  });
  describe('pullFolder', () => {
    let zippedDir, unzippedDir, tempDir, tempPathStub;

    before(() => {
      // Create in-memory mock file system for file writes
      zippedDir = '/mock/path/to/zipped';
      unzippedDir = '/mock/path/to/unzipped';
      tempDir = '/mock/path/to/temp-dir';
      mockFS({
        [zippedDir]: {},
        [unzippedDir]: {},
        [tempDir]: {},
      });

      // Stub temp.path to use an in-memory filepath
      tempPathStub = sinon.stub(temp, 'path', () => tempDir);
    });

    after(() => {
      tempPathStub.restore();
      mockFS.restore();
    });

    it('should pull a folder and return base64 zip', async () => {
      // Stub in driver.adb and make it pull a folder with two files
      let adbPullStub;
      const pull = async (ignore, localPath) => {
        await support.fs.writeFile(path.resolve(localPath, 'a.txt'), 'hello world', {flags: 'w'});
        await support.fs.writeFile(path.resolve(localPath, 'b.txt'), 'foobar', {flags: 'w'});
      };
      if (!driver.adb) {
        driver.adb = {pull};
      } else {
        adbPullStub = sinon.stub(driver.adb, 'pull', pull);
      }

      // Call 'driver.pullFolder' and zip the base64 contents to a .zip file
      const zippedBase64 = await driver.pullFolder('/does/not/matter');
      (typeof zippedBase64).should.equal('string');
      await support.fs.writeFile(path.resolve(zippedDir, 'zipped.zip'), zippedBase64, {encoding: 'base64', flags: 'w'});

      // Extract the zip file and verify it's contents
      await support.zip.extractAllTo(path.resolve(zippedDir, 'zipped.zip'), unzippedDir);
      await support.fs.readFile(path.resolve(unzippedDir, 'a.txt'), 'utf8').should.eventually.equal('hello world');
      await support.fs.readFile(path.resolve(unzippedDir, 'b.txt'), 'utf8').should.eventually.equal('foobar');

      // Restore stub
      if (adbPullStub) {
        adbPullStub.restore();
      } else {
        delete driver.adb;
      }
    });
  });
  describe('fingerprint', () => {
    it('should call fingerprint adb command for emulator', async () => {
      sandbox.stub(driver.adb, 'fingerprint');
      sandbox.stub(driver, 'isEmulator').returns(true);
      await driver.fingerprint(1111);
      driver.adb.fingerprint.calledWithExactly(1111).should.be.true;
    });
    it('should throw exception for real device', async () => {
      sandbox.stub(driver.adb, 'fingerprint');
      sandbox.stub(driver, 'isEmulator').returns(false);
      await driver.fingerprint(1111).should.be
        .rejectedWith('fingerprint method is only available for emulators');
      driver.adb.fingerprint.notCalled.should.be.true;
    });
  });
  describe('sendSMS', () => {
    it('should call sendSMS adb command for emulator', async () => {
      sandbox.stub(driver.adb, 'sendSMS');
      sandbox.stub(driver, 'isEmulator').returns(true);
      await driver.sendSMS(4509, 'Hello Appium');
      driver.adb.sendSMS.calledWithExactly(4509, 'Hello Appium')
        .should.be.true;
    });
    it('should throw exception for real device', async () => {
      sandbox.stub(driver.adb, 'sendSMS');
      sandbox.stub(driver, 'isEmulator').returns(false);
      await driver.sendSMS(4509, 'Hello Appium')
        .should.be.rejectedWith('sendSMS method is only available for emulators');
      driver.adb.sendSMS.notCalled.should.be.true;
    });
  });
  describe('gsmCall', () => {
    it('should call gsmCall adb command for emulator', async () => {
      sandbox.stub(driver.adb, 'gsmCall');
      sandbox.stub(driver, 'isEmulator').returns(true);
      await driver.gsmCall(4509, 'call');
      driver.adb.gsmCall.calledWithExactly(4509, 'call').should.be.true;
    });
    it('should throw exception for real device', async () => {
      sandbox.stub(driver.adb, 'gsmCall');
      sandbox.stub(driver, 'isEmulator').returns(false);
      await driver.gsmCall(4509, 'call')
        .should.be.rejectedWith('gsmCall method is only available for emulators');
      driver.adb.gsmCall.notCalled.should.be.true;
    });
  });
  describe('gsmSignal', () => {
    it('should call gsmSignal adb command for emulator', async () => {
      sandbox.stub(driver.adb, 'gsmSignal');
      sandbox.stub(driver, 'isEmulator').returns(true);
      await driver.gsmSignal(3);
      driver.adb.gsmSignal.calledWithExactly(3)
        .should.be.true;
    });
    it('should throw exception for real device', async () => {
      sandbox.stub(driver.adb, 'gsmSignal');
      sandbox.stub(driver, 'isEmulator').returns(false);
      await driver.gsmSignal(3)
        .should.be.rejectedWith('gsmSignal method is only available for emulators');
      driver.adb.gsmSignal.notCalled.should.be.true;
    });
  });
  describe('gsmVoice', () => {
    it('should call gsmVoice adb command for emulator', async () => {
      sandbox.stub(driver.adb, 'gsmVoice');
      sandbox.stub(driver, 'isEmulator').returns(true);
      await driver.gsmVoice('roaming');
      driver.adb.gsmVoice.calledWithExactly('roaming')
        .should.be.true;
    });
    it('should throw exception for real device', async () => {
      sandbox.stub(driver.adb, 'gsmVoice');
      sandbox.stub(driver, 'isEmulator').returns(false);
      await driver.gsmVoice('roaming')
        .should.be.rejectedWith('gsmVoice method is only available for emulators');
      driver.adb.gsmVoice.notCalled.should.be.true;
    });
  });
  describe('powerAC', () => {
    it('should call powerAC adb command for emulator', async () => {
      sandbox.stub(driver.adb, 'powerAC');
      sandbox.stub(driver, 'isEmulator').returns(true);
      await driver.powerAC('off');
      driver.adb.powerAC.calledWithExactly('off')
        .should.be.true;
    });
    it('should throw exception for real device', async () => {
      sandbox.stub(driver.adb, 'powerAC');
      sandbox.stub(driver, 'isEmulator').returns(false);
      await driver.powerAC('roaming')
        .should.be.rejectedWith('powerAC method is only available for emulators');
      driver.adb.powerAC.notCalled.should.be.true;
    });
  });
  describe('powerCapacity', () => {
    it('should call powerCapacity adb command for emulator', async () => {
      sandbox.stub(driver.adb, 'powerCapacity');
      sandbox.stub(driver, 'isEmulator').returns(true);
      await driver.powerCapacity(5);
      driver.adb.powerCapacity.calledWithExactly(5)
        .should.be.true;
    });
    it('should throw exception for real device', async () => {
      sandbox.stub(driver.adb, 'powerCapacity');
      sandbox.stub(driver, 'isEmulator').returns(false);
      await driver.powerCapacity(5)
        .should.be.rejectedWith('powerCapacity method is only available for emulators');
      driver.adb.powerCapacity.notCalled.should.be.true;
    });
  });
  describe('networkSpeed', () => {
    it('should call networkSpeed adb command for emulator', async () => {
      sandbox.stub(driver.adb, 'networkSpeed');
      sandbox.stub(driver, 'isEmulator').returns(true);
      await driver.networkSpeed('gsm');
      driver.adb.networkSpeed.calledWithExactly('gsm')
        .should.be.true;
    });
    it('should throw exception for real device', async () => {
      sandbox.stub(driver.adb, 'networkSpeed');
      sandbox.stub(driver, 'isEmulator').returns(false);
      await driver.networkSpeed('gsm')
        .should.be.rejectedWith('networkSpeed method is only available for emulators');
      driver.adb.networkSpeed.notCalled.should.be.true;
    });
  });
  describe('getScreenshotDataWithAdbShell', () => {
    const defaultDir = '/data/local/tmp/';
    const png = '/path/sc.png';
    const localFile = 'local_file';
    beforeEach(() => {
      sandbox.stub(temp, 'path');
      sandbox.stub(support.fs, 'exists');
      sandbox.stub(support.fs, 'unlink');
      sandbox.stub(driver.adb, 'shell');
      sandbox.stub(driver.adb, 'pull');
      sandbox.stub(path.posix, 'resolve');
      sandbox.stub(jimp, 'read');
      sandbox.stub(driver.adb, 'fileSize');
      temp.path.returns(localFile);
      support.fs.exists.withArgs(localFile).returns(true);
      support.fs.unlink.withArgs(localFile).returns(true);
      path.posix.resolve.withArgs(defaultDir, 'screenshot.png').returns(png);
      driver.adb.fileSize.withArgs(png).returns(1);
      jimp.read.withArgs(localFile).returns('screenshoot_context');
    });
    it('should be able to get screenshot via adb shell', async () => {
      await helpers.getScreenshotDataWithAdbShell(driver.adb, {})
        .should.become('screenshoot_context');
      driver.adb.shell.calledWithExactly(['/system/bin/rm', `${png};`
        , '/system/bin/screencap', '-p', png]).should.be.true;
      driver.adb.pull.calledWithExactly(png, localFile).should.be.true;
      jimp.read.calledWithExactly(localFile).should.be.true;
      support.fs.exists.calledTwice.should.be.true;
      support.fs.unlink.calledTwice.should.be.true;
    });
    it('should be possible to change default png dir', async () => {
      path.posix.resolve.withArgs('/custom/path/tmp/', 'screenshot.png').returns(png);
      await helpers.getScreenshotDataWithAdbShell(driver.adb
        , {androidScreenshotPath: '/custom/path/tmp/'})
        .should.become('screenshoot_context');
    });
    it('should throw error if size of the screenshot is zero', async () => {
      driver.adb.fileSize.withArgs(png).returns(0);
      await helpers.getScreenshotDataWithAdbShell(driver.adb, {})
        .should.be.rejectedWith('equals to zero');
    });
  });
  describe('getScreenshotDataWithAdbExecOut', () => {
    it('should be able to take screenshot via exec-out', async () => {
      sandbox.stub(teen_process, 'exec');
      sandbox.stub(jimp, 'read');
      teen_process.exec.returns({stdout: 'stdout'});
      driver.adb.executable.path = 'path/to/adb';
      await helpers.getScreenshotDataWithAdbExecOut(driver.adb);
      teen_process.exec.calledWithExactly('path/to/adb', ['exec-out', '/system/bin/screencap -p']
        , {encoding: 'binary', isBuffer: true}).should.be.true;
      jimp.read.calledWithExactly('stdout').should.be.true;
    });
    it('should throw error if size of the screenshot is zero', async () => {
      sandbox.stub(teen_process, 'exec');
      teen_process.exec.returns({stdout: ''});
      await helpers.getScreenshotDataWithAdbExecOut(driver.adb)
        .should.be.rejectedWith('screenshot equals to zero');
    });
  });
  describe('getScreenshot', () => {
    let image;
    beforeEach(() => {
      image = new jimp(1, 1);
      sandbox.stub(driver.adb, 'getApiLevel');
      sandbox.stub(driver.adb, 'getScreenOrientation');
      sandbox.stub(driver, 'getScreenshotDataWithAdbExecOut');
      sandbox.stub(driver, 'getScreenshotDataWithAdbShell');
      sandbox.stub(image, 'getBuffer', function (mime, cb) { // eslint-disable-line promise/prefer-await-to-callbacks
        return cb.call(this, null, new Buffer('appium'));
      });
      sandbox.stub(image, 'rotate');
      driver.adb.getScreenOrientation.returns(2);
      image.rotate.withArgs(-180).returns(image);
    });
    it('should be able to take screenshot via exec-out (API level > 20)', async () => {
      driver.adb.getApiLevel.returns(24);
      driver.getScreenshotDataWithAdbExecOut.withArgs(driver.adb).returns(image);
      await driver.getScreenshot().should.become('YXBwaXVt');
      driver.getScreenshotDataWithAdbExecOut.calledOnce.should.be.true;
      driver.getScreenshotDataWithAdbShell.notCalled.should.be.true;
      image.getBuffer.calledWith(jimp.MIME_PNG).should.be.true;
    });
    it('should be able to take screenshot via adb shell (API level <= 20)', async () => {
      driver.adb.getApiLevel.returns(20);
      driver.getScreenshotDataWithAdbShell.withArgs(driver.adb, driver.opts).returns(image);
      await driver.getScreenshot().should.become('YXBwaXVt');
      driver.getScreenshotDataWithAdbShell.calledOnce.should.be.true;
      driver.getScreenshotDataWithAdbExecOut.notCalled.should.be.true;
      image.getBuffer.calledWith(jimp.MIME_PNG).should.be.true;
    });
    it('should tries to take screenshot via adb shell if exec-out failed (API level > 20)', async () => {
      driver.adb.getApiLevel.returns(24);
      driver.getScreenshotDataWithAdbExecOut.throws();
      driver.getScreenshotDataWithAdbShell.withArgs(driver.adb, driver.opts).returns(image);
      await driver.getScreenshot().should.become('YXBwaXVt');
      driver.getScreenshotDataWithAdbShell.calledOnce.should.be.true;
      driver.getScreenshotDataWithAdbShell.calledOnce.should.be.true;
    });
    it('should throw error if adb shell failed', async () => {
      driver.adb.getApiLevel.returns(20);
      driver.getScreenshotDataWithAdbShell.throws();
      await driver.getScreenshot().should.be.rejectedWith('Cannot get screenshot');
    });
    it('should rotate image if API level < 23', async () => {
      driver.adb.getApiLevel.returns(22);
      driver.getScreenshotDataWithAdbExecOut.withArgs(driver.adb).returns(image);
      await driver.getScreenshot();
      driver.adb.getScreenOrientation.calledOnce.should.be.true;
      image.rotate.calledOnce.should.be.true;
    });
    it('should not rotate image if API level >= 23', async () => {
      driver.adb.getApiLevel.returns(23);
      driver.getScreenshotDataWithAdbExecOut.withArgs(driver.adb).returns(image);
      await driver.getScreenshot();
      driver.adb.getScreenOrientation.notCalled.should.be.true;
      image.rotate.notCalled.should.be.true;
    });
    it('should not throws error if rotate image failed', async () => {
      image.rotate.resetBehavior();
      image.rotate.throws();
      driver.adb.getApiLevel.returns(22);
      driver.getScreenshotDataWithAdbExecOut.withArgs(driver.adb).returns(image);
      await driver.getScreenshot().should.be.fulfilled;
      image.rotate.threw().should.be.true;
    });
  });
});
