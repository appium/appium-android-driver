import { fs, tempDir } from 'appium-support';
import log from '../logger';


let commands = {}, helpers = {}, extensions = {};

async function unlinkFile (file) {
  if (await fs.exists(file)) {
    await fs.unlink(file);
  }
}

commands.endCoverage = async function endCoverage (intentToBroadcast, ecOnDevicePath) {
  let localFile = tempDir.path({prefix: 'appium', suffix: '.ec'});
  await unlinkFile(localFile);

  let b64data = '';
  try {
    // ensure the ec we're pulling is newly created as a result of the intent.
    await this.adb.rimraf(ecOnDevicePath);

    await this.adb.broadcastProcessEnd(intentToBroadcast, this.appProcess);

    await this.adb.pull(ecOnDevicePath, localFile);
    let data = await fs.readFile(localFile);
    b64data = Buffer.from(data).toString('base64');
    await unlinkFile(localFile);
  } catch (err) {
    log.debug(`Error ending test coverage: ${err.message}`);
  }
  return b64data;
};


Object.assign(extensions, commands, helpers);
export { commands, helpers };
export default extensions;
