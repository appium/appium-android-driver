import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import 'mochawait';
//import * as helpers from '../../lib/android-helpers';
//import ADB from 'appium-adb';
//import { withMocks } from 'appium-test-support';
import { AndroidDriver } from '../../..';
import sampleApps from 'sample-apps';
import ADB from 'appium-adb';

let apiDemos = sampleApps('ApiDemos-debug');

/*const should = */chai.should();
chai.use(chaiAsPromised);

describe('driver e2e', () => {

  describe('initDevice', () => {
    it.skip('starts up an emulator if no devices running', async () => {
      let driver = new AndroidDriver();
      driver.caps = {
        app: apiDemos
      };

      await driver.initDevice();

      await driver.adb.isAppInstalled('io.appium.settings').should.eventually.be.true;
      await driver.adb.isAppInstalled('io.appium.unlock').should.eventually.be.true;
      // TODO check to see that unlock and settings apps were installed
    });

    it.skip('automatically connects to an emulator if one is running', async () => {
      let driver = new AndroidDriver();
      driver.adb = await ADB.createADB();
      driver.caps = {
        app: apiDemos
      };

      await driver.initDevice();

      await driver.adb.isAppInstalled('io.appium.settings').should.eventually.be.true;
      await driver.adb.isAppInstalled('io.appium.unlock').should.eventually.be.true;
    });

    it.skip('automatically connects to a real device if one is connected', () => {

    });

    it.skip('it connects to the specified udid if one is provided', () => {

    });

    it.skip('errors if a udid is provided but the device does not exist', () => {

    });

    it.skip('errors if a udid is provided but the device is already in use', () => {

    });

  });

  describe('startAndroidSession', () => {
    it('starts a session', async function () {
      this.timeout(20000);

      let driver = new AndroidDriver();
      let caps = {
        app: apiDemos
      };
      driver.caps = caps;
      driver.opts = caps;

      await driver.startAndroidSession(caps);

      let val = await driver.bootstrap.sendCommand('action', {action: 'source'});
      val.length.should.be.above(500);

      // TODO
    });

    it.skip('throws an error if no devices ever connected', async () => {

    });
  });

});
