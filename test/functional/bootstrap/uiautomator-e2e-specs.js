// transpile :mocha

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { UiAutomator } from '../../../lib/uiautomator';
import path from 'path';
import ADB from 'appium-adb';


chai.should();
chai.use(chaiAsPromised);

const dirOffset = process.env.NO_PRECOMPILE ? [] : ['..'];
const rootDir = path.resolve(__dirname, '..', '..', '..', ...dirOffset);

const bootstrapJar = path.resolve(rootDir, 'test', 'assets', 'AppiumBootstrap.jar');

describe('UiAutomator', function () {
  let uiAutomator, adb;

  beforeEach(async function () {
    adb = await ADB.createADB();
    uiAutomator = new UiAutomator(adb);
  });

  it('should start and shutdown uiAutomator', async function () {
    const startDetector = (s) => /Appium Socket Server Ready/.test(s);
    await uiAutomator.start(bootstrapJar, 'io.appium.android.bootstrap.Bootstrap',
                            startDetector, '-e', 'disableAndroidWatchers', true);
    uiAutomator.state.should.eql('online');
    await uiAutomator.shutdown();
    uiAutomator.state.should.eql('stopped');
  });
});
