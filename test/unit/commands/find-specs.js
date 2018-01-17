import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import Bootstrap from 'appium-android-bootstrap';
import AndroidDriver from '../../..';
import { errors } from 'appium-base-driver';

let driver;
let sandbox = sinon.sandbox.create();
chai.should();
chai.use(chaiAsPromised);

describe('Find', function () {
  beforeEach(function () {
    driver = new AndroidDriver();
    driver.bootstrap = new Bootstrap();
    driver.implicitWaitMs = 0;
    sandbox.stub(driver, 'validateLocatorStrategy');
    sandbox.stub(driver.bootstrap, 'sendAction');
    sandbox.stub(driver, 'doFindElementOrEls');
  });
  afterEach(function () {
    sandbox.restore();
  });
  describe('doFindElementOrEls', function () {
    it('should send find action to bootstrap', async function () {
      driver.doFindElementOrEls.restore();
      await driver.doFindElementOrEls('params');
      driver.bootstrap.sendAction.calledWithExactly('find', 'params').should.be.true;
    });
  });
  describe('findElorEls', function () {
    it('should throw an error if there is no selector', async function () {
      await driver.findElOrEls('xpath', null, false, 'some context')
        .should.be.rejectedWith(/provide a selector/);
    });
    it('should be able to find element', async function () {
      let params = {strategy: 'xpath',  selector: '//*[1]', context: 'context', multiple: false};
      driver.doFindElementOrEls.returns('el1');
      await driver.findElOrEls('xpath', '//*[1]', false, 'context').should.become('el1');
      driver.doFindElementOrEls.calledWithExactly(params).should.be.true;
    });
    it('should be able to find elements', async function () {
      let params = {strategy: 'xpath',  selector: '//*[1]', context: 'context', multiple: true};
      driver.doFindElementOrEls.returns(['el1', 'el2']);
      await driver.findElOrEls('xpath', '//*[1]', true, 'context')
        .should.eventually.be.deep.equal(['el1', 'el2']);
      driver.doFindElementOrEls.calledWithExactly(params).should.be.true;
    });
    it('should not throws NoSuchElementError when searching multiple if element does not exist', async function () {
      driver.doFindElementOrEls.returns(null);
      await driver.findElOrEls('xpaht', '//*[1]', true)
        .should.eventually.be.deep.equal([]);
    });
    it('should throws NoSuchElementError if element does not exist', async function () {
      driver.doFindElementOrEls.throws(new Error('An element could not be located'));
      await driver.findElOrEls('xpaht', '//*[1]', false)
        .should.be.rejectedWith(errors.NoSuchElementError);
    });
    it('should fails if locator strategy is not valid', async function () {
      driver.validateLocatorStrategy.throws();
      await driver.findElOrEls().should.be.rejected;
    });
    it('should fails if gets unexpected error', async function () {
      driver.doFindElementOrEls.throws(new Error('unexpected_error'));
      await driver.findElOrEls('x', 'loc').should.be.rejectedWith('unexpected_error');
    });
  });
});
