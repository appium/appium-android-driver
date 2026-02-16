import _ from 'lodash';
import sinon from 'sinon';
import {ADB} from 'appium-adb';
import os from 'node:os';
import {AndroidDriver} from '../../../lib/driver';
import {expect, use} from 'chai';
import chaiAsPromised from 'chai-as-promised';

use(chaiAsPromised);

describe('commands - logging', function () {
  let driver: AndroidDriver;

  before(async function () {
    driver = new AndroidDriver();
    driver.adb = new ADB();
  });
  describe('getLogTypes', function () {
    it('should respond to the command', function () {
      expect(driver.getLogTypes).to.be.an.instanceof(Function);
    });
    it('should get log types', async function () {
      const types = await driver.getLogTypes();
      // all the types should be returned
      expect(_.xor(['logcat', 'bugreport', 'server'], types)).to.eql([]);
    });
  });
  describe('getLog', function () {
    it('should respond to the command', function () {
      expect(driver.getLog).to.be.an.instanceof(Function);
    });
    it('should get logcat logs', async function () {
      const getLogcatLogsStub = sinon.stub(driver.adb, 'getLogcatLogs').returns(['logs']);
      expect(await driver.getLog('logcat')).to.deep.equal(['logs']);
      expect(getLogcatLogsStub.called).to.be.true;
      getLogcatLogsStub.restore();
    });
    it('should get bugreport logs', async function () {
      const bugreportStub = sinon
        .stub(driver.adb, 'bugreport')
        .returns(Promise.resolve(`line1${os.EOL}line2`));
      const [record1, record2] = await driver.getLog('bugreport');
      expect(record1.message).to.eql('line1');
      expect(record2.message).to.eql('line2');
      expect(bugreportStub.called).to.be.true;
      bugreportStub.restore();
    });
  });
});
