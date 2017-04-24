import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import Bootstrap from 'appium-android-bootstrap';
import path from 'path';
import AndroidDriver from '../../..';
import { fs, mkdirp, tempDir, zip } from 'appium-support';

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
    it('should pull a folder and return base64 zip', async () => {

      let adbPullStub;
      const pull = async (ignore, localPath) => {
        await mkdirp(path.resolve(localPath));
        await fs.writeFile(path.resolve(localPath, 'a.txt'), 'hello world', {flags: 'w'});
        await fs.writeFile(path.resolve(localPath, 'b.txt'), 'foobar', {flags: 'w'});
      };

      // Stub in driver.adb
      if (!driver.adb) {
        driver.adb = {pull};
      } else {
        adbPullStub = sinon.stub(driver.adb, 'pull', pull);
      }

      // Get the zipped buffer contents and write it to a .zip file
      const buffer = await driver.pullFolder('/does/not/matter');
      const zippedDir = await tempDir.openDir();
      await fs.writeFile(path.resolve(zippedDir, 'zipped.zip'), buffer, 'base64');
      
      // Extract the zip file
      const unzippedDir = await tempDir.openDir();
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
