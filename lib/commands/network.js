import log from '../logger';
import _ from 'lodash';
import { errors } from 'appium-base-driver';
import B from 'bluebird';
import { util } from 'appium-support';

let commands = {}, helpers = {}, extensions = {};

const AIRPLANE_MODE_MASK = 0b001;
const WIFI_MASK = 0b010;
const DATA_MASK = 0b100;

commands.getNetworkConnection = async function () {
  log.info("Getting network connection");
  let airplaneModeOn = await this.adb.isAirplaneModeOn();
  let connection = airplaneModeOn ? AIRPLANE_MODE_MASK : 0;

  // no need to check anything else if we are in airplane mode
  if (!airplaneModeOn) {
    let wifiOn = await this.isWifiOn();
    connection |= (wifiOn ? WIFI_MASK : 0);
    let dataOn = await this.adb.isDataOn();
    connection |= (dataOn ? DATA_MASK : 0);
  }

  return connection;
};

/**
 * decoupling to override the behaviour in other drivers like UiAutomator2.
 */
commands.isWifiOn = async function () {
  return await this.adb.isWifiOn();
};

commands.setNetworkConnection = async function (type) {
  log.info("Setting network connection");
  // decode the input
  const shouldEnableAirplaneMode = (type & AIRPLANE_MODE_MASK) !== 0;
  const shouldEnableWifi = (type & WIFI_MASK) !== 0;
  const shouldEnableDataConnection = (type & DATA_MASK) !== 0;

  const currentState = await this.getNetworkConnection();
  const isAirplaneModeEnabled = (currentState & AIRPLANE_MODE_MASK) !== 0;
  const isWiFiEnabled = (currentState & WIFI_MASK) !== 0;
  const isDataEnabled = (currentState & DATA_MASK) !== 0;

  if (shouldEnableAirplaneMode !== isAirplaneModeEnabled) {
    await this.wrapBootstrapDisconnect(async () => {
      await this.adb.setAirplaneMode(shouldEnableAirplaneMode);
    });
    await this.wrapBootstrapDisconnect(async () => {
      await this.adb.broadcastAirplaneMode(shouldEnableAirplaneMode);
    });
  } else {
    log.info(`Not changing airplane mode, since it is already ` +
             `${shouldEnableAirplaneMode ? 'enabled' : 'disabled'}`);
  }

  if (shouldEnableWifi === isWiFiEnabled && shouldEnableDataConnection === isDataEnabled) {
    log.info('Not changing data connection/Wi-Fi states, since they are already set to expected values');
    if (await this.adb.isAirplaneModeOn()) {
      return AIRPLANE_MODE_MASK | currentState;
    }
    return ~AIRPLANE_MODE_MASK & currentState;
  }

  await this.wrapBootstrapDisconnect(async () => {
    if (shouldEnableWifi !== isWiFiEnabled) {
      await this.setWifiState(shouldEnableWifi);
    } else {
      log.info(`Not changing Wi-Fi state, since it is already ` +
               `${shouldEnableWifi ? 'enabled' : 'disabled'}`);
    }

    if (shouldEnableAirplaneMode) {
      log.info('Not changing data connection state, because airplane mode is enabled');
    } else if (shouldEnableDataConnection === isDataEnabled) {
      log.info(`Not changing data connection state, since it is already ` +
               `${shouldEnableDataConnection ? 'enabled' : 'disabled'}`);
    } else {
      await this.adb.setDataState(shouldEnableDataConnection, this.isEmulator());
    }
  });

  return await this.getNetworkConnection();
};

/**
 * decoupling to override behaviour in other drivers like UiAutomator2.
 */
commands.setWifiState = async function (wifi) {
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
  await this.adb.setGeoLocation(location, this.isEmulator());
  return await this.getGeoLocation();
};

commands.getGeoLocation = async function () {
  const {latitude, longitude, altitude} = await this.adb.getGeoLocation();
  return {
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude),
    altitude: parseFloat(util.hasValue(altitude) ? altitude : 0),
  };
};

commands.toggleLocationServices = async function () {
  log.info("Toggling location services");
  let api = await this.adb.getApiLevel();
  if (this.isEmulator()) {
    let providers = await this.adb.getLocationProviders();
    let isGpsEnabled = providers.indexOf('gps') !== -1;
    await this.adb.toggleGPSLocationProvider(!isGpsEnabled);
    return;
  }

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
  if (!this.bootstrap) {
    return await wrapped();
  }

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
