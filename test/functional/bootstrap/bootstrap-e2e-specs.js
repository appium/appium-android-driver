// transpile :mocha

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import path from 'path';
import { AndroidBootstrap, COMMAND_TYPES } from '../../../lib/bootstrap';
import ADB from 'appium-adb';
import { errors } from 'appium-base-driver';


chai.should();
chai.use(chaiAsPromised);

const MOCHA_TIMEOUT = process.env.TRAVIS ? 240000 : 60000;

const dirOffset = process.env.NO_PRECOMPILE ? [] : ['..'];
const rootDir = path.resolve(__dirname, '..', '..', '..', ...dirOffset);

const apiDemos = path.resolve(rootDir, 'test', 'assets', 'ApiDemos-debug.apk');
const systemPort = 4724;

describe('Android Bootstrap', function () {
  this.timeout(MOCHA_TIMEOUT);

  let adb, androidBootstrap;

  before(async function () {
    adb = await ADB.createADB();
    const packageName = 'io.appium.android.apis',
          activityName = '.ApiDemos';
    await adb.uninstallApk('io.appium.android.apis');
    await adb.install(apiDemos);
    await adb.startApp({pkg: packageName,
                        activity: activityName});
    androidBootstrap = new AndroidBootstrap(adb, systemPort);
    await androidBootstrap.start('io.appium.android.apis', false);
  });
  after(async function () {
    await androidBootstrap.shutdown();
  });
  it('sendAction should work', async function () {
    (await androidBootstrap.sendAction('wake')).should.equal(true);
  });
  it('sendCommand should work', async function () {
    (await androidBootstrap.sendCommand(COMMAND_TYPES.ACTION, {action: 'getDataDir'})).should
     .equal('/data');
  });
  it('sendCommand should correctly throw error', async function () {
    await androidBootstrap.sendCommand(COMMAND_TYPES.ACTION, {action: 'unknown'}).should
     .eventually.be.rejectedWith(errors.UnknownCommandError);
  });
  it('should cancel onUnexpectedShutdown promise on unexpected uiAutomator shutdown', async function () {
    await androidBootstrap.sendCommand(COMMAND_TYPES.SHUTDOWN);
    await androidBootstrap.onUnexpectedShutdown.should.eventually
      .be.rejectedWith('UiAUtomator shut down unexpectedly');
  });
});
