import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import Bootstrap from '../../../lib/bootstrap';
import AndroidDriver from '../../../lib/driver';
import ADB from 'appium-adb';


let driver;
let sandbox = sinon.createSandbox();
chai.should();
chai.use(chaiAsPromised);

describe('Actions', function () {
  beforeEach(function () {
    driver = new AndroidDriver();
    driver.adb = new ADB();
    driver.bootstrap = new Bootstrap();
    sandbox.stub(driver.bootstrap, 'sendAction');
  });
  afterEach(function () {
    sandbox.restore();
  });
  describe('keyevent', function () {
    it('shoudle be able to execute keyevent via pressKeyCode', async function () {
      sandbox.stub(driver, 'pressKeyCode');
      await driver.keyevent('66', 'meta');
      driver.pressKeyCode.calledWithExactly('66', 'meta').should.be.true;
    });
    it('should set metastate to null by default', async function () {
      sandbox.stub(driver, 'pressKeyCode');
      await driver.keyevent('66');
      driver.pressKeyCode.calledWithExactly('66', null).should.be.true;
    });
  });
  describe('pressKeyCode', function () {
    it('shoudle be able to press key code', async function () {
      await driver.pressKeyCode('66', 'meta');
      driver.bootstrap.sendAction
        .calledWithExactly('pressKeyCode', {keycode: '66', metastate: 'meta'})
        .should.be.true;
    });
    it('should set metastate to null by default', async function () {
      await driver.pressKeyCode('66');
      driver.bootstrap.sendAction
        .calledWithExactly('pressKeyCode', {keycode: '66', metastate: null})
        .should.be.true;
    });
  });
  describe('longPressKeyCode', function () {
    it('shoudle be able to press key code', async function () {
      await driver.longPressKeyCode('66', 'meta');
      driver.bootstrap.sendAction
        .calledWithExactly('longPressKeyCode', {keycode: '66', metastate: 'meta'})
        .should.be.true;
    });
    it('should set metastate to null by default', async function () {
      await driver.longPressKeyCode('66');
      driver.bootstrap.sendAction
        .calledWithExactly('longPressKeyCode', {keycode: '66', metastate: null})
        .should.be.true;
    });
  });
  describe('getOrientation', function () {
    it('shoudle be able to get orientation', async function () {
      driver.bootstrap.sendAction.withArgs('orientation', {naturalOrientation: false})
        .returns('landscape');
      await driver.getOrientation().should.become('LANDSCAPE');
      driver.bootstrap.sendAction
        .calledWithExactly('orientation', {naturalOrientation: false})
        .should.be.true;
    });
  });
  describe('setOrientation', function () {
    it('shoudle be able to set orientation', async function () {
      let opts = {orientation: 'SOMESCAPE', naturalOrientation: false};
      await driver.setOrientation('somescape');
      driver.bootstrap.sendAction.calledWithExactly('orientation', opts)
        .should.be.true;
    });
  });
  describe('fakeFlick', function () {
    it('shoudle be able to do fake flick', async function () {
      await driver.fakeFlick(12, 34);
      driver.bootstrap.sendAction
        .calledWithExactly('flick', {xSpeed: 12, ySpeed: 34}).should.be.true;
    });
  });
  describe('fakeFlickElement', function () {
    it('shoudle be able to do fake flick on element', async function () {
      await driver.fakeFlickElement(5000, 56, 78, 1.32);
      driver.bootstrap.sendAction
        .calledWithExactly('element:flick',
          {xoffset: 56, yoffset: 78, speed: 1.32, elementId: 5000})
        .should.be.true;
    });
  });
  describe('swipe', function () {
    it('should swipe an element', function () {
      let swipeOpts = {startX: 10, startY: 11, endX: 20, endY: 22,
                       steps: 3, elementId: 'someElementId'};
      driver.swipe(10, 11, 20, 22, 0.1, null, 'someElementId');
      driver.bootstrap.sendAction.calledWithExactly('element:swipe', swipeOpts)
        .should.be.true;
    });
    it('should swipe without an element', function () {
      driver.swipe(0, 0, 1, 1, 0, 1);
      driver.bootstrap.sendAction.calledWith('swipe').should.be.true;
    });
    it('should set start point to (0.5;0.5) if startX and startY are "null"', function () {
      let swipeOpts = {startX: 0.5, startY: 0.5, endX: 0, endY: 0, steps: 0};
      sandbox.stub(driver, 'doSwipe');
      driver.swipe('null', 'null', 0, 0, 0);
      driver.doSwipe.calledWithExactly(swipeOpts).should.be.true;
    });
  });
  describe('pinchClose', function () {
    it('should be able to pinch in element', async function () {
      let pinchOpts = {direction: 'in', elementId: 'el01', percent: 0.5, steps: 5};
      await driver.pinchClose(null, null, null, null, null, 0.5, 5, 'el01');
      driver.bootstrap.sendAction.calledWithExactly('element:pinch', pinchOpts)
        .should.be.true;
    });
  });
  describe('pinchOpen', function () {
    it('should be able to pinch out element', async function () {
      let pinchOpts = {direction: 'out', elementId: 'el01', percent: 0.5, steps: 5};
      await driver.pinchOpen(null, null, null, null, null, 0.5, 5, 'el01');
      driver.bootstrap.sendAction.calledWithExactly('element:pinch', pinchOpts)
        .should.be.true;
    });
  });
  describe('flick', function () {
    it('should call fakeFlickElement if element is passed', async function () {
      sandbox.stub(driver, 'fakeFlickElement');
      await driver.flick('elem', null, null, 1, 2, 3);
      driver.fakeFlickElement.calledWith('elem', 1, 2, 3).should.be.true;
    });
    it('should call fakeFlick if element is not passed', async function () {
      sandbox.stub(driver, 'fakeFlick');
      await driver.flick(null, 1, 2);
      driver.fakeFlick.calledWith(1, 2).should.be.true;
    });
  });
  describe('drag', function () {
    let dragOpts = {
      elementId: 'elem1', destElId: 'elem2',
      startX: 1, startY: 2, endX: 3, endY: 4, steps: 1
    };
    it('should drag an element', function () {
      driver.drag(1, 2, 3, 4, 0.02, null, 'elem1', 'elem2');
      driver.bootstrap.sendAction.calledWithExactly('element:drag', dragOpts)
        .should.be.true;
    });
    it('should drag without an element', function () {
      dragOpts.elementId = null;
      driver.drag(1, 2, 3, 4, 0.02, null, null, 'elem2');
      driver.bootstrap.sendAction.calledWithExactly('drag', dragOpts)
        .should.be.true;
    });
  });
  describe('lock', function () {
    it('should call adb.lock()', async function () {
      sandbox.stub(driver.adb, 'lock');
      await driver.lock();
      driver.adb.lock.calledOnce.should.be.true;
    });
  });
  describe('isLocked', function () {
    it('should call adb.isScreenLocked()', async function () {
      sandbox.stub(driver.adb, 'isScreenLocked').returns('lock_status');
      await driver.isLocked().should.become('lock_status');
      driver.adb.isScreenLocked.calledOnce.should.be.true;
    });
  });
  describe('openNotifications', function () {
    it('should be able to open notifications', async function () {
      await driver.openNotifications();
      driver.bootstrap.sendAction.calledWithExactly('openNotification')
        .should.be.true;
    });
  });
  describe('setLocation', function () {
    it('should be able to set location', async function () {
      sandbox.stub(driver.adb, 'sendTelnetCommand');
      await driver.setLocation('lat', 'long');
      driver.adb.sendTelnetCommand.calledWithExactly('geo fix long lat')
        .should.be.true;
    });
  });

  describe('fingerprint', function () {
    it('should call fingerprint adb command for emulator', async function () {
      sandbox.stub(driver.adb, 'fingerprint');
      sandbox.stub(driver, 'isEmulator').returns(true);
      await driver.fingerprint(1111);
      driver.adb.fingerprint.calledWithExactly(1111).should.be.true;
    });
    it('should throw exception for real device', async function () {
      sandbox.stub(driver.adb, 'fingerprint');
      sandbox.stub(driver, 'isEmulator').returns(false);
      await driver.fingerprint(1111).should.be
        .rejectedWith('fingerprint method is only available for emulators');
      driver.adb.fingerprint.notCalled.should.be.true;
    });
  });
  describe('sendSMS', function () {
    it('should call sendSMS adb command for emulator', async function () {
      sandbox.stub(driver.adb, 'sendSMS');
      sandbox.stub(driver, 'isEmulator').returns(true);
      await driver.sendSMS(4509, 'Hello Appium');
      driver.adb.sendSMS.calledWithExactly(4509, 'Hello Appium')
        .should.be.true;
    });
    it('should throw exception for real device', async function () {
      sandbox.stub(driver.adb, 'sendSMS');
      sandbox.stub(driver, 'isEmulator').returns(false);
      await driver.sendSMS(4509, 'Hello Appium')
        .should.be.rejectedWith('sendSMS method is only available for emulators');
      driver.adb.sendSMS.notCalled.should.be.true;
    });
  });
  describe('sensorSet', function () {
    it('should call sensor adb command for emulator', async function () {
      sandbox.stub(driver.adb, 'sensorSet');
      sandbox.stub(driver, 'isEmulator').returns(true);
      await driver.sensorSet({sensorType: 'light', value: 0});
      driver.adb.sensorSet.calledWithExactly('light', 0)
        .should.be.true;
    });
    it('should throw exception for real device', async function () {
      sandbox.stub(driver.adb, 'sensorSet');
      sandbox.stub(driver, 'isEmulator').returns(false);
      await driver.sensorSet({sensorType: 'light', value: 0})
        .should.be.rejectedWith('sensorSet method is only available for emulators');
      driver.adb.sensorSet.notCalled.should.be.true;
    });
  });
  describe('gsmCall', function () {
    it('should call gsmCall adb command for emulator', async function () {
      sandbox.stub(driver.adb, 'gsmCall');
      sandbox.stub(driver, 'isEmulator').returns(true);
      await driver.gsmCall(4509, 'call');
      driver.adb.gsmCall.calledWithExactly(4509, 'call').should.be.true;
    });
    it('should throw exception for real device', async function () {
      sandbox.stub(driver.adb, 'gsmCall');
      sandbox.stub(driver, 'isEmulator').returns(false);
      await driver.gsmCall(4509, 'call')
        .should.be.rejectedWith('gsmCall method is only available for emulators');
      driver.adb.gsmCall.notCalled.should.be.true;
    });
  });
  describe('gsmSignal', function () {
    it('should call gsmSignal adb command for emulator', async function () {
      sandbox.stub(driver.adb, 'gsmSignal');
      sandbox.stub(driver, 'isEmulator').returns(true);
      await driver.gsmSignal(3);
      driver.adb.gsmSignal.calledWithExactly(3)
        .should.be.true;
    });
    it('should throw exception for real device', async function () {
      sandbox.stub(driver.adb, 'gsmSignal');
      sandbox.stub(driver, 'isEmulator').returns(false);
      await driver.gsmSignal(3)
        .should.be.rejectedWith('gsmSignal method is only available for emulators');
      driver.adb.gsmSignal.notCalled.should.be.true;
    });
  });
  describe('gsmVoice', function () {
    it('should call gsmVoice adb command for emulator', async function () {
      sandbox.stub(driver.adb, 'gsmVoice');
      sandbox.stub(driver, 'isEmulator').returns(true);
      await driver.gsmVoice('roaming');
      driver.adb.gsmVoice.calledWithExactly('roaming')
        .should.be.true;
    });
    it('should throw exception for real device', async function () {
      sandbox.stub(driver.adb, 'gsmVoice');
      sandbox.stub(driver, 'isEmulator').returns(false);
      await driver.gsmVoice('roaming')
        .should.be.rejectedWith('gsmVoice method is only available for emulators');
      driver.adb.gsmVoice.notCalled.should.be.true;
    });
  });
  describe('powerAC', function () {
    it('should call powerAC adb command for emulator', async function () {
      sandbox.stub(driver.adb, 'powerAC');
      sandbox.stub(driver, 'isEmulator').returns(true);
      await driver.powerAC('off');
      driver.adb.powerAC.calledWithExactly('off')
        .should.be.true;
    });
    it('should throw exception for real device', async function () {
      sandbox.stub(driver.adb, 'powerAC');
      sandbox.stub(driver, 'isEmulator').returns(false);
      await driver.powerAC('roaming')
        .should.be.rejectedWith('powerAC method is only available for emulators');
      driver.adb.powerAC.notCalled.should.be.true;
    });
  });
  describe('powerCapacity', function () {
    it('should call powerCapacity adb command for emulator', async function () {
      sandbox.stub(driver.adb, 'powerCapacity');
      sandbox.stub(driver, 'isEmulator').returns(true);
      await driver.powerCapacity(5);
      driver.adb.powerCapacity.calledWithExactly(5)
        .should.be.true;
    });
    it('should throw exception for real device', async function () {
      sandbox.stub(driver.adb, 'powerCapacity');
      sandbox.stub(driver, 'isEmulator').returns(false);
      await driver.powerCapacity(5)
        .should.be.rejectedWith('powerCapacity method is only available for emulators');
      driver.adb.powerCapacity.notCalled.should.be.true;
    });
  });
  describe('networkSpeed', function () {
    it('should call networkSpeed adb command for emulator', async function () {
      sandbox.stub(driver.adb, 'networkSpeed');
      sandbox.stub(driver, 'isEmulator').returns(true);
      await driver.networkSpeed('gsm');
      driver.adb.networkSpeed.calledWithExactly('gsm')
        .should.be.true;
    });
    it('should throw exception for real device', async function () {
      sandbox.stub(driver.adb, 'networkSpeed');
      sandbox.stub(driver, 'isEmulator').returns(false);
      await driver.networkSpeed('gsm')
        .should.be.rejectedWith('networkSpeed method is only available for emulators');
      driver.adb.networkSpeed.notCalled.should.be.true;
    });
  });
});
