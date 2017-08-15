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

describe('Unlock Helpers', () => {
  let adb = new ADB();
  let driver = new AndroidDriver();
  let sandbox = sinon.sandbox.create();
  let assert = chai.assert;
  describe('isValidKey',  () => {
    it('should throw error if unlock type is invalid', async () => {
      assert.throws(() => helpers.isValidKey('invalid_unlock_type', '1'), 'Invalid unlock type');
    });
  });
  describe('dismissKeyguard', withMocks({driver,  adb, asyncbox, helpers}, (mocks) => {
    it('should hide keyboard if keyboard is snown', async () => {
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
    it('should dismiss notifications and dissmiss keyguard via swipping up', async () => {
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
    it('should dissmiss keyguard via dismiss-keyguard shell command if API level > 21', async () => {
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
    it('should perform swipe up touch action', async () => {
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
  describe('fingerprintUnlock', withMocks({adb, asyncbox}, (mocks) => {
    it('should be able to unlock device via fingerprint if API level >= 23', async () => {
      let caps = {unlockKey: '123'};
      mocks.adb.expects('getApiLevel').returns(23);
      mocks.adb.expects('fingerprint').withExactArgs(caps.unlockKey).once();
      mocks.asyncbox.expects('sleep').withExactArgs(UNLOCK_WAIT_TIME).once();
      await helpers.fingerprintUnlock(adb, driver, caps).should.be.fulfilled;
      mocks.adb.verify();
      mocks.asyncbox.verify();
    });
    it('should throw error if API level < 23', async () => {
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
    afterEach(() => {
      sandbox.restore();
    });
    it('should be able to unlock device using pin (API level >= 21)', async () => {
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
    it('should be able to unlock device using pin (API level < 21)', async () => {
      mocks.helpers.expects('dismissKeyguard').once();
      mocks.helpers.expects('stringKeyToArr').returns(keys);
      mocks.adb.expects('getApiLevel').returns(20);
      for (let pin of keys) {
        mocks.driver.expects('findElOrEls')
          .withExactArgs("id", `com.android.keyguard:id/key${pin}`, false)
          .returns({ELEMENT: parseInt(pin)});
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
    it('should throw error if pin buttons does not exist (API level >= 21)', async () => {
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
    it('should throw error if pin buttons does not exist (API level < 21)', async () => {
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
    it('should be able to unlock device using password', async () => {
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
  describe('patternUnlock', withMocks({driver, helpers, adb, asyncbox}, (mocks) => {
    const el = {ELEMENT: 1};
    const pos = {x: 10, y: 20};
    const size = {width: 300};
    const keys = ['1', '3', '5', '7', '9'];
    const caps = {unlockKey: '13579'};
    beforeEach(() => {
      mocks.helpers.expects('dismissKeyguard').withExactArgs(driver, adb).once();
      mocks.helpers.expects('stringKeyToArr').returns(keys);
      mocks.driver.expects('getLocation').withExactArgs(el.ELEMENT).returns(pos);
      mocks.driver.expects('getSize').withExactArgs(el.ELEMENT).returns(size);
      mocks.helpers.expects('getPatternActions')
        .withExactArgs(keys, pos, 100).returns('actions');
      mocks.driver.expects('performTouch').withExactArgs('actions').once();
      mocks.asyncbox.expects('sleep').withExactArgs(UNLOCK_WAIT_TIME).once();
    });
    it('should be able to unlock device using pattern (API level >= 21)', async () => {
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
    it('should be able to unlock device using pattern (API level < 21)', async () => {
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
