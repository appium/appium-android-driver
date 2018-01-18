import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { withMocks } from 'appium-test-support';
import sinon from 'sinon';
import helpers from '../../lib/unlock-helpers';
import AndroidDriver from '../../lib/driver';
import * as asyncbox from 'asyncbox';
import ADB from 'appium-adb';

const KEYCODE_NUMPAD_ENTER = "66";
const INPUT_KEYS_WAIT_TIME = 100;
const HIDE_KEYBOARD_WAIT_TIME = 100;
const UNLOCK_WAIT_TIME = 100;

chai.should();
chai.use(chaiAsPromised);

describe('Unlock Helpers', function () {
  let adb = new ADB();
  let driver = new AndroidDriver();
  let sandbox = sinon.sandbox.create();
  let expect = chai.expect;
  describe('isValidUnlockType', function () {
    it('should verify the unlock types', async function () {
      helpers.isValidUnlockType('pin').should.equal(true);
      helpers.isValidUnlockType('pattern').should.equal(true);
      helpers.isValidUnlockType('password').should.equal(true);
      helpers.isValidUnlockType('fingerprint').should.equal(true);
      helpers.isValidUnlockType('telepathy').should.equal(false);
    });
  });
  describe('isValidKey',  function () {
    it('should verify the unlock keys for each type', async function () {
      helpers.isValidKey('pin').should.equal(false);
      helpers.isValidKey('pin', ' ').should.equal(false);
      helpers.isValidKey('pin', '1111').should.equal(true);
      helpers.isValidKey('pin', '1abc').should.equal(false);
      helpers.isValidKey('fingerprint').should.equal(false);
      helpers.isValidKey('fingerprint', ' ').should.equal(false);
      helpers.isValidKey('fingerprint', '1111').should.equal(true);
      helpers.isValidKey('fingerprint', '1abc').should.equal(false);
      helpers.isValidKey('pattern', '1').should.equal(false);
      helpers.isValidKey('pattern', '1234').should.equal(true);
      helpers.isValidKey('pattern', '123456789').should.equal(true);
      helpers.isValidKey('pattern', '01234').should.equal(false);
      helpers.isValidKey('pattern').should.equal(false);
      helpers.isValidKey('pattern', ' ').should.equal(false);
      helpers.isValidKey('pattern', '1abc').should.equal(false);
      helpers.isValidKey('pattern', '1213').should.equal(false);
      helpers.isValidKey('password', '121c3').should.equal(true);
      helpers.isValidKey('password', 'appium').should.equal(true);
      helpers.isValidKey('password', 'appium-android-driver').should.equal(true);
      helpers.isValidKey('password', '@#$%&-+()*"\':;!?,_ ./~`|={}\\[]').should.equal(true);
      helpers.isValidKey('password', '123').should.equal(false);
      helpers.isValidKey('password').should.equal(false);
      helpers.isValidKey('password', '   ').should.equal(false);
    });
    it('should throw error if unlock type is invalid', async function () {
      expect(() => helpers.isValidKey('invalid_unlock_type', '1'))
        .to.throw('Invalid unlock type');
    });
  });
  describe('dismissKeyguard', withMocks({driver,  adb, asyncbox, helpers}, (mocks) => {
    it('should hide keyboard if keyboard is snown', async function () {
      mocks.driver.expects('isKeyboardShown').returns(true);
      mocks.driver.expects('hideKeyboard').once();
      mocks.asyncbox.expects('sleep').withExactArgs(HIDE_KEYBOARD_WAIT_TIME).once();
      mocks.adb.expects('shell').once();
      mocks.adb.expects('back').once();
      mocks.adb.expects('getApiLevel').returns(20);
      mocks.helpers.expects('swipeUp').once();
      await helpers.dismissKeyguard(driver, adb);
      mocks.driver.verify();
      mocks.asyncbox.verify();
      mocks.helpers.verify();
    });
    it('should dismiss notifications and dissmiss keyguard via swipping up', async function () {
      mocks.driver.expects('isKeyboardShown').returns(false);
      mocks.adb.expects('shell')
        .withExactArgs(["service", "call", "notification", "1"]).once();
      mocks.adb.expects('back').once();
      mocks.adb.expects('getApiLevel').returns(21);
      mocks.helpers.expects('swipeUp').withExactArgs(driver).once();
      await helpers.dismissKeyguard(driver, adb);
      mocks.driver.verify();
      mocks.adb.verify();
      mocks.helpers.verify();
    });
    it('should dissmiss keyguard via dismiss-keyguard shell command if API level > 21', async function () {
      mocks.driver.expects('isKeyboardShown').returns(false);
      mocks.adb.expects('shell').onCall(0).returns('');
      mocks.adb.expects('back').once();
      mocks.adb.expects('getApiLevel').returns(22);
      mocks.adb.expects('shell').withExactArgs(["wm", "dismiss-keyguard"]).once();
      mocks.helpers.expects('swipeUp').never();
      await helpers.dismissKeyguard(driver, adb);
      mocks.driver.verify();
      mocks.adb.verify();
      mocks.helpers.verify();
    });
  }));
  describe('swipeUp', withMocks({driver, helpers}, (mocks) => {
    it('should perform swipe up touch action', async function () {
      let windowSize = {x: 475, y: 800};
      let actions = [
        {action: 'press', options: {element: null, x: 237, y: 790}},
        {action: 'moveTo', options: {element: null, x: 237, y: 100}},
        {action: 'release'}
      ];
      mocks.driver.expects('getWindowSize').returns(windowSize);
      mocks.driver.expects('performTouch').withExactArgs(actions).once;
      await helpers.swipeUp(driver);
      mocks.driver.verify();
    });
  }));
  describe('encodePassword', function () {
    it('should verify the password with blank space is encoded', async function () {
      helpers.encodePassword('a p p i u m').should.equal("a%sp%sp%si%su%sm");
      helpers.encodePassword('   ').should.equal("%s%s%s");
    });
  });
  describe('stringKeyToArr', function () {
    it('should cast string keys to array', async function () {
      helpers.stringKeyToArr('1234').should.eql(['1', '2', '3', '4']);
      helpers.stringKeyToArr(' 1234 ').should.eql(['1', '2', '3', '4']);
      helpers.stringKeyToArr('1 2 3 4').should.eql(['1', '2', '3', '4']);
      helpers.stringKeyToArr('1  2  3  4').should.eql(['1', '2', '3', '4']);
    });
  });
  describe('fingerprintUnlock', withMocks({adb, asyncbox}, (mocks) => {
    it('should be able to unlock device via fingerprint if API level >= 23', async function () {
      let caps = {unlockKey: '123'};
      mocks.adb.expects('getApiLevel').returns(23);
      mocks.adb.expects('fingerprint').withExactArgs(caps.unlockKey).once();
      mocks.asyncbox.expects('sleep').withExactArgs(UNLOCK_WAIT_TIME).once();
      await helpers.fingerprintUnlock(adb, driver, caps).should.be.fulfilled;
      mocks.adb.verify();
      mocks.asyncbox.verify();
    });
    it('should throw error if API level < 23', async function () {
      mocks.adb.expects('getApiLevel').returns(22);
      mocks.adb.expects('fingerprint').never();
      mocks.asyncbox.expects('sleep').never();
      await helpers.fingerprintUnlock(adb)
        .should.eventually.be.rejectedWith('only works for Android 6+');
      mocks.adb.verify();
      mocks.asyncbox.verify();
    });
  }));
  describe('pinUnlock', withMocks({adb, helpers, driver, asyncbox}, (mocks) => {
    const caps = {unlockKey: '13579'};
    const keys = ['1', '3', '5', '7', '9'];
    const els = [{ELEMENT: 1}, {ELEMENT: 2}, {ELEMENT: 3},
                 {ELEMENT: 4}, {ELEMENT: 5}, {ELEMENT: 6},
                 {ELEMENT: 7}, {ELEMENT: 8}, {ELEMENT: 9}];
    afterEach(function () {
      sandbox.restore();
    });
    it('should be able to unlock device using pin (API level >= 21)', async function () {
      mocks.helpers.expects('dismissKeyguard').once();
      mocks.helpers.expects('stringKeyToArr').returns(keys);
      mocks.adb.expects('getApiLevel').returns(21);
      mocks.driver.expects('findElOrEls')
        .withExactArgs("id", "com.android.systemui:id/digit_text", true)
        .returns(els);
      mocks.driver.expects('findElOrEls')
        .withExactArgs("id", "com.android.systemui:id/key_enter", false)
        .returns({ELEMENT: 100});
      for (let e of els) {
        mocks.driver.expects('getAttribute').withExactArgs('text', e.ELEMENT)
          .returns(e.ELEMENT.toString());
      }
      mocks.asyncbox.expects('sleep').withExactArgs(UNLOCK_WAIT_TIME).once();
      sandbox.stub(driver, 'click');

      await helpers.pinUnlock(adb, driver, caps);

      driver.click.getCall(0).args[0].should.equal(1);
      driver.click.getCall(1).args[0].should.equal(3);
      driver.click.getCall(2).args[0].should.equal(5);
      driver.click.getCall(3).args[0].should.equal(7);
      driver.click.getCall(4).args[0].should.equal(9);
      driver.click.getCall(5).args[0].should.equal(100);

      mocks.helpers.verify();
      mocks.driver.verify();
      mocks.adb.verify();
      mocks.asyncbox.verify();
    });
    it('should be able to unlock device using pin (API level < 21)', async function () {
      mocks.helpers.expects('dismissKeyguard').once();
      mocks.helpers.expects('stringKeyToArr').returns(keys);
      mocks.adb.expects('getApiLevel').returns(20);
      for (let pin of keys) {
        mocks.driver.expects('findElOrEls')
          .withExactArgs("id", `com.android.keyguard:id/key${pin}`, false)
          .returns({ELEMENT: parseInt(pin, 10)});
      }
      mocks.driver.expects('findElOrEls')
        .withExactArgs("id", "com.android.keyguard:id/key_enter", false)
        .returns({ELEMENT: 100});
      mocks.asyncbox.expects('sleep').withExactArgs(UNLOCK_WAIT_TIME).once();
      sandbox.stub(driver, 'click');

      await helpers.pinUnlock(adb, driver, caps);

      driver.click.getCall(0).args[0].should.equal(1);
      driver.click.getCall(1).args[0].should.equal(3);
      driver.click.getCall(2).args[0].should.equal(5);
      driver.click.getCall(3).args[0].should.equal(7);
      driver.click.getCall(4).args[0].should.equal(9);
      driver.click.getCall(5).args[0].should.equal(100);

      mocks.helpers.verify();
      mocks.driver.verify();
      mocks.adb.verify();
      mocks.asyncbox.verify();
    });
    it('should throw error if pin buttons does not exist (API level >= 21)', async function () {
      mocks.helpers.expects('dismissKeyguard').once();
      mocks.helpers.expects('stringKeyToArr').once();
      mocks.adb.expects('getApiLevel').returns(21);
      mocks.driver.expects('findElOrEls').returns(null);
      await helpers.pinUnlock(adb, driver, caps).should.eventually.be
        .rejectedWith('Error finding unlock pin buttons!');
      mocks.helpers.verify();
      mocks.driver.verify();
      mocks.adb.verify();
    });
    it('should throw error if pin buttons does not exist (API level < 21)', async function () {
      mocks.helpers.expects('dismissKeyguard').once();
      mocks.helpers.expects('stringKeyToArr').returns(keys);
      mocks.adb.expects('getApiLevel').returns(20);
      mocks.driver.expects('findElOrEls')
        .withExactArgs('id', 'com.android.keyguard:id/key1', false)
        .returns(null);
      await helpers.pinUnlock(adb, driver, caps).should.eventually.be
        .rejectedWith(`Error finding unlock pin '1' button!`);
      mocks.helpers.verify();
      mocks.driver.verify();
      mocks.adb.verify();
    });
  }));
  describe('passwordUnlock', withMocks({adb, helpers, asyncbox}, (mocks) => {
    it('should be able to unlock device using password', async function () {
      let caps = {unlockKey: 'psswrd'};
      mocks.helpers.expects('dismissKeyguard').withExactArgs(driver, adb).once();
      mocks.helpers.expects('encodePassword').withExactArgs(caps.unlockKey).returns(caps.unlockKey);
      mocks.adb.expects('shell').withExactArgs(['input', 'text', caps.unlockKey]).once();
      mocks.asyncbox.expects('sleep').withExactArgs(INPUT_KEYS_WAIT_TIME).once();
      mocks.adb.expects('shell').withExactArgs(['input', 'keyevent', KEYCODE_NUMPAD_ENTER]);
      mocks.asyncbox.expects('sleep').withExactArgs(UNLOCK_WAIT_TIME).once();
      await helpers.passwordUnlock(adb, driver, caps);
      mocks.helpers.verify();
      mocks.adb.verify();
      mocks.asyncbox.verify();
    });
  }));
  describe('getPatternKeyPosition', function () {
    it('should verify pattern pin is aproximatelly to its position', async function () {
      let pins = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((pin) => {
        return helpers.getPatternKeyPosition(pin, {x: 33, y:323}, 137.6);
      });
      let cols = [101, 238, 375];
      let rows = [391, 528, 665];
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
    it('should generate press, moveTo, relase gesture scheme to unlock by pattern', async function () {
      let keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
      let actions = helpers.getPatternActions(keys, {x: 0, y:0}, 1);
      actions.map((action, i) => {
        if (i === 0) {
          action.action.should.equal('press');
        } else if (i === keys.length) {
          action.action.should.equal('release');
        } else {
          action.action.should.equal('moveTo');
        }
      });
    });
    it('should verify pattern gestures moves to non consecutives pins', async function () {
      let keys = ["7", "2", "9", "8", "5", "6", "1", "4", "3"];
      let actions = helpers.getPatternActions(keys, {x: 0, y:0}, 1);
      // Move from pin 7 to pin 2
      actions[1].options.x.should.equal(1);
      actions[1].options.y.should.equal(-2);
      // Move from pin 2 to pin 9
      actions[2].options.x.should.equal(1);
      actions[2].options.y.should.equal(2);
      // Move from pin 9 to pin 8
      actions[3].options.x.should.equal(-1);
      actions[3].options.y.should.equal(0);
      // Move from pin 8 to pin 5
      actions[4].options.x.should.equal(0);
      actions[4].options.y.should.equal(-1);
      // Move from pin 5 to pin 6
      actions[5].options.x.should.equal(1);
      actions[5].options.y.should.equal(0);
      // Move from pin 6 to pin 1
      actions[6].options.x.should.equal(-2);
      actions[6].options.y.should.equal(-1);
      // Move from pin 1 to pin 4
      actions[7].options.x.should.equal(0);
      actions[7].options.y.should.equal(1);
      // Move from pin 4 to pin 3
      actions[8].options.x.should.equal(2);
      actions[8].options.y.should.equal(-1);
    });
  });
  describe('patternUnlock', withMocks({driver, helpers, adb, asyncbox}, (mocks) => {
    const el = {ELEMENT: 1};
    const pos = {x: 10, y: 20};
    const size = {width: 300};
    const keys = ['1', '3', '5', '7', '9'];
    const caps = {unlockKey: '13579'};
    beforeEach(function () {
      mocks.helpers.expects('dismissKeyguard').withExactArgs(driver, adb).once();
      mocks.helpers.expects('stringKeyToArr').returns(keys);
      mocks.driver.expects('getLocation').withExactArgs(el.ELEMENT).returns(pos);
      mocks.driver.expects('getSize').withExactArgs(el.ELEMENT).returns(size);
      mocks.helpers.expects('getPatternActions')
        .withExactArgs(keys, pos, 100).returns('actions');
      mocks.driver.expects('performTouch').withExactArgs('actions').once();
      mocks.asyncbox.expects('sleep').withExactArgs(UNLOCK_WAIT_TIME).once();
    });
    it('should be able to unlock device using pattern (API level >= 21)', async function () {
      mocks.adb.expects('getApiLevel').returns(21);
      mocks.driver.expects('findElOrEls')
        .withExactArgs('id', 'com.android.systemui:id/lockPatternView', false)
        .returns(el);
      await helpers.patternUnlock(adb, driver, caps);
      mocks.helpers.verify();
      mocks.driver.verify();
      mocks.asyncbox.verify();
      mocks.adb.verify();
    });
    it('should be able to unlock device using pattern (API level < 21)', async function () {
      mocks.adb.expects('getApiLevel').returns(20);
      mocks.driver.expects('findElOrEls')
        .withExactArgs('id', 'com.android.keyguard:id/lockPatternView', false)
        .returns(el);
      await helpers.patternUnlock(adb, driver, caps);
      mocks.helpers.verify();
      mocks.driver.verify();
      mocks.asyncbox.verify();
      mocks.adb.verify();
    });
  }));
});
