import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import Bootstrap from 'appium-android-bootstrap';
import path from 'path';
import mockFS from 'mock-fs';
import AndroidDriver from '../../..';
import { fs, zip } from 'appium-support';
import temp from 'temp';

let driver;
let sandbox = sinon.sandbox.create();
chai.should();
chai.use(chaiAsPromised);

describe('Actions', () => {
  before(() => {
    driver = new AndroidDriver();
    driver.bootstrap = new Bootstrap();
    sandbox.stub(driver.bootstrap, 'sendAction');
  });
  after(() => {
    sandbox.restore();
  });
  describe('Swipe', () => {
    it('should swipe an element', () => {
      driver.swipe(0, 0, 1, 1, 0, 1, 'someElementId');
      driver.bootstrap.sendAction.calledWith('element:swipe').should.be.true;
    });
    it('should swipe without an element', () => {
      driver.swipe(0, 0, 1, 1, 0, 1);
      driver.bootstrap.sendAction.calledWith('swipe').should.be.true;
    });
  });
  describe('Flick', () => {
    it('should flick an element', async () => {
      await driver.flick('someElementId', 0, 0, 1, 1, 1);
      driver.bootstrap.sendAction.calledWith('element:flick').should.be.true;
    });
    it('should flick without an element', async () => {
      await driver.flick(null, 0, 0, 1, 1, 1);
      driver.bootstrap.sendAction.calledWith('flick').should.be.true;
    });
  });
  describe('Drag', () => {
    it('should drag an element', () => {
      driver.drag(0, 0, 1, 1, 1, 1, 'someElementId');
      driver.bootstrap.sendAction.calledWith('element:drag').should.be.true;
    });
    it('should drag without an element', () => {
      driver.drag(0, 0, 1, 1, 1, 1);
      driver.bootstrap.sendAction.calledWith('drag').should.be.true;
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
        await fs.writeFile(path.resolve(localPath, 'a.txt'), 'hello world', {flags: 'w'});
        await fs.writeFile(path.resolve(localPath, 'b.txt'), 'foobar', {flags: 'w'});
      };
      if (!driver.adb) {
        driver.adb = {pull};
      } else {
        adbPullStub = sinon.stub(driver.adb, 'pull', pull);
      }

      // Call 'driver.pullFolder' and zip the base64 contents to a .zip file
      const zippedBase64 = await driver.pullFolder('/does/not/matter');
      (typeof(zippedBase64)).should.equal('string');
      await fs.writeFile(path.resolve(zippedDir, 'zipped.zip'), zippedBase64, {encoding: 'base64', flags: 'w'});

      // Extract the zip file and verify it's contents
      await zip.extractAllTo(path.resolve(zippedDir, 'zipped.zip'), unzippedDir);
      await fs.readFile(path.resolve(unzippedDir, 'a.txt'), 'utf8').should.eventually.equal('hello world');
      await fs.readFile(path.resolve(unzippedDir, 'b.txt'), 'utf8').should.eventually.equal('foobar');

      // Restore stub
      if (adbPullStub) {
        adbPullStub.restore();
      } else {
        delete driver.adb;
      }
    });
  });
});
