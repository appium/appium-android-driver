import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import _ from 'lodash';
import AndroidDriver from '../..';
import DEFAULT_CAPS from './desired';

chai.should();
chai.use(chaiAsPromised);

let defaultCaps = _.defaults({
  androidInstallTimeout: 90000
}, DEFAULT_CAPS);

const AVD_ANDROID_19_PIN_UNLOCK = "ANDROID_API_19_PIN_UNLOCK";
const AVD_ANDROID_23_PIN_UNLOCK = "ANDROID_API_23_PIN_UNLOCK";
const AVD_ANDROID_19_PASSWORD_UNLOCK = "ANDROID_API_19_PASSWORD_UNLOCK";
const AVD_ANDROID_23_PASSWORD_UNLOCK = "ANDROID_API_23_PASSWORD_UNLOCK";
const AVD_ANDROID_19_PATTERN_UNLOCK = "ANDROID_API_19_PATTERN_UNLOCK";
const AVD_ANDROID_23_PATTERN_UNLOCK = "ANDROID_API_23_PATTERN_UNLOCK";
const AVD_ANDROID_23_FINGERPRINT_UNLOCK = "ANDROID_API_23_FINGERPRINT_UNLOCK";

describe('unlock tests', () => {
  let driver;
  
  describe.skip('functional', () => {
    before(() => {
      driver = new AndroidDriver();
    });
    afterEach(async () => {
      await driver.deleteSession();
    });
    it('should unlock an Android 19 device using a PIN', async () => {
      let caps = _.extend(defaultCaps, {unlockType: "pin", unlockKey: "1111", avd: AVD_ANDROID_19_PIN_UNLOCK});
      await driver.createSession(caps);
      let isLock = await driver.adb.isScreenLocked();
      isLock.should.equal(false);
    });
    it('should unlock an Android 23 device using a PIN', async () => {
      let caps = _.extend(defaultCaps, {unlockType: "pin", unlockKey: "1111", avd: AVD_ANDROID_23_PIN_UNLOCK});
      await driver.createSession(caps);
      let isLock = await driver.adb.isScreenLocked();
      isLock.should.equal(false);
    });
    it('should unlock an Android 19 device using a PASSWORD', async () => {
      let caps = _.extend(defaultCaps, {unlockType: "password", unlockKey: "appium", avd: AVD_ANDROID_19_PASSWORD_UNLOCK});
      await driver.createSession(caps);
      let isLock = await driver.adb.isScreenLocked();
      isLock.should.equal(false);
    });
    it('should unlock an Android 23 device using a PASSWORD', async () => {
      let caps = _.extend(defaultCaps, {unlockType: "password", unlockKey: "appium", avd: AVD_ANDROID_23_PASSWORD_UNLOCK});
      await driver.createSession(caps);
      let isLock = await driver.adb.isScreenLocked();
      isLock.should.equal(false);
    });
    it('should unlock an Android 19 device using a PATTERN', async () => {
      let caps = _.extend(defaultCaps, {unlockType: "pattern", unlockKey: "729856143", avd: AVD_ANDROID_19_PATTERN_UNLOCK});
      await driver.createSession(caps);
      let isLock = await driver.adb.isScreenLocked();
      isLock.should.equal(false);
    });
    it('should unlock an Android 23 device using a PATTERN', async () => {
      let caps = _.extend(defaultCaps, {unlockType: "pattern", unlockKey: "729856143", avd: AVD_ANDROID_23_PATTERN_UNLOCK});
      await driver.createSession(caps);
      let isLock = await driver.adb.isScreenLocked();
      isLock.should.equal(false);
    });
    it('should unlock an Android 23 device using FINGERPRINT', async () => {
      let caps = _.extend(defaultCaps, {unlockType: "pattern", unlockKey: "729856143", avd: AVD_ANDROID_23_FINGERPRINT_UNLOCK});
      await driver.createSession(caps);
      let isLock = await driver.adb.isScreenLocked();
      isLock.should.equal(false);
    });
  });
});
