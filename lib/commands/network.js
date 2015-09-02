import log from '../logger';

let commands = {}, helpers = {}, extensions = {};

commands.getNetworkConnection = async function () {
  log.info('Getting network connection');
  let airplaneModeOn = await this.adb.isAirplaneModeOn();
  let connection = airplaneModeOn ? 1 : 0;

  // no need to check anything else if we are in airplane mode
  if (!airplaneModeOn) {
    let wifiOn = await this.adb.isWifiOn();
    connection += (wifiOn ? 2 : 0);
    let dataOn = await this.adb.isDataOn();
    connection += (dataOn ? 4 : 0);
  }

  return connection;
};

commands.setNetworkConnection = async function (type) {
  log.info('Setting network connection');
  // decode the input
  let airplaneMode = type % 2;
  type >>= 1;
  let wifi = type % 2;
  type >>= 1;
  let data = type % 2;

  await this.wrapBootstrapDisconnect(async () => {
    await this.adb.setAirplaneMode(airplaneMode);
  });
  await this.wrapBootstrapDisconnect(async () => {
    await this.adb.broadcastAirplaneMode(airplaneMode);
  });
  if (!airplaneMode) {
    await this.wrapBootstrapDisconnect(async () => {
      await this.adb.setWifiAndData({wifi, data});
    });    
  }

  return await this.getNetworkConnection();
};

helpers.wrapBootstrapDisconnect = async function (wrapped) {
  this.ignoreUnexpectedShutdown = true;
  await wrapped();
  await this.adb.restart();
  await this.bootstrap.start(this.opts.appPackage, this.opts.disableAndroidWatchers);
  this.ignoreUnexpectedShutdown = false;
};

Object.assign(extensions, commands, helpers);
export { commands, helpers };
export default extensions;
