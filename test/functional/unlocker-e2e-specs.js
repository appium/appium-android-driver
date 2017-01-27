import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import _ from 'lodash';
import AndroidDriver from '../..';
import DEFAULT_CAPS from './desired';

chai.should();
chai.use(chaiAsPromised);
let expect = chai.expect;

let defaultCaps = _.defaults({
  androidInstallTimeout: 90000
}, DEFAULT_CAPS);

const PIN_UNLOCK_AVD = "Nexus_S_API_19_PIN";
const PASSWORD_UNLOCK_AVD = "Nexus_S_API_19_PASSWORD";
const PATTERN_UNLOCK_AVD = "Nexus_S_API_19_PATTERN";

/*
------------------------------------------------------------------------------
TODO - In order to run the unlock2 e2e tests we need to create specific
emulators avds each one of them setted with the current unlock type to test
------------------------------------------------------------------------------
*/
describe('createSession', function () {
  let driver;
  before(() => {
    driver = new AndroidDriver();
  });
  afterEach(async () => {
    await driver.deleteSession();
  });
  it('should unlock the device using a PIN', async () => {
    let caps = _.extend(defaultCaps, {unlockType: "pin", unlockKey: "0123456789", avd: PIN_UNLOCK_AVD});
    await driver.createSession(caps);
    let isLock = await driver.adb.isScreenLocked();
    expect(isLock).to.equal(false);
  });
  it('should unlock the device using a PASSWORD', async () => {
    let caps = _.extend(defaultCaps, {unlockType: "pin", unlockKey: "0123456789", avd: PASSWORD_UNLOCK_AVD});
    await driver.createSession(caps);
    let isLock = await driver.adb.isScreenLocked();
    expect(isLock).to.equal(false);
  });
  it('should unlock the device using a PATTERN', async () => {
    let caps = _.extend(defaultCaps, {unlockType: "pattern", unlockKey: "159874236", avd: PATTERN_UNLOCK_AVD});
    await driver.createSession(caps);
    let isLock = await driver.adb.isScreenLocked();
    expect(isLock).to.equal(false);
  });
});
