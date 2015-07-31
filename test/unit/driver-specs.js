import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import 'mochawait';
//import * as helpers from '../../lib/android-helpers';
//import ADB from 'appium-adb';
//import { withMocks } from 'appium-test-support';
import { AndroidDriver } from '../../..';

/*const should = */chai.should();
chai.use(chaiAsPromised);

describe('driver', () => {
  describe('constructor', () => {
    it('calls BaseDriver constructor with opts', () => {
      let driver = new AndroidDriver({foo: 'bar'});
      driver.should.exist;
      driver.opts.foo.should.equal('bar');
    });
  });
});
