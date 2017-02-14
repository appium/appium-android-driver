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

const AVD = "ANDROID_API_19";

/*
------------------------------------------------------------------------------
TODO - In order to run the unlock2 e2e tests we need to create specific
emulators avds each one of them setted with the current unlock type to test
------------------------------------------------------------------------------
*/
describe('unlock tests', function () {
  let driver;
  before(() => {
    driver = new AndroidDriver();
  });
  afterEach(async () => {
    await driver.deleteSession();
  });
  /*
  it('should unlock the device using a PIN', async () => {
    let caps = _.extend(defaultCaps, {unlockType: "pin", unlockKey: "1111", avd: AVD});
    await driver.createSession(caps);
    let isLock = await driver.adb.isScreenLocked();
    isLock.should.equal(false);
  });


  it('should unlock the device using a PASSWORD', async () => {
    let caps = _.extend(defaultCaps, {unlockType: "password", unlockKey: "appium", avd: AVD});
    await driver.createSession(caps);
    let isLock = await driver.adb.isScreenLocked();
    isLock.should.equal(false);
  });
  */
  it('should unlock the device using a PATTERN', async () => {
    let caps = _.extend(defaultCaps, {unlockType: "pattern", unlockKey: "729856143", avd: AVD});
    await driver.createSession(caps);
    let isLock = await driver.adb.isScreenLocked();
    isLock.should.equal(false);
  });
  // */
});
