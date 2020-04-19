// transpile :mocha

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { AndroidBootstrap, COMMAND_TYPES } from '../../../lib/bootstrap';
import { UiAutomator } from '../../../lib/uiautomator';
import ADB from 'appium-adb';
import { withSandbox } from 'appium-test-support';
import events from 'events';
import net from 'net';
import { errors } from 'appium-base-driver';
import _ from 'lodash';


chai.should();
chai.use(chaiAsPromised);

describe('AndroidBootstrap', function () {
  const systemPort = 4724;
  let adb = new ADB();
  let androidBootstrap = new AndroidBootstrap(adb, systemPort);
  let uiAutomator = new UiAutomator(adb);

  describe('start', withSandbox({mocks: {adb, uiAutomator, net, androidBootstrap}}, (S) => {
    it('should return a sub process', async function () {
      const conn = new events.EventEmitter();
      const appPackage = 'com.example.android.apis';
      const disableAndroidWatchers = false;
      androidBootstrap.uiAutomator = uiAutomator;
      S.mocks.androidBootstrap.expects('init').once()
        .returns('');
      S.mocks.adb.expects('forwardPort').once()
        .withExactArgs(systemPort, systemPort)
        .returns('');
      S.mocks.uiAutomator.expects('start')
        .once()
        .returns(conn);
      S.mocks.net.expects('connect').once().returns(conn);
      setTimeout(() => {
        conn.emit('connect');
      }, 1);
      await androidBootstrap.start(appPackage, disableAndroidWatchers);
      S.verify();
    });
  }));
  describe('sendCommand', function () {
    it('should successfully return after receiving data from bootstrap in parts', async function () {
      const conn = new events.EventEmitter();
      conn.write = _.noop;
      conn.setEncoding = _.noop;
      androidBootstrap.socketClient = conn;
      setTimeout(() => {
        conn.emit('data', `{"status": 0, `);
        conn.emit('data', `"value": "hello"}`);
      }, 1);
      (await androidBootstrap.sendCommand(COMMAND_TYPES.ACTION, {action: 'getDataDir'}, 1000))
        .should.equal('hello');
    });
    it('should successfully return after receiving data from bootstrap', async function () {
      const conn = new events.EventEmitter();
      conn.write = _.noop;
      conn.setEncoding = _.noop;
      androidBootstrap.socketClient = conn;
      setTimeout(() => {
        conn.emit('data', `{"status": 0, "value": "hello"}`);
      }, 0);
      (await androidBootstrap.sendCommand(COMMAND_TYPES.ACTION, {action: 'getDataDir'}, 1000))
        .should.equal('hello');
    });
    it('should throw correct error if status is not zero', async function () {
      const conn = new events.EventEmitter();
      conn.write = _.noop;
      conn.setEncoding = _.noop;
      androidBootstrap.socketClient = conn;
      setTimeout(() => {
        conn.emit('data', `{"status": 7, "value": "not found"}`);
      }, 0);
      await androidBootstrap.sendCommand(COMMAND_TYPES.ACTION, {action: 'getDataDir'}, 1000)
        .should.eventually.be.rejectedWith(errors.NoSuchElementError);
    });
  });
  describe('sendAction', withSandbox({mocks: {androidBootstrap}}, (S) => {
    it('should call sendCommand', async function () {
      const extra = {action: 'wake', params: {}};
      S.mocks.androidBootstrap.expects('sendCommand').once()
        .withExactArgs('action', extra)
        .returns('');
      await androidBootstrap.sendAction('wake');
      S.verify();
    });
  }));
  describe('shutdown', withSandbox({mocks: {androidBootstrap, uiAutomator}}, (S) => {
    it('should call sendCommand', async function () {
      const conn = new events.EventEmitter();
      androidBootstrap.socketClient = conn;
      S.mocks.androidBootstrap.expects('sendCommand').once()
        .withExactArgs('shutdown')
        .returns('');
      S.mocks.uiAutomator.expects('shutdown')
        .once()
        .returns('');
      await androidBootstrap.shutdown();
      S.verify();
    });
  }));
});
