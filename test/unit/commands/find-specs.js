import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import Bootstrap from 'appium-android-bootstrap';
import AndroidDriver from '../../..';

let driver;
let sandbox = sinon.sandbox.create();
chai.should();
chai.use(chaiAsPromised);

describe('Find', () => {
  before(() => {
    driver = new AndroidDriver();
    driver.bootstrap = new Bootstrap();
    sandbox.stub(driver, 'validateLocatorStrategy');
    sandbox.stub(driver.bootstrap, 'sendAction');
  });
  after(() => {
    sandbox.restore();
  });
  describe('findElorEls', () => {
    it('should throw an error if both strategy and context are defined', () => {
      driver.findElOrEls('xpath', 'selector', false, 'some context').should.be.rejectedWith(/from an element/);
    });
    it('should throw an error if there is no selector', () => {
      driver.findElOrEls('xpath', null, false, 'some context').should.be.rejectedWith(/provide a selector/);
    });
  });
});
