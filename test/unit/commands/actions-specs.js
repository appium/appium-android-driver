import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import Bootstrap from 'appium-android-bootstrap';
import AndroidDriver from '../../..';

let driver;
let sandbox = sinon.sandbox.create();
chai.should();
chai.use(chaiAsPromised);

describe('Actions', () => {
  before(() => {
    driver = new AndroidDriver();
    driver.bootstrap = new Bootstrap();
    sandbox.stub(driver.bootstrap, 'sendAction');
  });
  after(() => {
    sandbox.restore();
  });
  describe('Swipe', () => {
    it('should swipe an element', () => {
      driver.swipe(0, 0, 1, 1, 0, 1, 'someElementId');
      driver.bootstrap.sendAction.calledWith('element:swipe').should.be.true;
    });
    it('should swipe without an element', () => {
      driver.swipe(0, 0, 1, 1, 0, 1);
      driver.bootstrap.sendAction.calledWith('swipe').should.be.true;
    });
  });
  describe('Flick', () => {
    it('should flick an element', async () => {
      await driver.flick('someElementId', 0, 0, 1, 1, 1);
      driver.bootstrap.sendAction.calledWith('element:flick').should.be.true;
    });
    it('should flick without an element', async () => {
      await driver.flick(null, 0, 0, 1, 1, 1);
      driver.bootstrap.sendAction.calledWith('flick').should.be.true;
    });
  });
  describe('Drag', () => {
    it('should drag an element', () => {
      driver.drag(0, 0, 1, 1, 1, 1, 'someElementId');
      driver.bootstrap.sendAction.calledWith('element:drag').should.be.true;
    });
    it('should drag without an element', () => {
      driver.drag(0, 0, 1, 1, 1, 1);
      driver.bootstrap.sendAction.calledWith('drag').should.be.true;
    });
  });
});
