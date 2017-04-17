import ADB from 'appium-adb';


const MOCHA_TIMEOUT = process.env.TRAVIS ? 120000 : 15000;

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

export { MOCHA_TIMEOUT, ensureAVDExists };
