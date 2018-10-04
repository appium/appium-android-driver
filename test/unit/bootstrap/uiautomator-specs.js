// transpile :mocha

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import { UiAutomator } from '../../../lib/uiautomator';
import path from 'path';
import ADB from 'appium-adb';
import { withSandbox } from 'appium-test-support';
import * as teen_process from 'teen_process';
import events from 'events';
import _ from 'lodash';


chai.should();
chai.use(chaiAsPromised);

describe('UiAutomator', function () {
  const adb = new ADB();
  const rootDir = path.resolve(__dirname,
                             process.env.NO_PRECOMPILE ? '../..' : '../../..');
  const bootstrapJar = path.resolve(rootDir, 'test', 'fixtures', 'AppiumBootstrap.jar'),
        bootstrapClassName = 'io.appium.android.bootstrap.Bootstrap';

  let uiAutomator;
  before(function () {
    uiAutomator = new UiAutomator(adb);
  });

  it('should throw an error if adb is not passed', function () {
    (() => { new UiAutomator(); }).should.throw(/adb is required/);
  });
  it('parseJarNameFromPath should parse jarName from path and windows path', function () {
    uiAutomator.parseJarNameFromPath(bootstrapJar).should.equal('AppiumBootstrap.jar');
    let windowsJarName = `C:\\\\appium\\bar.jar`;
    uiAutomator.parseJarNameFromPath(windowsJarName).should.equal('bar.jar');
  });
  it('parseJarNameFromPath should throw error for invalid path', function () {
    (() => { uiAutomator.parseJarNameFromPath('foo/bar'); }).should.throw(/Unable to parse/);
  });
  describe('start', withSandbox({mocks: {adb}}, (S) => {
    it('should return a subProcess', async function () {
      let conn = new events.EventEmitter();
      conn.start = _.noop;
      const args = [
        'shell', 'uiautomator', 'runtest', 'AppiumBootstrap.jar', '-c', bootstrapClassName
      ];
      S.mocks.adb.expects('push').once()
        .withExactArgs(bootstrapJar, '/data/local/tmp/')
        .returns('');
      S.mocks.adb.expects('createSubProcess')
        .once().withExactArgs(args)
        .returns(conn);

      await uiAutomator.start(bootstrapJar, bootstrapClassName);
      uiAutomator.state.should.equal('online');
      S.verify();
    });
  }));
  describe('shutdown', withSandbox({mocks: {adb, teen_process}}, (S) => {
    it('should not fail if it is already stopped', async function () {
      let conn = new events.EventEmitter();
      conn.start = _.noop;
      conn.stop = _.noop;
      const mock = sinon.mock(conn);
      // It should NOT stop the process when shutting down, because it is already stopped
      mock.expects('stop').atMost(0);
      uiAutomator.proc = conn;

      // simulate uiAutomator unexpectedly terminates
      uiAutomator.changeState('stopped');
      await uiAutomator.shutdown();
      uiAutomator.state.should.equal('stopped');
      S.verify();
    });
    it('should stop the uiautomator process', async function () {
      let conn = new events.EventEmitter();
      conn.start = _.noop;
      conn.stop = _.noop;
      const mock = sinon.mock(conn);
      // It should stop the process when shutting down
      mock.expects('stop').once();
      uiAutomator.proc = conn;
      uiAutomator.changeState('online');
      await uiAutomator.shutdown();
      uiAutomator.state.should.equal('stopped');
      S.verify();
    });
  }));
});
