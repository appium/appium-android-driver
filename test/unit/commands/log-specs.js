import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import _ from 'lodash';
import sinon from 'sinon';
import ADB from 'appium-adb';
import os from 'os';
import AndroidDriver from '../../..';


chai.should();
chai.use(chaiAsPromised);

describe('commands - logging', function () {
  let driver;
  before(function () {
    driver = new AndroidDriver();
    driver.adb = new ADB();
  });
  describe('getLogTypes', function () {
    it('should respond to the command', function () {
      driver.getLogTypes.should.an.instanceof(Function);
    });
    it('should get log types', async function () {
      const types = await driver.getLogTypes();
      // all the types should be returned
      _.xor(['logcat', 'bugreport', 'server'], types).should.eql([]);
    });
  });
  describe('getLog', function () {
    it('should respond to the command', function () {
      driver.getLog.should.be.an.instanceof(Function);
    });
    it('should get logcat logs', async function () {
      sinon.stub(driver.adb, 'getLogcatLogs').returns(['logs']);
      (await driver.getLog('logcat')).should.be.deep.equal(['logs']);
      driver.adb.getLogcatLogs.called.should.be.true;
      driver.adb.getLogcatLogs.restore();
    });
    it('should get bugreport logs', async function () {
      sinon.stub(driver.adb, 'bugreport').returns(`line1${os.EOL}line2`);
      const [record1, record2] = await driver.getLog('bugreport');
      record1.message.should.eql('line1');
      record2.message.should.eql('line2');
      driver.adb.bugreport.called.should.be.true;
      driver.adb.bugreport.restore();
    });
  });
});