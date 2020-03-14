import log from '../logger';


const commands = {};


commands.endCoverage = async function endCoverage (intentToBroadcast, ecOnDevicePath) {
  try {
    // ensure the ec we're pulling is newly created as a result of the intent.
    await this.adb.rimraf(ecOnDevicePath);
    await this.adb.broadcastProcessEnd(intentToBroadcast, this.appProcess);
    return await this.pullFile(ecOnDevicePath);
  } catch (err) {
    log.warn(`Error ending test coverage: ${err.message}`);
  }
  return '';
};


export { commands };
export default commands;
