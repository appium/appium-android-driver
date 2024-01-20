import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import ADB from 'appium-adb';
import {withMocks} from '@appium/test-support';
import { AndroidDriver } from '../../../lib/driver';

chai.use(chaiAsPromised);

describe('Lock', function () {
  let driver;
  let sandbox = sinon.createSandbox();

  beforeEach(function () {
    const adb = new ADB();
    driver = new AndroidDriver();
    driver.adb = adb;
  });
  afterEach(function () {
    sandbox.restore();
  });

  describe(
    'unlock',
    withMocks({adb, helpers, unlocker}, (mocks) => {
      it('should return if screen is already unlocked', async function () {
        mocks.adb.expects('isScreenLocked').withExactArgs().once().returns(false);
        mocks.adb.expects('getApiLevel').never();
        mocks.adb.expects('startApp').never();
        mocks.adb.expects('isLockManagementSupported').never();
        await helpers.unlock(helpers, adb, {});
        mocks.adb.verify();
      });
      it('should start unlock app', async function () {
        mocks.adb.expects('isScreenLocked').onCall(0).returns(true);
        mocks.adb.expects('dismissKeyguard').once();
        mocks.adb.expects('isLockManagementSupported').never();
        await helpers.unlock(helpers, adb, {});
        mocks.adb.verify();
        mocks.helpers.verify();
      });
      it('should raise an error on undefined unlockKey when unlockType is defined', async function () {
        mocks.adb.expects('isScreenLocked').once().returns(true);
        mocks.adb.expects('isLockManagementSupported').never();
        await helpers.unlock(helpers, adb, {unlockType: 'pin'}).should.be.rejected;
        mocks.adb.verify();
        mocks.unlocker.verify();
        mocks.helpers.verify();
      });
      it('should call pinUnlock if unlockType is pin', async function () {
        mocks.adb.expects('isScreenLocked').onCall(0).returns(true);
        mocks.adb.expects('isScreenLocked').returns(false);
        mocks.adb.expects('isLockManagementSupported').onCall(0).returns(false);
        mocks.unlocker.expects('pinUnlock').once();
        await helpers.unlock(helpers, adb, {unlockType: 'pin', unlockKey: '1111'});
        mocks.adb.verify();
        mocks.helpers.verify();
        mocks.unlocker.verify();
      });
      it('should call pinUnlock if unlockType is pinWithKeyEvent', async function () {
        mocks.adb.expects('isScreenLocked').onCall(0).returns(true);
        mocks.adb.expects('isScreenLocked').returns(false);
        mocks.adb.expects('isLockManagementSupported').onCall(0).returns(false);
        mocks.unlocker.expects('pinUnlockWithKeyEvent').once();
        await helpers.unlock(helpers, adb, {unlockType: 'pinWithKeyEvent', unlockKey: '1111'});
        mocks.adb.verify();
        mocks.helpers.verify();
        mocks.unlocker.verify();
      });
      it('should call fastUnlock if unlockKey is provided', async function () {
        mocks.adb.expects('isScreenLocked').onCall(0).returns(true);
        mocks.adb.expects('isLockManagementSupported').onCall(0).returns(true);
        mocks.helpers.expects('verifyUnlock').once();
        mocks.unlocker.expects('fastUnlock').once();
        await helpers.unlock(helpers, adb, {unlockKey: 'appium', unlockType: 'password'});
        mocks.adb.verify();
        mocks.unlocker.verify();
        mocks.helpers.verify();
      });
      it('should call passwordUnlock if unlockType is password', async function () {
        mocks.adb.expects('isScreenLocked').onCall(0).returns(true);
        mocks.adb.expects('isScreenLocked').returns(false);
        mocks.adb.expects('isLockManagementSupported').onCall(0).returns(false);
        mocks.unlocker.expects('passwordUnlock').once();
        await helpers.unlock(helpers, adb, {unlockType: 'password', unlockKey: 'appium'});
        mocks.adb.verify();
        mocks.helpers.verify();
        mocks.unlocker.verify();
      });
      it('should call patternUnlock if unlockType is pattern', async function () {
        mocks.adb.expects('isScreenLocked').onCall(0).returns(true);
        mocks.adb.expects('isScreenLocked').returns(false);
        mocks.adb.expects('isLockManagementSupported').onCall(0).returns(false);
        mocks.unlocker.expects('patternUnlock').once();
        await helpers.unlock(helpers, adb, {unlockType: 'pattern', unlockKey: '123456789'});
        mocks.adb.verify();
        mocks.helpers.verify();
      });
      it('should call fingerprintUnlock if unlockType is fingerprint', async function () {
        mocks.adb.expects('isScreenLocked').onCall(0).returns(true);
        mocks.adb.expects('isScreenLocked').returns(false);
        mocks.adb.expects('isLockManagementSupported').never();
        mocks.unlocker.expects('fingerprintUnlock').once();
        await helpers.unlock(helpers, adb, {unlockType: 'fingerprint', unlockKey: '1111'});
        mocks.adb.verify();
        mocks.unlocker.verify();
      });
      it('should throw an error is api is lower than 23 and trying to use fingerprintUnlock', async function () {
        mocks.adb.expects('isScreenLocked').onCall(0).returns(true);
        mocks.adb.expects('isScreenLocked').returns(false);
        mocks.adb.expects('isLockManagementSupported').onCall(0).returns(false);
        mocks.adb.expects('getApiLevel').once().returns(21);
        await helpers
          .unlock(helpers, adb, {unlockType: 'fingerprint', unlockKey: '1111'})
          .should.be.rejectedWith('Fingerprint');
        mocks.helpers.verify();
      });
    })
  );
});
