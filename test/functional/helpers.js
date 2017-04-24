import ADB from 'appium-adb';
import path from 'path';
import { system } from 'appium-support';


const MOCHA_TIMEOUT = process.env.TRAVIS ? 120000 : 15000;

const CHROMEDRIVER_2_20_ASSET_MAP = {
  windows: ['windows', 'chromedriver.exe'],
  mac: ['mac', 'chromedriver'],
  linux32: ['linux-32', 'chromedriver'],
  linux64: ['linux-64', 'chromedriver'],
};

async function getChromedriver220Asset () {
  let basePath = path.resolve(__dirname, '..', '..', '..', 'test', 'assets', 'chromedriver-2.20');
  let dir;
  let cmd;
  if (system.isWindows()) {
    [dir, cmd] = CHROMEDRIVER_2_20_ASSET_MAP.windows;
  } else if (system.isMac()) {
    [dir, cmd] = CHROMEDRIVER_2_20_ASSET_MAP.mac;
  } else {
    [dir, cmd] = CHROMEDRIVER_2_20_ASSET_MAP[`linux${await system.arch()}`];
  }
  return path.resolve(basePath, dir, cmd);
}

async function ensureAVDExists (mochaContext, avdName) {
  let adb = await ADB.createADB();
  try {
    await adb.checkAvdExist(avdName);
  } catch (err) {
    mochaContext.skip();
    return false;
  }
  return true;
}


export { MOCHA_TIMEOUT, ensureAVDExists, getChromedriver220Asset };
