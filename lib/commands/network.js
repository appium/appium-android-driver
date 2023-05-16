import _ from 'lodash';
import { errors } from 'appium/driver';
import { util } from 'appium/support';
import B from 'bluebird';

let commands = {}, helpers = {}, extensions = {};

const AIRPLANE_MODE_MASK = 0b001;
const WIFI_MASK = 0b010;
const DATA_MASK = 0b100;
// The value close to zero, but not zero, is needed
// to trick JSON generation and send a float value instead of an integer,
// This allows strictly-typed clients, like Java, to properly
// parse it. Otherwise float 0.0 is always represented as integer 0 in JS.
// The value must not be greater than DBL_EPSILON (https://opensource.apple.com/source/Libc/Libc-498/include/float.h)
const GEO_EPSILON = Number.MIN_VALUE;
const WIFI_KEY_NAME = 'wifi';
const DATA_KEY_NAME = 'data';
const AIRPLANE_MODE_KEY_NAME = 'airplaneMode';
const SUPPORTED_SERVICE_NAMES = [WIFI_KEY_NAME, DATA_KEY_NAME, AIRPLANE_MODE_KEY_NAME];

commands.getNetworkConnection = async function getNetworkConnection () {
  this.log.info('Getting network connection');
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
commands.isWifiOn = async function isWifiOn () {
  return await this.adb.isWifiOn();
};

/**
 * @typedef {Object} SetConnectivityOptions
 * @property {boolean?} wifi Either to enable or disable Wi-Fi.
 * An unset value means to not change the state for the given service.
 * @property {boolean?} data Either to enable or disable mobile data connection.
 * An unset value means to not change the state for the given service.
 * @property {boolean?} airplaneMode Either to enable to disable the Airplane Mode
 * An unset value means to not change the state for the given service.
 */

/**
 * Set the connectivity state for different services
 *
 * @param {SetConnectivityOptions} opts
 * @throws {Error} If none of known properties were provided or there was an error
 * while changing connectivity states
 */
commands.mobileSetConnectivity = async function mobileSetConnectivity (opts = {}) {
  const {
    wifi,
    data,
    airplaneMode,
  } = opts;

  if (_.every([wifi, data, airplaneMode], _.isUndefined)) {
    throw new errors.InvalidArgumentError(
      `Either one of ${JSON.stringify(SUPPORTED_SERVICE_NAMES)} options must be provided`
    );
  }

  const currentState = await this.mobileGetConnectivity({
    services: [
      ...(_.isUndefined(wifi) ? [] : [WIFI_KEY_NAME]),
      ...(_.isUndefined(data) ? [] : [DATA_KEY_NAME]),
      ...(_.isUndefined(airplaneMode) ? [] : [AIRPLANE_MODE_KEY_NAME]),
    ]
  });
  const setters = [];
  if (!_.isUndefined(wifi) && currentState.wifi !== Boolean(wifi)) {
    setters.push(this.adb.setWifiState(wifi, this.isEmulator()));
  }
  if (!_.isUndefined(data) && currentState.data !== Boolean(data)) {
    setters.push(this.adb.setDataState(data, this.isEmulator()));
  }
  if (!_.isUndefined(airplaneMode) && currentState.airplaneMode !== Boolean(airplaneMode)) {
    setters.push(async () => {
      await this.adb.setAirplaneMode(airplaneMode);
      if (this.adb.getApiLevel() < 30) {
        await this.adb.broadcastAirplaneMode(airplaneMode);
      }
    });
  }
  if (!_.isEmpty(setters)) {
    await B.all(setters);
  }
};

/**
 * @typedef {Object} GetConnectivityResult
 * @property {boolean} wifi True if wifi is enabled
 * @property {boolean} data True if mobile data connection is enabled
 * @property {boolean} airplaneMode True if Airplane Mode is enabled
 */

/**
 * @typedef {Object} GetConnectivityOptions
 * @property {string[]|string?} services one or more services to get the connectivity for.
 * Supported service names are: wifi, data, airplaneMode.
 */

/**
 * Retrieves the connectivity properties from the device under test
 *
 * @param {GetConnectivityOptions?} opts If no service names are provided then the
 * connectivity state is returned for all of them.
 * @returns {GetConnectivityResult}
 */
commands.mobileGetConnectivity = async function mobileGetConnectivity (opts = {}) {
  let {
    services = SUPPORTED_SERVICE_NAMES,
  } = opts;
  if (!_.isArray(services)) {
    services = [services];
  }
  const unsupportedServices = _.difference(services, SUPPORTED_SERVICE_NAMES);
  if (!_.isEmpty(unsupportedServices)) {
    throw new errors.InvalidArgumentError(
      `${util.pluralize('Service name', unsupportedServices.length, false)} ${unsupportedServices} ` +
      `${unsupportedServices.length === 1 ? 'is' : 'are'} not known. Only the following services are ` +
      `suported: ${SUPPORTED_SERVICE_NAMES}`
    );
  }

  const statePromises = {
    wifi: B.resolve(services.includes(WIFI_KEY_NAME) ? this.adb.isWifiOn() : undefined),
    data: B.resolve(services.includes(DATA_KEY_NAME) ? this.adb.isDataOn() : undefined),
    airplaneMode: B.resolve(
      services.includes(AIRPLANE_MODE_KEY_NAME) ? this.adb.isAirplaneModeOn() : undefined
    ),
  };
  await B.all(_.values(statePromises));
  return _.fromPairs(services.map((k) => [k, statePromises[k].value()]));
};

commands.setNetworkConnection = async function setNetworkConnection (type) {
  this.log.info('Setting network connection');
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
      if (await this.adb.getApiLevel() < 30) {
        await this.adb.broadcastAirplaneMode(shouldEnableAirplaneMode);
      }
    });
  } else {
    this.log.info(
      `Not changing airplane mode, since it is already ${shouldEnableAirplaneMode ? 'enabled' : 'disabled'}`
    );
  }

  if (shouldEnableWifi === isWiFiEnabled && shouldEnableDataConnection === isDataEnabled) {
    this.log.info('Not changing data connection/Wi-Fi states, since they are already set to expected values');
    if (await this.adb.isAirplaneModeOn()) {
      return AIRPLANE_MODE_MASK | currentState;
    }
    return ~AIRPLANE_MODE_MASK & currentState;
  }

  await this.wrapBootstrapDisconnect(async () => {
    if (shouldEnableWifi !== isWiFiEnabled) {
      await this.setWifiState(shouldEnableWifi);
    } else {
      this.log.info(`Not changing Wi-Fi state, since it is already ` +
        `${shouldEnableWifi ? 'enabled' : 'disabled'}`);
    }

    if (shouldEnableAirplaneMode) {
      this.log.info('Not changing data connection state, because airplane mode is enabled');
    } else if (shouldEnableDataConnection === isDataEnabled) {
      this.log.info(`Not changing data connection state, since it is already ` +
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
commands.setWifiState = async function setWifiState (wifi) {
  await this.adb.setWifiState(wifi, this.isEmulator());
};

commands.toggleData = async function toggleData () {
  let data = !(await this.adb.isDataOn());
  this.log.info(`Turning network data ${data ? 'on' : 'off'}`);
  await this.wrapBootstrapDisconnect(async () => {
    await this.adb.setWifiAndData({data}, this.isEmulator());
  });
};

commands.toggleWiFi = async function toggleWiFi () {
  let wifi = !(await this.adb.isWifiOn());
  this.log.info(`Turning WiFi ${wifi ? 'on' : 'off'}`);
  await this.wrapBootstrapDisconnect(async () => {
    await this.adb.setWifiAndData({wifi}, this.isEmulator());
  });
};

commands.toggleFlightMode = async function toggleFlightMode () {
  /*
   * TODO: Implement isRealDevice(). This method fails on
   * real devices, it should throw a NotYetImplementedError
   */
  let flightMode = !(await this.adb.isAirplaneModeOn());
  this.log.info(`Turning flight mode ${flightMode ? 'on' : 'off'}`);
  await this.wrapBootstrapDisconnect(async () => {
    await this.adb.setAirplaneMode(flightMode);
  });
  await this.wrapBootstrapDisconnect(async () => {
    if (await this.adb.getApiLevel() < 30) {
      await this.adb.broadcastAirplaneMode(flightMode);
    }
  });
};

commands.setGeoLocation = async function setGeoLocation (location) {
  await this.adb.setGeoLocation(location, this.isEmulator());
  try {
    return await this.getGeoLocation();
  } catch (e) {
    this.log.warn(`Could not get the current geolocation info: ${e.message}`);
    this.log.warn(`Returning the default zero'ed values`);
    return {
      latitude: GEO_EPSILON,
      longitude: GEO_EPSILON,
      altitude: GEO_EPSILON,
    };
  }
};

/**
 * @typedef {Object} GpsCacheRefreshOptions
 * @property {number} timeoutMs [20000] The maximum number of milliseconds
 * to block until GPS cache is refreshed. Providing zero or a negative
 * value to it skips waiting completely.
 */

/**
 * Sends an async request to refresh the GPS cache.
 * This feature only works if the device under test has
 * Google Play Services installed. In case the vanilla
 * LocationManager is used the device API level must be at
 * version 30 (Android R) or higher.
 *
 * @param {GpsCacheRefreshOptions} opts
 */
commands.mobileRefreshGpsCache = async function mobileRefreshGpsCache (opts = {}) {
  const { timeoutMs } = opts;
  await this.adb.refreshGeoLocationCache(timeoutMs);
};

commands.getGeoLocation = async function getGeoLocation () {
  const {latitude, longitude, altitude} = await this.adb.getGeoLocation();
  return {
    latitude: parseFloat(latitude) || GEO_EPSILON,
    longitude: parseFloat(longitude) || GEO_EPSILON,
    altitude: parseFloat(altitude) || GEO_EPSILON,
  };
};

/**
 * Checks if GPS is enabled
 *
 * @returns {Promise<Boolean>} True if yes
 */
commands.isLocationServicesEnabled = async function iLocationServicesEnabled () {
  return (await this.adb.getLocationProviders()).includes('gps');
};

/**
 * Toggles GPS state
 */
commands.toggleLocationServices = async function toggleLocationServices () {
  this.log.info('Toggling location services');
  const isGpsEnabled = await this.isLocationServicesEnabled();
  this.log.debug(
    `Current GPS state: ${isGpsEnabled}. ` +
    `The service is going to be ${isGpsEnabled ? 'disabled' : 'enabled'}`
  );
  await this.adb.toggleGPSLocationProvider(!isGpsEnabled);
};

helpers.wrapBootstrapDisconnect = async function wrapBootstrapDisconnect (wrapped) {
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
