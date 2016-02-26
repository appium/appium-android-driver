import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import Bootstrap from 'appium-android-bootstrap';
import AndroidDriver from '../../..';

let driver;
let sandbox = sinon.sandbox.create();
chai.should();
chai.use(chaiAsPromised);

describe('Element', () => {
  describe('Tap', () => {
    beforeEach(() => {
      driver = new AndroidDriver();
      driver.bootstrap = new Bootstrap();
      sandbox.stub(driver.bootstrap, 'sendAction');
    });
    afterEach(() => {
      sandbox.restore();
    });
    it('should tap an element', () => {
      driver.tap('someElementId');
      driver.bootstrap.sendAction.calledWith('element:click').should.be.true;
    });
    it('should tap without an element', () => {
      driver.tap(null);
      driver.bootstrap.sendAction.calledWith('click').should.be.true;
    });
  });
});
