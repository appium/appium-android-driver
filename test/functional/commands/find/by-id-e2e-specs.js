import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../../..';
import DEFAULT_CAPS from '../../desired';


chai.should();
chai.use(chaiAsPromised);

describe('Find - ID', function () {
  let driver;
  before(async function () {
    driver = new AndroidDriver();
    await driver.createSession(DEFAULT_CAPS);
  });
  after(async function () {
    await driver.deleteSession();
  });
  it('should find an element by id', async function () {
    await driver.findElement('id', 'android:id/text1').should.eventually.exist;
  });
  it('should return an array of one element if the `multi` param is true', async function () {
    // TODO: this returns an object instead of an array. Investigate.
    let els = await driver.findElements('id', 'android:id/text1');
    els.should.be.an.instanceof(Array);
    els.should.have.length.above(1);
  });
});
