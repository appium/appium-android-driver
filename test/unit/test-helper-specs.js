import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { withMocks } from 'appium-test-support';
import { system } from 'appium-support';
import path from 'path';
import { getChromedriver220Asset } from '../functional/helpers';


chai.should();
chai.use(chaiAsPromised);

describe('test helpers', () => {
  describe('getChromedriver220Asset', withMocks({system}, (mocks) => {
    let basePath = path.resolve(__dirname, '..', '..', '..');

    it('should get the correct path for Windows', async function () {
      mocks.system.expects('isWindows').once().returns(true);
      let cdPath = await getChromedriver220Asset();
      cdPath.should.eql(`${basePath}/test/assets/chromedriver-2.20/windows/chromedriver.exe`);
      mocks.system.verify();
    });
    it('should get the correct path for Mac', async function () {
      mocks.system.expects('isWindows').once().returns(false);
      mocks.system.expects('isMac').once().returns(true);
      let cdPath = await getChromedriver220Asset();
      cdPath.should.eql(`${basePath}/test/assets/chromedriver-2.20/mac/chromedriver`);
      mocks.system.verify();
    });
    it('should get the correct path for Unix 32-bit', async function () {
      mocks.system.expects('isWindows').once().returns(false);
      mocks.system.expects('isMac').once().returns(false);
      mocks.system.expects('arch').once().returns('32');
      let cdPath = await getChromedriver220Asset();
      cdPath.should.eql(`${basePath}/test/assets/chromedriver-2.20/linux-32/chromedriver`);
      mocks.system.verify();
    });
    it('should get the correct path for Unix 64-bit', async function () {
      mocks.system.expects('isWindows').once().returns(false);
      mocks.system.expects('isMac').once().returns(false);
      mocks.system.expects('arch').once().returns('64');
      let cdPath = await getChromedriver220Asset();
      cdPath.should.eql(`${basePath}/test/assets/chromedriver-2.20/linux-64/chromedriver`);
      mocks.system.verify();
    });
  }));
});
