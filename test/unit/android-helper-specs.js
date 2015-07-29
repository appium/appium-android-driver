// TODO these tests should be moved along with the implementation to the
// appium-android-driver package or wherever they should live
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import 'mochawait';
import * as helpers from '../../lib/android-helpers';
//import ADB from 'appium-adb';
import { withMocks } from 'appium-test-support';
import * as teen_process from 'teen_process';

const should = chai.should();
chai.use(chaiAsPromised);

describe('Android Helpers', () => {
  //let adb = new ADB();

  describe('parseJavaVersion', () => {
    it('should correctly parse java version', () => {
      helpers.parseJavaVersion(`java version "1.8.0_40"
        Java(TM) SE Runtime Environment (build 1.8.0_40-b27)`).should
        .be.equal("1.8.0_40");
    });
    it('should return null if it cannot parse java verstion', () => {
      should.not.exist(helpers.parseJavaVersion('foo bar'));
    });
  });

  describe('getJavaVersion', withMocks({teen_process}, (mocks) => {
    it('should correctly get java version', async () => {
      mocks.teen_process.expects('exec').withExactArgs('java', ['-version'])
        .returns({stderr: 'java version "1.8.0_40"'});
      (await helpers.getJavaVersion()).should.equal('1.8.0_40');
      mocks.teen_process.verify();
    });
    it('should return null if it cannot parse java verstion', async () => {
      mocks.teen_process.expects('exec').withExactArgs('java', ['-version'])
        .returns({stderr: 'foo bar'});
      await helpers.getJavaVersion().should.eventually.be.rejectedWith('Java');
      mocks.teen_process.verify();
    });
  }));



});
