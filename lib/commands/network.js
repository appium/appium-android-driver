import log from '../logger';
import _ from 'lodash';
import { errors } from 'appium-base-driver';
import B from 'bluebird';

let commands = {}, helpers = {}, extensions = {};

commands.getNetworkConnection = async function () {
  log.info("Getting network connection");
  let airplaneModeOn = await this.adb.isAirplaneModeOn();
  let connection = airplaneModeOn ? 1 : 0;

  // no need to check anything else if we are in airplane mode
  if (!airplaneModeOn) {
    let wifiOn = await this.isWifiOn();
    connection += (wifiOn ? 2 : 0);
    let dataOn = await this.adb.isDataOn();
    connection += (dataOn ? 4 : 0);
  }

  return connection;
};

/**
 * decoupling to override the behaviour in other drivers like UiAutomator2.
 */
commands.isWifiOn = async function() {
  return await this.adb.isWifiOn();
};

commands.setNetworkConnection = async function (type) {
  log.info("Setting network connection");
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
      await this.setWifiState(wifi);
      await this.adb.setDataState(data, this.isEmulator());
    });
  }

  return await this.getNetworkConnection();
};

/**
 * decoupling to override behaviour in other drivers like UiAutomator2.
 */
commands.setWifiState = async function(wifi) {
  await this.adb.setWifiState(wifi, this.isEmulator());
};

commands.toggleData = async function () {
  let data = !(await this.adb.isDataOn());
  log.info(`Turning network data ${data ? 'on' : 'off'}`);
  await this.wrapBootstrapDisconnect(async () => {
    await this.adb.setWifiAndData({data}, this.isEmulator());
  });
};

commands.toggleWiFi = async function () {
  let wifi = !(await this.adb.isWifiOn());
  log.info(`Turning WiFi ${wifi ? 'on' : 'off'}`);
  await this.wrapBootstrapDisconnect(async () => {
    await this.adb.setWifiAndData({wifi}, this.isEmulator());
  });
};

commands.toggleFlightMode = async function () {
  /*
   * TODO: Implement isRealDevice(). This method fails on
   * real devices, it should throw a NotYetImplementedError
   */
  let flightMode = !(await this.adb.isAirplaneModeOn());
  log.info(`Turning flight mode ${flightMode ? 'on' : 'off'}`);
  await this.wrapBootstrapDisconnect(async () => {
    await this.adb.setAirplaneMode(flightMode);
  });
  await this.wrapBootstrapDisconnect(async () => {
    await this.adb.broadcastAirplaneMode(flightMode);
  });
};

commands.setGeoLocation = async function (location) {
  return await this.adb.setGeoLocation(location, this.isEmulator());
};

commands.toggleLocationServices = async function () {
  log.info("Toggling location services");
  let api = await this.adb.getApiLevel();

  if (api > 15) {
    let seq = [19, 19]; // up, up
    if (api === 16) {
      // This version of Android has a "parent" button in its action bar
      seq.push(20); // down
    } else if (api >= 19) {
      // Newer versions of Android have the toggle in the Action bar
      seq = [22, 22, 19]; // right, right, up
      /*
       * Once the Location services switch is OFF, it won't receive focus
       * when going back to the Location Services settings screen unless we
       * send a dummy keyevent (UP) *before* opening the settings screen
       */
      await this.adb.keyevent(19);
    }
    await this.toggleSetting('LOCATION_SOURCE_SETTINGS', seq);
  } else {
    // There's no global location services toggle on older Android versions
    throw new errors.NotYetImplementedError();
  }
};

helpers.toggleSetting = async function (setting, preKeySeq) {
  /*
   * preKeySeq is the keyevent sequence to send over ADB in order
   * to position the cursor on the right option.
   * By default it's [up, up, down] because we usually target the 1st item in
   * the screen, and sometimes when opening settings activities the cursor is
   * already positionned on the 1st item, but we can't know for sure
   */
  if (_.isNull(preKeySeq)) {
    preKeySeq = [19, 19, 20]; // up, up, down
  }

  await this.openSettingsActivity(setting);

  for (let key of preKeySeq) {
    await this.doKey(key);
  }

  let {appPackage, appActivity} = await this.adb.getFocusedPackageAndActivity();

  /*
   * Click and handle potential ADB disconnect that occurs on official
   * emulator when the network connection is disabled
   */
  await this.wrapBootstrapDisconnect(async () => {
    await this.doKey(23);
  });

  /*
   * In one particular case (enable Location Services), a pop-up is
   * displayed on some platforms so the user accepts or refuses that Google
   * collects location data. So we wait for that pop-up to open, if it
   * doesn't then proceed
   */
  try {
    await this.adb.waitForNotActivity(appPackage, appActivity, 5000);
    await this.doKey(22); // right
    await this.doKey(23); // click
    await this.adb.waitForNotActivity(appPackage, appActivity, 5000);
  } catch (ign) {}

  await this.adb.back();
};

helpers.doKey = async function (key) {
  // TODO: Confirm we need this delay. Seems to work without it.
  await B.delay(2000);
  await this.adb.keyevent(key);
};

helpers.wrapBootstrapDisconnect = async function (wrapped) {
  this.bootstrap.ignoreUnexpectedShutdown = true;
  try {
    await wrapped();
    await this.adb.restart();
    await this.bootstrap.start(this.opts.appPackage, this.opts.disableAndroidWatchers, this.opts.acceptSslCerts);
  } finally {
    this.bootstrap.ignoreUnexpectedShutdown = false;
  }
};

Object.assign(extensions, commands, helpers);
export { commands, helpers };
export default extensions;
