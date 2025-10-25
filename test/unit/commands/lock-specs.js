import sinon from 'sinon';
import {ADB} from 'appium-adb';
import { AndroidDriver } from '../../../lib/driver';
import {
  validateUnlockCapabilities,
  encodePassword,
  stringKeyToArr,
  UNLOCK_WAIT_TIME,
  fingerprintUnlock,
  passwordUnlock,
  pinUnlock,
  KEYCODE_NUMPAD_ENTER,
  getPatternKeyPosition,
  getPatternActions,
  patternUnlock,
} from '../../../lib/commands/lock/helpers';
import {unlockWithOptions} from '../../../lib/commands/lock/exports';
import * as unlockHelpers from '../../../lib/commands/lock/helpers';
import * as asyncboxHelpers from 'asyncbox';

describe('Lock', function () {
  /** @type {AndroidDriver} */
  let driver;
  let sandbox = sinon.createSandbox();
  let chai;

  before(async function () {
    chai = await import('chai');
    const chaiAsPromised = await import('chai-as-promised');

    chai.should();
    chai.use(chaiAsPromised.default);
  });

  beforeEach(function () {
    const adb = new ADB();
    driver = new AndroidDriver();
    driver.adb = adb;
  });
  afterEach(function () {
    sandbox.verifyAndRestore();
  });

  describe('unlockWithOptions', function () {
    it('should return if screen is already unlocked', async function () {
      sandbox.stub(driver.adb, 'isScreenLocked').withArgs().onFirstCall().returns(false);
      sandbox.stub(driver.adb, 'getApiLevel').throws();
      sandbox.stub(driver.adb, 'startApp').throws();
      sandbox.stub(driver.adb, 'isLockManagementSupported').throws();
      await unlockWithOptions.bind(driver)({});
    });
    it('should start unlock app', async function () {
      sandbox.stub(driver.adb, 'isScreenLocked').onFirstCall().returns(true);
      sandbox.stub(driver.adb, 'dismissKeyguard').onFirstCall();
      sandbox.stub(driver.adb, 'isLockManagementSupported').throws();
      await unlockWithOptions.bind(driver)({});
    });
    it('should raise an error on undefined unlockKey when unlockType is defined', async function () {
      sandbox.stub(driver.adb, 'isScreenLocked').onFirstCall().returns(true);
      sandbox.stub(driver.adb, 'isLockManagementSupported').throws();
      await unlockWithOptions.bind(driver)({unlockType: 'pin'}).should.be.rejected;
    });
    it('should call pinUnlock if unlockType is pin', async function () {
      sandbox.stub(driver.adb, 'isScreenLocked').onFirstCall().returns(true);
      sandbox.stub(driver.adb, 'dismissKeyguard').onFirstCall();
      sandbox.stub(driver.adb, 'isLockManagementSupported').onCall(0).returns(false);
      sandbox.stub(unlockHelpers, 'pinUnlock');
      await unlockWithOptions.bind(driver)({unlockType: 'pin', unlockKey: '1111'});
    });
    it('should call pinUnlock if unlockType is pinWithKeyEvent', async function () {
      sandbox.stub(driver.adb, 'isScreenLocked').onCall(0).returns(true);
      sandbox.stub(driver.adb, 'dismissKeyguard').onFirstCall();
      sandbox.stub(driver.adb, 'isLockManagementSupported').onCall(0).returns(false);
      sandbox.stub(unlockHelpers, 'pinUnlockWithKeyEvent').onFirstCall();
      await unlockWithOptions.bind(driver)({unlockType: 'pinWithKeyEvent', unlockKey: '1111'});
    });
    it('should call fastUnlock if unlockKey is provided', async function () {
      sandbox.stub(driver.adb, 'isScreenLocked').onCall(0).returns(true);
      sandbox.stub(driver.adb, 'isLockManagementSupported').onCall(0).returns(true);
      sandbox.stub(unlockHelpers, 'verifyUnlock').onFirstCall();
      sandbox.stub(unlockHelpers, 'fastUnlock').onFirstCall();
      await unlockWithOptions.bind(driver)({unlockKey: 'appium', unlockType: 'password'});
    });
    it('should call passwordUnlock if unlockType is password', async function () {
      sandbox.stub(driver.adb, 'isScreenLocked').onCall(0).returns(true);
      sandbox.stub(driver.adb, 'isLockManagementSupported').onCall(0).returns(false);
      sandbox.stub(unlockHelpers, 'passwordUnlock').onFirstCall();
      await unlockWithOptions.bind(driver)({unlockType: 'password', unlockKey: 'appium'});
    });
    it('should call patternUnlock if unlockType is pattern', async function () {
      sandbox.stub(driver.adb, 'isScreenLocked').onCall(0).returns(true);
      sandbox.stub(driver.adb, 'isLockManagementSupported').onCall(0).returns(false);
      sandbox.stub(unlockHelpers, 'patternUnlock').onFirstCall();
      await unlockWithOptions.bind(driver)({unlockType: 'pattern', unlockKey: '123456789'});
    });
    it('should call fingerprintUnlock if unlockType is fingerprint', async function () {
      sandbox.stub(driver.adb, 'isScreenLocked').onCall(0).returns(true);
      sandbox.stub(driver.adb, 'isLockManagementSupported').throws();
      sandbox.stub(unlockHelpers, 'fingerprintUnlock').onFirstCall();
      await unlockWithOptions.bind(driver)({unlockType: 'fingerprint', unlockKey: '1111'});
    });
  });
  describe('validateUnlockCapabilities', function () {
    function toCaps(unlockType, unlockKey) {
      return {
        unlockType,
        unlockKey,
      };
    }

    it('should verify the unlock keys for pin/pinWithKeyEvent', function () {
      for (const invalidValue of [undefined, ' ', '1abc']) {
        chai.expect(() => validateUnlockCapabilities(toCaps('pin', invalidValue))).to.throw;
        chai.expect(() => validateUnlockCapabilities(toCaps('pinWithKeyEvent', invalidValue))).to
          .throw;
      }
      validateUnlockCapabilities(toCaps('pin', '1111'));
      validateUnlockCapabilities(toCaps('pinWithKeyEvent', '1111'));
    });
    it('should verify the unlock keys for fingerprint', function () {
      for (const invalidValue of [undefined, ' ', '1abc']) {
        chai.expect(() => validateUnlockCapabilities(toCaps('fingerprint', invalidValue))).to
          .throw;
      }
      validateUnlockCapabilities(toCaps('fingerprint', '1'));
    });
    it('should verify the unlock keys for pattern', function () {
      for (const invalidValue of [undefined, '1abc', '', '1', '1213', '01234', ' ']) {
        chai.expect(() => validateUnlockCapabilities(toCaps('pattern', invalidValue))).to.throw;
      }
      for (const validValue of ['1234', '123456789']) {
        validateUnlockCapabilities(toCaps('pattern', validValue));
      }
    });
    it('should verify the unlock keys for password', function () {
      for (const invalidValue of [undefined, '123', '   ']) {
        chai.expect(() => validateUnlockCapabilities(toCaps('password', invalidValue))).to.throw;
      }
      for (const validValue of [
        '121c3',
        'appium',
        'appium-android-driver',
        '@#$%&-+()*"\':;!?,_ ./~`|={}\\[]',
      ]) {
        validateUnlockCapabilities(toCaps('password', validValue));
      }
    });
    it('should throw error if unlock type is invalid', function () {
      chai.expect(() => validateUnlockCapabilities(toCaps('invalid_unlock_type', '1'))).to.throw;
    });
  });
  describe('encodePassword', function () {
    it('should verify the password with blank space is encoded', function () {
      encodePassword('a p p i u m').should.equal('a%sp%sp%si%su%sm');
      encodePassword('   ').should.equal('%s%s%s');
    });
  });
  describe('stringKeyToArr', function () {
    it('should cast string keys to array', function () {
      stringKeyToArr('1234').should.eql(['1', '2', '3', '4']);
      stringKeyToArr(' 1234 ').should.eql(['1', '2', '3', '4']);
      stringKeyToArr('1 2 3 4').should.eql(['1', '2', '3', '4']);
      stringKeyToArr('1  2  3  4').should.eql(['1', '2', '3', '4']);
    });
  });
  describe('fingerprintUnlock', function () {
    it('should be able to unlock device via fingerprint if API level >= 23', async function () {
      let caps = {unlockKey: '123'};
      sandbox.stub(driver.adb, 'getApiLevel').returns(23);
      sandbox.stub(driver.adb, 'fingerprint').withArgs(caps.unlockKey).onFirstCall();
      sandbox.stub(asyncboxHelpers, 'sleep').withArgs(UNLOCK_WAIT_TIME).onFirstCall();
      await fingerprintUnlock.bind(driver)(caps).should.be.fulfilled;
    });
  });
  describe('pinUnlock', function() {
    const caps = {unlockKey: '13579'};
    const keys = ['1', '3', '5', '7', '9'];
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
      sandbox.stub(unlockHelpers, 'stringKeyToArr').returns(keys);
      sandbox.stub(driver.adb, 'getApiLevel').returns(21);
      sandbox.stub(driver, 'findElOrEls')
        .withArgs('id', 'com.android.systemui:id/digit_text', true)
        .returns(els);
      sandbox.stub(driver.adb, 'isScreenLocked').returns(true);
      sandbox.stub(driver.adb, 'keyevent').withArgs(66).onFirstCall();
      const getAttributeStub = sandbox.stub(driver, 'getAttribute');
      for (let e of els) {
        getAttributeStub
          .withArgs('text', e.ELEMENT)
          .returns(e.ELEMENT.toString());
      }
      sandbox.stub(asyncboxHelpers, 'sleep').withArgs(UNLOCK_WAIT_TIME);
      sandbox.stub(driver, 'click');

      await pinUnlock.bind(driver)(caps);

      driver.click.getCall(0).args[0].should.equal(1);
      driver.click.getCall(1).args[0].should.equal(3);
      driver.click.getCall(2).args[0].should.equal(5);
      driver.click.getCall(3).args[0].should.equal(7);
      driver.click.getCall(4).args[0].should.equal(9);
    });
  });
  describe('passwordUnlock', function() {
    it('should be able to unlock device using password', async function () {
      let caps = {unlockKey: 'psswrd'};
      sandbox.stub(driver.adb, 'dismissKeyguard').onFirstCall();
      sandbox.stub(unlockHelpers, 'encodePassword')
        .withArgs(caps.unlockKey)
        .returns(caps.unlockKey);
      sandbox.stub(driver.adb, 'shell')
        .withArgs(['input', 'text', caps.unlockKey])
        .withArgs(['input', 'keyevent', String(KEYCODE_NUMPAD_ENTER)]);
      sandbox.stub(asyncboxHelpers, 'sleep');
      sandbox.stub(driver.adb, 'isScreenLocked').returns(true);
      sandbox.stub(driver.adb, 'keyevent').withArgs(66).onFirstCall();
      await passwordUnlock.bind(driver)(caps);
    });
  });
  describe('getPatternKeyPosition', function () {
    it('should verify pattern pin is aproximatelly to its position', function () {
      let pins = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function mapPins(pin) {
        return getPatternKeyPosition(pin, {x: 33, y: 323}, 137.6);
      });
      let cols = [101, 238, 375];
      let rows = [391, 528, 665];
      chai.expect(pins[0].x).to.be.within(cols[0] - 5, cols[0] + 5);
      chai.expect(pins[1].x).to.be.within(cols[1] - 5, cols[1] + 5);
      chai.expect(pins[2].x).to.be.within(cols[2] - 5, cols[2] + 5);
      chai.expect(pins[3].x).to.be.within(cols[0] - 5, cols[0] + 5);
      chai.expect(pins[4].x).to.be.within(cols[1] - 5, cols[1] + 5);
      chai.expect(pins[5].x).to.be.within(cols[2] - 5, cols[2] + 5);
      chai.expect(pins[6].x).to.be.within(cols[0] - 5, cols[0] + 5);
      chai.expect(pins[7].x).to.be.within(cols[1] - 5, cols[1] + 5);
      chai.expect(pins[8].x).to.be.within(cols[2] - 5, cols[2] + 5);
      chai.expect(pins[0].y).to.be.within(rows[0] - 5, rows[0] + 5);
      chai.expect(pins[1].y).to.be.within(rows[0] - 5, rows[0] + 5);
      chai.expect(pins[2].y).to.be.within(rows[0] - 5, rows[0] + 5);
      chai.expect(pins[3].y).to.be.within(rows[1] - 5, rows[1] + 5);
      chai.expect(pins[4].y).to.be.within(rows[1] - 5, rows[1] + 5);
      chai.expect(pins[5].y).to.be.within(rows[1] - 5, rows[1] + 5);
      chai.expect(pins[6].y).to.be.within(rows[2] - 5, rows[2] + 5);
      chai.expect(pins[7].y).to.be.within(rows[2] - 5, rows[2] + 5);
      chai.expect(pins[8].y).to.be.within(rows[2] - 5, rows[2] + 5);
    });
  });
  describe('getPatternActions', function () {
    it('should generate press, moveTo, relase gesture scheme to unlock by pattern', function () {
      const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
      const actions = getPatternActions(keys, {x: 0, y: 0}, 1);
      actions.should.eql([
        {
          type: 'pointer',
          id: 'patternUnlock',
          parameters: {
            pointerType: 'touch'
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
            {type: 'pointerUp', button: 0}
          ]
        }
      ]);
    });
    it('should verify pattern gestures moves to non consecutives pins', function () {
      const keys = ['7', '2', '9', '8', '5', '6', '1', '4', '3'];
      const actions = getPatternActions(keys, {x: 0, y: 0}, 1);
      actions.should.eql([
        {
          type: 'pointer',
          id: 'patternUnlock',
          parameters: {
            pointerType: 'touch'
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
            {type: 'pointerUp', button: 0}
          ]
        }
      ]);
    });
  });
  describe('patternUnlock', function () {
    const el = {ELEMENT: 1};
    const pos = {x: 10, y: 20};
    const size = {width: 300};
    const keys = ['1', '3', '5', '7', '9'];
    const caps = {unlockKey: '13579'};
    beforeEach(function () {
      sandbox.stub(driver.adb, 'dismissKeyguard').onFirstCall();
      sandbox.stub(unlockHelpers, 'stringKeyToArr').returns(keys);
      sandbox.stub(driver, 'getLocation').withArgs(el.ELEMENT).returns(pos);
      sandbox.stub(driver, 'getSize').withArgs(el.ELEMENT).returns(size);
      sandbox.stub(unlockHelpers, 'getPatternActions').withArgs(keys, pos, 100).returns('actions');
      sandbox.stub(driver, 'performActions').withArgs('actions').onFirstCall();
      sandbox.stub(asyncboxHelpers, 'sleep').withArgs(UNLOCK_WAIT_TIME).onFirstCall();
    });
    it('should be able to unlock device using pattern (API level >= 21)', async function () {
      sandbox.stub(driver.adb, 'getApiLevel').returns(21);
      sandbox.stub(driver, 'findElOrEls')
        .withArgs('id', 'com.android.systemui:id/lockPatternView', false)
        .returns(el);
      await patternUnlock.bind(driver)(caps);
    });
    it('should be able to unlock device using pattern (API level < 21)', async function () {
      sandbox.stub(driver.adb, 'getApiLevel').returns(20);
      sandbox.stub(driver, 'findElOrEls')
        .withArgs('id', 'com.android.keyguard:id/lockPatternView', false)
        .returns(el);
      await patternUnlock.bind(driver)(caps);
    });
  });
});
