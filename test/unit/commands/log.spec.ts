import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import os from 'node:os';
import {describe, it, before, beforeEach, afterEach} from 'node:test';

import {ADB} from 'appium-adb';
import type {LogEntry} from 'appium-adb';
import sinon from 'sinon';

import {AndroidDriver} from '../../../lib/driver.js';

describe('commands - logging', function () {
  let driver: AndroidDriver;

  before(async function () {
    driver = new AndroidDriver();
    driver.adb = new ADB();
  });
  describe('getLogTypes', function () {
    it('should respond to the command', function () {
      assert.ok(driver.getLogTypes instanceof Function);
    });
    it('should get log types', async function () {
      const types = await driver.getLogTypes();
      // all the types should be returned
      assert.ok(['logcat', 'bugreport', 'server'].every((e) => types.includes(e)));
    });
  });
  describe('getLog', function () {
    it('should respond to the command', function () {
      assert.ok(driver.getLog instanceof Function);
    });
    it('should get logcat logs', async function () {
      const logEntries: LogEntry[] = [{timestamp: Date.now(), level: 'ALL', message: 'logs'} as LogEntry];
      const getLogcatLogsStub = sinon.stub(driver.adb, 'getLogcatLogs').resolves(logEntries);
      assert.deepStrictEqual(await driver.getLog('logcat'), logEntries);
      assert.strictEqual(getLogcatLogsStub.called, true);
      getLogcatLogsStub.restore();
    });
    it('should get bugreport logs', async function () {
      const bugreportStub = sinon.stub(driver.adb, 'bugreport').returns(Promise.resolve(`line1${os.EOL}line2`));
      const [record1, record2] = await driver.getLog('bugreport');
      assert.strictEqual(record1.message, 'line1');
      assert.strictEqual(record2.message, 'line2');
      assert.strictEqual(bugreportStub.called, true);
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

      assert.strictEqual(socket1.send.calledWithExactly('hello'), true);
      assert.strictEqual(socket2.send.calledWithExactly('hello'), true);

      socket1.emit('close', 1000, Buffer.from(''));
      assert.strictEqual(removeLogcatListenerStub.called, false);

      socket2.emit('close', 1000, Buffer.from(''));
      assert.strictEqual(removeLogcatListenerStub.calledOnce, true);
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

      assert.strictEqual(socket1.send.called, false);
      assert.strictEqual(socket2.send.calledWithExactly('hello'), true);
    });
  });
});
