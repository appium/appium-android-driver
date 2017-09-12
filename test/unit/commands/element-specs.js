import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import Bootstrap from 'appium-android-bootstrap';
import AndroidDriver from '../../..';
import ADB from 'appium-adb';
import androidHelpers from '../../../lib/android-helpers';

let driver;
let sandbox = sinon.sandbox.create();
chai.should();
chai.use(chaiAsPromised);

describe('Element', () => {
  beforeEach(() => {
    driver = new AndroidDriver();
    driver.adb = new ADB();
    driver.bootstrap = new Bootstrap();
    sandbox.stub(driver.bootstrap, 'sendAction');
    sandbox.stub(androidHelpers, 'removeNullProperties');
    driver.opts = {unicodeKeyboard: true};
  });
  afterEach(() => {
    sandbox.restore();
  });
  describe('getAttribute', () => {
    it('should get element attribute', async () => {
      driver.bootstrap.sendAction.withArgs('element:getAttribute').returns('attr_value');
      await driver.getAttribute('attr', 'el1').should.become('attr_value');
      driver.bootstrap.sendAction
        .calledWithExactly('element:getAttribute', {attribute: 'attr', elementId: 'el1'})
        .should.be.true;
    });
  });
  describe('getName', () => {
    it('should get element name', async () => {
      sandbox.stub(driver, 'getAttribute');
      driver.getAttribute.returns('el_name');
      await driver.getName('el1').should.become('el_name');
      driver.getAttribute.calledWithExactly('className', 'el1').should.be.true;
    });
  });
  describe('elementDisplayed', () => {
    it('should return true if element displayed', async () => {
      sandbox.stub(driver, 'getAttribute');
      driver.getAttribute.returns('true');
      await driver.elementDisplayed('el1').should.become(true);
      driver.getAttribute.calledWithExactly('displayed', 'el1').should.be.true;
    });
    it('should return false if element not displayed', async () => {
      sandbox.stub(driver, 'getAttribute');
      driver.getAttribute.returns('false');
      await driver.elementDisplayed('el1').should.become(false);
      driver.getAttribute.calledWithExactly('displayed', 'el1').should.be.true;
    });
  });
  describe('elementEnabled', () => {
    it('should return true if element enabled', async () => {
      sandbox.stub(driver, 'getAttribute');
      driver.getAttribute.returns('true');
      await driver.elementEnabled('el1').should.become(true);
      driver.getAttribute.calledWithExactly('enabled', 'el1').should.be.true;
    });
    it('should return false if element not enabled', async () => {
      sandbox.stub(driver, 'getAttribute');
      driver.getAttribute.returns('false');
      await driver.elementEnabled('el1').should.become(false);
      driver.getAttribute.calledWithExactly('enabled', 'el1').should.be.true;
    });
  });
  describe('elementSelected', () => {
    it('should return true if element selected', async () => {
      sandbox.stub(driver, 'getAttribute');
      driver.getAttribute.returns('true');
      await driver.elementSelected('el1').should.become(true);
      driver.getAttribute.calledWithExactly('selected', 'el1').should.be.true;
    });
    it('should return false if element not selected', async () => {
      sandbox.stub(driver, 'getAttribute');
      driver.getAttribute.returns('false');
      await driver.elementSelected('el1').should.become(false);
      driver.getAttribute.calledWithExactly('selected', 'el1').should.be.true;
    });
  });
  describe('setElementValue', () => {
    const params = {elementId: 'el0', text: 'text to set',  replace: true,
                  unicodeKeyboard: true};
    it('should call doSetElementValue', async () => {
      sandbox.stub(driver, 'doSetElementValue');
      await driver.setElementValue('text to set', 'el0', true);
      driver.doSetElementValue.calledWithExactly(params).should.be.true;
    });
    it('should join keys parameter if keys is instance of Array', async () => {
      sandbox.stub(driver, 'doSetElementValue');
      await driver.setElementValue(['t', 'ext', ' to ', 'se', 't'], 'el0', true);
      driver.doSetElementValue.calledWithExactly(params).should.be.true;
    });
    it('should set replace to false by default', async () => {
      params.replace = false;
      sandbox.stub(driver, 'doSetElementValue');
      await driver.setElementValue(['t', 'ext', ' to ', 'se', 't'], 'el0');
      driver.doSetElementValue.calledWithExactly(params).should.be.true;
    });
  });
  describe('doSetElementValue', () => {
    it('should call setText to set element value', async () => {
      await driver.doSetElementValue('params');
      driver.bootstrap.sendAction.calledWithExactly('element:setText',
        'params').should.be.true;
    });
  });
  describe('setValue', () => {
    it('should call setElementValue to set value', async () => {
      sandbox.stub(driver, 'setElementValue');
      await driver.setValue('keys', 'el1');
      driver.setElementValue.calledWithExactly('keys', 'el1', false).should.be.true;
    });
  });
  describe('replaceValue', () => {
    it('should call setElementValue to replace value', async () => {
      sandbox.stub(driver, 'setElementValue');
      await driver.replaceValue('keys', 'el1');
      driver.setElementValue.calledWithExactly('keys', 'el1', true).should.be.true;
    });
  });
  describe('setValueImmediate', () => {
    it('should set value via adb inputText command', async () => {
      sandbox.stub(driver, 'click');
      sandbox.stub(driver.adb, 'inputText');
      await driver.setValueImmediate('keys', 'el1');
      driver.click.calledWithExactly('el1').should.be.true;
      driver.adb.inputText.calledWithExactly('keys').should.be.true;
    });
    it('should join keys parameter if keys is instance of Array', async () => {
      sandbox.stub(driver, 'click');
      sandbox.stub(driver.adb, 'inputText');
      await driver.setValueImmediate(['k', 'ey', 's'], 'el1');
      driver.adb.inputText.calledWithExactly('keys').should.be.true;
    });
  });
  describe('getText', () => {
    it('should get element text', async () => {
      driver.bootstrap.sendAction.withArgs('element:getText').returns('el_text');
      await driver.getText('el1').should.become('el_text');
      driver.bootstrap.sendAction
        .calledWithExactly('element:getText', {elementId: 'el1'})
        .should.be.true;
    });
  });
  describe('clear', () => {
    it('should clear text of an element', async () => {
      sandbox.stub(driver, 'getText');
      sandbox.stub(driver, 'click');
      sandbox.stub(driver.adb, 'clearTextField');
      driver.getText.withArgs('el1').returns('#'.repeat(110));
      await driver.clear('el1');
      driver.getText.calledWithExactly('el1').should.be.true;
      driver.click.calledWithExactly('el1').should.be.true;
      driver.adb.clearTextField.getCall(0).args[0].should.be.equal(50);
      driver.adb.clearTextField.getCall(1).args[0].should.be.equal(50);
      driver.adb.clearTextField.getCall(2).args[0].should.be.equal(10);
    });
    it('should do five retries and then fail if clearTextField throws error', async function () {
      this.timeout(10000);

      sandbox.stub(driver, 'getText');
      sandbox.stub(driver, 'click');
      sandbox.stub(driver.adb, 'clearTextField');
      driver.adb.clearTextField.throws();
      driver.getText.withArgs('el1').returns('#'.repeat(1));
      await driver.clear('el1').should.be.rejected;
      driver.adb.clearTextField.alwaysCalledWith(1).should.be.true;
      driver.adb.clearTextField.callCount.should.be.equal(5);
    });
    it('it should assume that the text have 100 chars if getText returns empty string', async () => {
      sandbox.stub(driver, 'getText');
      sandbox.stub(driver, 'click');
      sandbox.stub(driver.adb, 'clearTextField');
      driver.getText.withArgs('el1').returns('');
      await driver.clear('el1');
      driver.adb.clearTextField.getCall(0).args[0].should.be.equal(50);
      driver.adb.clearTextField.getCall(1).args[0].should.be.equal(50);
    });
  });
  describe('click', () => {
    it('should click an element', async () => {
      await driver.click('el1');
      driver.bootstrap.sendAction.calledWithExactly('element:click', {elementId: 'el1'})
        .should.be.true;
    });
  });
  describe('getLocation', () => {
    it('should get location of an element', async () => {
      driver.bootstrap.sendAction
        .withArgs('element:getLocation').returns('loc_info');
      await driver.getLocation('el1').should.become('loc_info');
      driver.bootstrap.sendAction
        .calledWithExactly('element:getLocation', {elementId: 'el1'})
        .should.be.true;
    });
  });
  describe('getLocationInView', () => {
    it('should get location of an element', async () => {
      sandbox.stub(driver, 'getLocation');
      driver.getLocation.returns('loc_info');
      await driver.getLocationInView('el1').should.become('loc_info');
      driver.getLocation.calledWithExactly('el1').should.be.true;
    });
  });
  describe('getSize', () => {
    it('should get size of an element', async () => {
      driver.bootstrap.sendAction
        .withArgs('element:getSize').returns('size_info');
      await driver.getSize('el1').should.become('size_info');
      driver.bootstrap.sendAction
        .calledWithExactly('element:getSize', {elementId: 'el1'})
        .should.be.true;
    });
  });
  describe('touchLongClick', () => {
    it('should do touch long click on element', async () => {
      let params = {elementId: 'el1', x: 12, y: 34, duration: 5};
      await driver.touchLongClick('el1', 12, 34, 5);
      androidHelpers.removeNullProperties.calledWithExactly(params)
        .should.be.true;
      driver.bootstrap.sendAction.calledWithExactly('element:touchLongClick', params)
        .should.be.true;
    });
  });
  describe('touchDown', () => {
    it('should do touch down on element', async () => {
      let params = {elementId: 'el1', x: 12, y: 34};
      await driver.touchDown('el1', 12, 34);
      androidHelpers.removeNullProperties.calledWithExactly(params)
        .should.be.true;
      driver.bootstrap.sendAction.calledWithExactly('element:touchDown', params)
        .should.be.true;
    });
  });
  describe('touchUp', () => {
    it('should do touch up on element', async () => {
      let params = {elementId: 'el1', x: 12, y: 34};
      await driver.touchUp('el1', 12, 34);
      androidHelpers.removeNullProperties.calledWithExactly(params)
        .should.be.true;
      driver.bootstrap.sendAction.calledWithExactly('element:touchUp', params)
        .should.be.true;
    });
  });
  describe('touchMove', () => {
    it('should get element attribute', async () => {
      let params = {elementId: 'el1', x: 12, y: 34};
      await driver.touchMove('el1', 12, 34);
      androidHelpers.removeNullProperties.calledWithExactly(params)
        .should.be.true;
      driver.bootstrap.sendAction.calledWithExactly('element:touchMove', params)
        .should.be.true;
    });
  });
  describe('complexTap', () => {
    it('should tap an element', async () => {
      await driver.complexTap(null, null, null, 12, 34);
      driver.bootstrap.sendAction.calledWithExactly('click', {x: 12, y:34})
        .should.be.true;
    });
  });
  describe('tap', () => {
    it('shoulde tap an element', async () => {
      await driver.tap('el1', 12, 34, 3);
      driver.bootstrap.sendAction.alwaysCalledWith('element:click',
        {elementId: 'el1', x: 12, y: 34}).should.be.true;
      driver.bootstrap.sendAction.calledThrice.should.be.true;
    });
    it('should tap without an element', async () => {
      await driver.tap(null, 12, 34, 3);
      driver.bootstrap.sendAction.alwaysCalledWith('click', {x: 12, y: 34})
        .should.be.true;
      driver.bootstrap.sendAction.calledThrice.should.be.true;
    });
    it('should perform single tap on element if x, y and count are not passed', async () => {
      await driver.tap('el1');
      driver.bootstrap.sendAction.alwaysCalledWith('element:click').should.be.true;
      driver.bootstrap.sendAction.calledOnce.should.be.true;
    });
  });
});
