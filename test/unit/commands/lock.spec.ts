import sinon from 'sinon';
import esmock from 'esmock';
import {ADB} from 'appium-adb';
import {AndroidDriver} from '../../../lib/driver.js';
import type {AndroidDriverCaps} from '../../../lib/driver.js';
import {
  validateUnlockCapabilities,
  encodePassword,
  stringKeyToArr,
  UNLOCK_WAIT_TIME,
  KEYCODE_NUMPAD_ENTER,
  getPatternKeyPosition,
  getPatternActions,
} from '../../../lib/commands/lock/helpers.js';
import {unlockWithOptions} from '../../../lib/commands/lock/exports.js';
import {expect, use} from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {describe, it, beforeEach, afterEach} from 'node:test';

use(chaiAsPromised);

const HELPERS_PATH = '../../../lib/commands/lock/helpers.js';
const EXPORTS_PATH = '../../../lib/commands/lock/exports.js';

describe('Lock', function () {
  let driver: AndroidDriver;
  const sandbox = sinon.createSandbox();

  beforeEach(function () {
    const adb = new ADB();
    driver = new AndroidDriver();
    driver.adb = adb;
  });
  afterEach(function () {
    sandbox.verifyAndRestore();
  });

  describe('unlockWithOptions', function () {
    async function mockUnlockWithOptions(helpersOverrides: Record<string, any>) {
      return (await esmock(EXPORTS_PATH, import.meta.url, {[HELPERS_PATH]: helpersOverrides}))
        .unlockWithOptions;
    }

    it('should return if screen is already unlocked', async function () {
      sandbox.stub(driver.adb, 'isScreenLocked').withArgs().onFirstCall().resolves(false);
      sandbox.stub(driver.adb, 'getApiLevel').throws();
      sandbox.stub(driver.adb, 'startApp').throws();
      sandbox.stub(driver.adb, 'isLockManagementSupported').throws();
      await unlockWithOptions.bind(driver)({} as AndroidDriverCaps);
    });
    it('should start unlock app', async function () {
      sandbox.stub(driver.adb, 'isScreenLocked').onFirstCall().resolves(true);
      sandbox.stub(driver.adb, 'dismissKeyguard').onFirstCall();
      sandbox.stub(driver.adb, 'isLockManagementSupported').throws();
      await unlockWithOptions.bind(driver)({} as AndroidDriverCaps);
    });
    it('should raise an error on undefined unlockKey when unlockType is defined', async function () {
      sandbox.stub(driver.adb, 'isScreenLocked').onFirstCall().resolves(true);
      sandbox.stub(driver.adb, 'isLockManagementSupported').throws();
      await expect(unlockWithOptions.bind(driver)({unlockType: 'pin'} as AndroidDriverCaps)).to.be
        .rejected;
    });
    it('should call pinUnlock if unlockType is pin', async function () {
      sandbox.stub(driver.adb, 'isScreenLocked').onFirstCall().resolves(true);
      sandbox.stub(driver.adb, 'dismissKeyguard').onFirstCall();
      sandbox.stub(driver.adb, 'isLockManagementSupported').onCall(0).resolves(false);
      const mockedUnlockWithOptions = await mockUnlockWithOptions({pinUnlock: sandbox.stub()});
      await mockedUnlockWithOptions.bind(driver)({
        unlockType: 'pin',
        unlockKey: '1111',
      } as AndroidDriverCaps);
    });
    it('should call pinUnlock if unlockType is pinWithKeyEvent', async function () {
      sandbox.stub(driver.adb, 'isScreenLocked').onCall(0).resolves(true);
      sandbox.stub(driver.adb, 'dismissKeyguard').onFirstCall();
      sandbox.stub(driver.adb, 'isLockManagementSupported').onCall(0).resolves(false);
      const mockedUnlockWithOptions = await mockUnlockWithOptions({
        pinUnlockWithKeyEvent: sandbox.stub(),
      });
      await mockedUnlockWithOptions.bind(driver)({
        unlockType: 'pinWithKeyEvent',
        unlockKey: '1111',
      } as AndroidDriverCaps);
    });
    it('should call fastUnlock if unlockKey is provided', async function () {
      sandbox.stub(driver.adb, 'isScreenLocked').onCall(0).resolves(true);
      sandbox.stub(driver.adb, 'isLockManagementSupported').onCall(0).resolves(true);
      const mockedUnlockWithOptions = await mockUnlockWithOptions({
        verifyUnlock: sandbox.stub(),
        fastUnlock: sandbox.stub(),
      });
      await mockedUnlockWithOptions.bind(driver)({
        unlockKey: 'appium',
        unlockType: 'password',
      } as AndroidDriverCaps);
    });
    it('should call passwordUnlock if unlockType is password', async function () {
      sandbox.stub(driver.adb, 'isScreenLocked').onCall(0).resolves(true);
      sandbox.stub(driver.adb, 'isLockManagementSupported').onCall(0).resolves(false);
      const mockedUnlockWithOptions = await mockUnlockWithOptions({
        passwordUnlock: sandbox.stub(),
      });
      await mockedUnlockWithOptions.bind(driver)({
        unlockType: 'password',
        unlockKey: 'appium',
      } as AndroidDriverCaps);
    });
    it('should call patternUnlock if unlockType is pattern', async function () {
      sandbox.stub(driver.adb, 'isScreenLocked').onCall(0).resolves(true);
      sandbox.stub(driver.adb, 'isLockManagementSupported').onCall(0).resolves(false);
      const mockedUnlockWithOptions = await mockUnlockWithOptions({
        patternUnlock: sandbox.stub(),
      });
      await mockedUnlockWithOptions.bind(driver)({
        unlockType: 'pattern',
        unlockKey: '123456789',
      } as AndroidDriverCaps);
    });
    it('should call fingerprintUnlock if unlockType is fingerprint', async function () {
      sandbox.stub(driver.adb, 'isScreenLocked').onCall(0).resolves(true);
      sandbox.stub(driver.adb, 'isLockManagementSupported').throws();
      const mockedUnlockWithOptions = await mockUnlockWithOptions({
        fingerprintUnlock: sandbox.stub(),
      });
      await mockedUnlockWithOptions.bind(driver)({
        unlockType: 'fingerprint',
        unlockKey: '1111',
      } as AndroidDriverCaps);
    });
  });
  describe('validateUnlockCapabilities', function () {
    function toCaps(unlockType: string, unlockKey: string | undefined) {
      return {
        unlockType,
        unlockKey,
      };
    }

    it('should verify the unlock keys for pin/pinWithKeyEvent', function () {
      for (const invalidValue of [undefined, ' ', '1abc']) {
        expect(() => validateUnlockCapabilities(toCaps('pin', invalidValue) as any)).to.throw;
        expect(() => validateUnlockCapabilities(toCaps('pinWithKeyEvent', invalidValue) as any)).to
          .throw;
      }
      validateUnlockCapabilities(toCaps('pin', '1111') as any);
      validateUnlockCapabilities(toCaps('pinWithKeyEvent', '1111') as any);
    });
    it('should verify the unlock keys for fingerprint', function () {
      for (const invalidValue of [undefined, ' ', '1abc']) {
        expect(() => validateUnlockCapabilities(toCaps('fingerprint', invalidValue) as any)).to
          .throw;
      }
      validateUnlockCapabilities(toCaps('fingerprint', '1') as any);
    });
    it('should verify the unlock keys for pattern', function () {
      for (const invalidValue of [undefined, '1abc', '', '1', '1213', '01234', ' ']) {
        expect(() => validateUnlockCapabilities(toCaps('pattern', invalidValue) as any)).to.throw;
      }
      for (const validValue of ['1234', '123456789']) {
        validateUnlockCapabilities(toCaps('pattern', validValue) as any);
      }
    });
    it('should verify the unlock keys for password', function () {
      for (const invalidValue of [undefined, '123', '   ']) {
        expect(() => validateUnlockCapabilities(toCaps('password', invalidValue) as any)).to.throw;
      }
      for (const validValue of [
        '121c3',
        'appium',
        'appium-android-driver',
        '@#$%&-+()*"\':;!?,_ ./~`|={}\\[]',
      ]) {
        validateUnlockCapabilities(toCaps('password', validValue) as any);
      }
    });
    it('should throw error if unlock type is invalid', function () {
      expect(() => validateUnlockCapabilities(toCaps('invalid_unlock_type', '1') as any)).to.throw;
    });
  });
  describe('encodePassword', function () {
    it('should verify the password with blank space is encoded', function () {
      expect(encodePassword('a p p i u m')).to.equal('a%sp%sp%si%su%sm');
      expect(encodePassword('   ')).to.equal('%s%s%s');
    });
  });
  describe('stringKeyToArr', function () {
    it('should cast string keys to array', function () {
      expect(stringKeyToArr('1234')).to.eql(['1', '2', '3', '4']);
      expect(stringKeyToArr(' 1234 ')).to.eql(['1', '2', '3', '4']);
      expect(stringKeyToArr('1 2 3 4')).to.eql(['1', '2', '3', '4']);
      expect(stringKeyToArr('1  2  3  4')).to.eql(['1', '2', '3', '4']);
    });
  });
  describe('fingerprintUnlock', function () {
    it('should be able to unlock device via fingerprint if API level >= 23', async function () {
      const caps = {unlockKey: '123'} as AndroidDriverCaps;
      sandbox.stub(driver.adb, 'getApiLevel').resolves(23);
      sandbox.stub(driver.adb, 'fingerprint').withArgs(caps.unlockKey).onFirstCall();
      const sleepStub = sandbox.stub();
      const {fingerprintUnlock} = await esmock(HELPERS_PATH, import.meta.url, {
        asyncbox: {sleep: sleepStub},
      });
      await expect(fingerprintUnlock.bind(driver)(caps)).to.be.fulfilled;
      expect(sleepStub.calledWith(UNLOCK_WAIT_TIME)).to.be.true;
    });
  });
  describe('pinUnlock', function () {
    const caps = {unlockKey: '13579'} as AndroidDriverCaps;
    const els = [
      {ELEMENT: 1},
      {ELEMENT: 2},
      {ELEMENT: 3},
      {ELEMENT: 4},
      {ELEMENT: 5},
      {ELEMENT: 6},
      {ELEMENT: 7},
      {ELEMENT: 8},
      {ELEMENT: 9},
    ];
    afterEach(function () {
      sandbox.verifyAndRestore();
    });
    it('should be able to unlock device using pin (API level >= 21)', async function () {
      sandbox.stub(driver.adb, 'dismissKeyguard').onFirstCall();
      sandbox.stub(driver.adb, 'getApiLevel').resolves(21);
      sandbox
        .stub(driver, 'findElOrEls')
        .withArgs('id', 'com.android.systemui:id/digit_text', true as any)
        .resolves(els as any);
      sandbox.stub(driver.adb, 'isScreenLocked').resolves(true);
      sandbox.stub(driver.adb, 'keyevent').withArgs(66).onFirstCall();
      const getAttributeStub = sandbox.stub(driver, 'getAttribute');
      for (const e of els) {
        getAttributeStub.withArgs('text', e.ELEMENT as any).resolves(e.ELEMENT.toString());
      }
      const clickStub = sandbox.stub(driver, 'click');
      const sleepStub = sandbox.stub();
      const {pinUnlock} = await esmock(HELPERS_PATH, import.meta.url, {
        asyncbox: {sleep: sleepStub},
      });

      await pinUnlock.bind(driver)(caps);

      expect(clickStub.getCall(0).args[0]).to.equal(1);
      expect(clickStub.getCall(1).args[0]).to.equal(3);
      expect(clickStub.getCall(2).args[0]).to.equal(5);
      expect(clickStub.getCall(3).args[0]).to.equal(7);
      expect(clickStub.getCall(4).args[0]).to.equal(9);
      expect(sleepStub.calledWith(UNLOCK_WAIT_TIME)).to.be.true;
    });
  });
  describe('passwordUnlock', function () {
    it('should be able to unlock device using password', async function () {
      const caps = {unlockKey: 'psswrd'} as any;
      sandbox.stub(driver.adb, 'dismissKeyguard').onFirstCall();
      sandbox
        .stub(driver.adb, 'shell')
        .withArgs(['input', 'text', caps.unlockKey])
        .withArgs(['input', 'keyevent', String(KEYCODE_NUMPAD_ENTER)]);
      sandbox.stub(driver.adb, 'isScreenLocked').resolves(true);
      sandbox.stub(driver.adb, 'keyevent').withArgs(66).onFirstCall();
      const sleepStub = sandbox.stub();
      const {passwordUnlock} = await esmock(HELPERS_PATH, import.meta.url, {
        asyncbox: {sleep: sleepStub},
      });
      await passwordUnlock.bind(driver)(caps);
      expect(sleepStub.calledWith(UNLOCK_WAIT_TIME)).to.be.true;
    });
  });
  describe('getPatternKeyPosition', function () {
    it('should verify pattern pin is aproximatelly to its position', function () {
      const pins = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function mapPins(pin) {
        return getPatternKeyPosition(pin, {x: 33, y: 323}, 137.6);
      });
      const cols = [101, 238, 375];
      const rows = [391, 528, 665];
      expect(pins[0].x).to.be.within(cols[0] - 5, cols[0] + 5);
      expect(pins[1].x).to.be.within(cols[1] - 5, cols[1] + 5);
      expect(pins[2].x).to.be.within(cols[2] - 5, cols[2] + 5);
      expect(pins[3].x).to.be.within(cols[0] - 5, cols[0] + 5);
      expect(pins[4].x).to.be.within(cols[1] - 5, cols[1] + 5);
      expect(pins[5].x).to.be.within(cols[2] - 5, cols[2] + 5);
      expect(pins[6].x).to.be.within(cols[0] - 5, cols[0] + 5);
      expect(pins[7].x).to.be.within(cols[1] - 5, cols[1] + 5);
      expect(pins[8].x).to.be.within(cols[2] - 5, cols[2] + 5);
      expect(pins[0].y).to.be.within(rows[0] - 5, rows[0] + 5);
      expect(pins[1].y).to.be.within(rows[0] - 5, rows[0] + 5);
      expect(pins[2].y).to.be.within(rows[0] - 5, rows[0] + 5);
      expect(pins[3].y).to.be.within(rows[1] - 5, rows[1] + 5);
      expect(pins[4].y).to.be.within(rows[1] - 5, rows[1] + 5);
      expect(pins[5].y).to.be.within(rows[1] - 5, rows[1] + 5);
      expect(pins[6].y).to.be.within(rows[2] - 5, rows[2] + 5);
      expect(pins[7].y).to.be.within(rows[2] - 5, rows[2] + 5);
      expect(pins[8].y).to.be.within(rows[2] - 5, rows[2] + 5);
    });
  });
  describe('getPatternActions', function () {
    it('should generate press, moveTo, relase gesture scheme to unlock by pattern', function () {
      const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
      const actions = getPatternActions(keys, {x: 0, y: 0}, 1);
      expect(actions).to.eql([
        {
          type: 'pointer',
          id: 'patternUnlock',
          parameters: {
            pointerType: 'touch',
          },
          actions: [
            {type: 'pointerMove', duration: 1000, x: 1, y: 1},
            {type: 'pointerDown', button: 0},
            {type: 'pointerMove', duration: 1000, x: 2, y: 1},
            {type: 'pointerMove', duration: 1000, x: 3, y: 1},
            {type: 'pointerMove', duration: 1000, x: 1, y: 2},
            {type: 'pointerMove', duration: 1000, x: 2, y: 2},
            {type: 'pointerMove', duration: 1000, x: 3, y: 2},
            {type: 'pointerMove', duration: 1000, x: 1, y: 3},
            {type: 'pointerMove', duration: 1000, x: 2, y: 3},
            {type: 'pointerMove', duration: 1000, x: 3, y: 3},
            {type: 'pointerUp', button: 0},
          ],
        },
      ]);
    });
    it('should verify pattern gestures moves to non consecutives pins', function () {
      const keys = ['7', '2', '9', '8', '5', '6', '1', '4', '3'];
      const actions = getPatternActions(keys, {x: 0, y: 0}, 1);
      expect(actions).to.eql([
        {
          type: 'pointer',
          id: 'patternUnlock',
          parameters: {
            pointerType: 'touch',
          },
          actions: [
            {type: 'pointerMove', duration: 1000, x: 1, y: 3},
            {type: 'pointerDown', button: 0},
            {type: 'pointerMove', duration: 1000, x: 2, y: 1},
            {type: 'pointerMove', duration: 1000, x: 3, y: 3},
            {type: 'pointerMove', duration: 1000, x: 2, y: 3},
            {type: 'pointerMove', duration: 1000, x: 2, y: 2},
            {type: 'pointerMove', duration: 1000, x: 3, y: 2},
            {type: 'pointerMove', duration: 1000, x: 1, y: 1},
            {type: 'pointerMove', duration: 1000, x: 1, y: 2},
            {type: 'pointerMove', duration: 1000, x: 3, y: 1},
            {type: 'pointerUp', button: 0},
          ],
        },
      ]);
    });
  });
  describe('patternUnlock', function () {
    const el = {ELEMENT: 1};
    const pos = {x: 10, y: 20};
    const size = {width: 300, height: 400};
    const caps = {unlockKey: '13579'} as AndroidDriverCaps;
    beforeEach(function () {
      sandbox.stub(driver.adb, 'dismissKeyguard').onFirstCall();
      sandbox
        .stub(driver, 'getLocation')
        .withArgs(el.ELEMENT as any)
        .resolves(pos);
      sandbox
        .stub(driver, 'getSize')
        .withArgs(el.ELEMENT as any)
        .resolves(size);
      sandbox.stub(driver, 'performActions').resolves();
    });
    it('should be able to unlock device using pattern (API level >= 21)', async function () {
      sandbox.stub(driver.adb, 'getApiLevel').resolves(21);
      sandbox
        .stub(driver, 'findElOrEls')
        .withArgs('id', 'com.android.systemui:id/lockPatternView', false)
        .resolves(el as any);
      const sleepStub = sandbox.stub();
      const {patternUnlock} = await esmock(HELPERS_PATH, import.meta.url, {
        asyncbox: {sleep: sleepStub},
      });
      await patternUnlock.bind(driver)(caps);
      expect(sleepStub.calledWith(UNLOCK_WAIT_TIME)).to.be.true;
    });
    it('should be able to unlock device using pattern (API level < 21)', async function () {
      sandbox.stub(driver.adb, 'getApiLevel').resolves(20);
      sandbox
        .stub(driver, 'findElOrEls')
        .withArgs('id', 'com.android.keyguard:id/lockPatternView', false)
        .resolves(el as any);
      const sleepStub = sandbox.stub();
      const {patternUnlock} = await esmock(HELPERS_PATH, import.meta.url, {
        asyncbox: {sleep: sleepStub},
      });
      await patternUnlock.bind(driver)(caps);
      expect(sleepStub.calledWith(UNLOCK_WAIT_TIME)).to.be.true;
    });
  });
});
