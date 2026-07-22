import sinon from 'sinon';
import {ADB} from 'appium-adb';
import type {LogEntry} from 'appium-adb';
import os from 'node:os';
import {EventEmitter} from 'node:events';
import {AndroidDriver} from '../../../lib/driver.js';
import {expect, use} from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {describe, it, before, beforeEach, afterEach} from 'node:test';

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
      expect(types).to.have.members(['logcat', 'bugreport', 'server']);
    });
  });
  describe('getLog', function () {
    it('should respond to the command', function () {
      expect(driver.getLog).to.be.an.instanceof(Function);
    });
    it('should get logcat logs', async function () {
      const logEntries: LogEntry[] = [
        {timestamp: Date.now(), level: 'ALL', message: 'logs'} as LogEntry,
      ];
      const getLogcatLogsStub = sinon.stub(driver.adb, 'getLogcatLogs').resolves(logEntries);
      expect(await driver.getLog('logcat')).to.deep.equal(logEntries);
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
  describe('mobileStartLogsBroadcast / mobileStopLogsBroadcast', function () {
    const sandbox = sinon.createSandbox();
    let broadcastDriver: AndroidDriver;
    let addWebSocketHandlerStub: sinon.SinonStub;

    function makeFakeSocket() {
      const socket = new EventEmitter() as EventEmitter & {
        readyState: number;
        send: sinon.SinonStub;
      };
      socket.readyState = 1; // WebSocket.OPEN
      socket.send = sandbox.stub();
      return socket;
    }

    beforeEach(function () {
      broadcastDriver = new AndroidDriver();
      broadcastDriver.adb = new ADB();
      broadcastDriver.sessionId = 'session-id';
      addWebSocketHandlerStub = sandbox.stub().resolves();
      broadcastDriver.server = {
        getWebSocketHandlers: sandbox.stub().resolves({}),
        address: sandbox.stub().returns({}),
        addWebSocketHandler: addWebSocketHandlerStub,
        removeWebSocketHandler: sandbox.stub().resolves(),
      } as any;
    });
    afterEach(function () {
      sandbox.restore();
    });

    it('should broadcast logcat lines to every connected socket and only stop listening after the last one closes', async function () {
      const setLogcatListenerStub = sandbox.stub(broadcastDriver.adb, 'setLogcatListener');
      const removeLogcatListenerStub = sandbox.stub(broadcastDriver.adb, 'removeLogcatListener');

      await broadcastDriver.mobileStartLogsBroadcast();

      const wss = addWebSocketHandlerStub.getCall(0).args[1];
      const socket1 = makeFakeSocket();
      const socket2 = makeFakeSocket();
      wss.emit('connection', socket1);
      wss.emit('connection', socket2);

      const listener = setLogcatListenerStub.lastCall.args[0];
      listener({timestamp: Date.now(), level: 'ALL', message: 'hello'} as LogEntry);

      expect(socket1.send.calledWithExactly('hello')).to.be.true;
      expect(socket2.send.calledWithExactly('hello')).to.be.true;

      socket1.emit('close', 1000, Buffer.from(''));
      expect(removeLogcatListenerStub.called).to.be.false;

      socket2.emit('close', 1000, Buffer.from(''));
      expect(removeLogcatListenerStub.calledOnce).to.be.true;
    });

    it('should not broadcast to sockets that already closed', async function () {
      sandbox.stub(broadcastDriver.adb, 'setLogcatListener');
      sandbox.stub(broadcastDriver.adb, 'removeLogcatListener');

      await broadcastDriver.mobileStartLogsBroadcast();

      const wss = addWebSocketHandlerStub.getCall(0).args[1];
      const socket1 = makeFakeSocket();
      const socket2 = makeFakeSocket();
      wss.emit('connection', socket1);
      wss.emit('connection', socket2);

      socket1.readyState = 3; // WebSocket.CLOSED
      const listener = (broadcastDriver.adb.setLogcatListener as sinon.SinonStub).lastCall.args[0];
      listener({timestamp: Date.now(), level: 'ALL', message: 'hello'} as LogEntry);

      expect(socket1.send.called).to.be.false;
      expect(socket2.send.calledWithExactly('hello')).to.be.true;
    });
  });
});
