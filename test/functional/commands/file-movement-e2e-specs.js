import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import AndroidDriver from '../../..';
import _ from 'lodash';
import DEFAULT_CAPS from '../desired';
import { fs, tempDir, zip } from 'appium-support';
import path from 'path';

chai.should();
chai.use(chaiAsPromised);

let caps = _.defaults({
  autoLaunch: false
}, DEFAULT_CAPS);

describe('file movement', function () {
  let driver;
  before(async function () {
    driver = new AndroidDriver();
    await driver.createSession(caps);
  });
  after(async function () {
    await driver.deleteSession();
  });

  function getRandomDir () {
    return `/data/local/tmp/test${Math.random()}`;
  }

  it('should push and pull a file', async function () {
    let stringData = `random string data ${Math.random()}`;
    let base64Data = Buffer.from(stringData).toString('base64');
    let remotePath = `${getRandomDir()}/remote.txt`;

    await driver.pushFile(remotePath, base64Data);

    // get the file and its contents, to check
    let remoteData64 = await driver.pullFile(remotePath);
    let remoteData = Buffer.from(remoteData64, 'base64').toString();
    remoteData.should.equal(stringData);
  });

  it('should delete pushed file', async function () {
    let stringData = `random string data ${Math.random()}`;
    let base64Data = Buffer.from(stringData).toString('base64');
    let remotePath = `${getRandomDir()}/remote.txt`;

    await driver.pushFile(remotePath, base64Data);

    (await driver.execute('mobile: deleteFile', {remotePath})).should.be.true;
    // The file should be already gone
    (await driver.execute('mobile: deleteFile', {remotePath})).should.be.false;
  });

  it('should pull a folder', async function () {
    const stringData = `random string data ${Math.random()}`;
    const base64Data = Buffer.from(stringData).toString('base64');

    // send the files, then pull the whole folder
    const remoteDir = getRandomDir();
    await driver.pushFile(`${remoteDir}/remote0.txt`, base64Data);
    await driver.pushFile(`${remoteDir}/remote1.txt`, base64Data);
    const data = await driver.pullFolder(remoteDir);

    const tmpRoot = await tempDir.openDir();
    try {
      const zipPath = path.resolve(tmpRoot, 'data.zip');
      await fs.writeFile(zipPath, Buffer.from(data, 'base64'));
      const extractedDataPath = path.resolve(tmpRoot, 'extracted_data');
      await fs.mkdir(extractedDataPath);
      await zip.extractAllTo(zipPath, extractedDataPath);
      const itemsCount = (await fs.readdir(extractedDataPath)).length;
      itemsCount.should.eql(2);
    } finally {
      await fs.rimraf(tmpRoot);
    }
  });
});
