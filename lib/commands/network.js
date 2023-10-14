// @ts-check

import {mixin} from './mixins';
import _ from 'lodash';
import {errors} from 'appium/driver';
import {util} from 'appium/support';
import B from 'bluebird';

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
const SUPPORTED_SERVICE_NAMES = /** @type {const} */ ([
  WIFI_KEY_NAME,
  DATA_KEY_NAME,
  AIRPLANE_MODE_KEY_NAME,
]);

/**
 * @type {import('./mixins').NetworkMixin & ThisType<import('../driver').AndroidDriver>}
 * @satisfies {import('@appium/types').ExternalDriver}
 */
const NetworkMixin = {
  async getNetworkConnection() {
    const adb = /** @type {ADB} */ (this.adb);
    this.log.info('Getting network connection');
    let airplaneModeOn = await adb.isAirplaneModeOn();
    let connection = airplaneModeOn ? AIRPLANE_MODE_MASK : 0;

    // no need to check anything else if we are in airplane mode
    if (!airplaneModeOn) {
      let wifiOn = await this.isWifiOn();
      connection |= wifiOn ? WIFI_MASK : 0;
      let dataOn = await adb.isDataOn();
      connection |= dataOn ? DATA_MASK : 0;
    }

    return connection;
  },

  async isWifiOn() {
    return await /** @type {ADB} */ (this.adb).isWifiOn();
  },

  async mobileSetConnectivity(opts = {}) {
    const {wifi, data, airplaneMode} = opts;
    const adb = /** @type {ADB} */ (this.adb);
    if (_.every([wifi, data, airplaneMode], _.isUndefined)) {
      throw new errors.InvalidArgumentError(
        `Either one of ${JSON.stringify(SUPPORTED_SERVICE_NAMES)} options must be provided`
      );
    }

    const currentState = await this.mobileGetConnectivity({
      services: /** @type {import('./types').ServiceType[]} */ ([
        ...(_.isUndefined(wifi) ? [] : [WIFI_KEY_NAME]),
        ...(_.isUndefined(data) ? [] : [DATA_KEY_NAME]),
        ...(_.isUndefined(airplaneMode) ? [] : [AIRPLANE_MODE_KEY_NAME]),
      ]),
    });
    /** @type {(Promise<any>|(() => Promise<any>))[]} */
    const setters = [];
    if (!_.isUndefined(wifi) && currentState.wifi !== Boolean(wifi)) {
      setters.push(adb.setWifiState(wifi, this.isEmulator()));
    }
    if (!_.isUndefined(data) && currentState.data !== Boolean(data)) {
      setters.push(adb.setDataState(data, this.isEmulator()));
    }
    if (!_.isUndefined(airplaneMode) && currentState.airplaneMode !== Boolean(airplaneMode)) {
      setters.push(async () => {
        await adb.setAirplaneMode(airplaneMode);
        if ((await adb.getApiLevel()) < 30) {
          await adb.broadcastAirplaneMode(airplaneMode);
        }
      });
    }
    if (!_.isEmpty(setters)) {
      await B.all(setters);
    }
  },

  async mobileGetConnectivity(opts = {}) {
    let {services = SUPPORTED_SERVICE_NAMES} = opts;
    const svcs = _.castArray(services);
    const unsupportedServices = _.difference(services, SUPPORTED_SERVICE_NAMES);
    if (!_.isEmpty(unsupportedServices)) {
      throw new errors.InvalidArgumentError(
        `${util.pluralize(
          'Service name',
          unsupportedServices.length,
          false
        )} ${unsupportedServices} ` +
          `${
            unsupportedServices.length === 1 ? 'is' : 'are'
          } not known. Only the following services are ` +
          `suported: ${SUPPORTED_SERVICE_NAMES}`
      );
    }
    const adb = /** @type {ADB} */ (this.adb);

    const statePromises = {
      wifi: B.resolve(svcs.includes(WIFI_KEY_NAME) ? adb.isWifiOn() : undefined),
      data: B.resolve(svcs.includes(DATA_KEY_NAME) ? adb.isDataOn() : undefined),
      airplaneMode: B.resolve(
        svcs.includes(AIRPLANE_MODE_KEY_NAME) ? adb.isAirplaneModeOn() : undefined
      ),
    };
    await B.all(_.values(statePromises));
    return {
      wifi: Boolean(statePromises.wifi.value()),
      data: Boolean(statePromises.data.value()),
      airplaneMode: Boolean(statePromises.airplaneMode.value()),
    };
  },

  async setNetworkConnection(type) {
    this.log.info('Setting network connection');
    // decode the input
    const shouldEnableAirplaneMode = (type & AIRPLANE_MODE_MASK) !== 0;
    const shouldEnableWifi = (type & WIFI_MASK) !== 0;
    const shouldEnableDataConnection = (type & DATA_MASK) !== 0;

    const currentState = await this.getNetworkConnection();
    const isAirplaneModeEnabled = (currentState & AIRPLANE_MODE_MASK) !== 0;
    const isWiFiEnabled = (currentState & WIFI_MASK) !== 0;
    const isDataEnabled = (currentState & DATA_MASK) !== 0;

    const adb = /** @type {ADB} */ (this.adb);
    if (shouldEnableAirplaneMode !== isAirplaneModeEnabled) {
      await adb.setAirplaneMode(shouldEnableAirplaneMode);
      if ((await adb.getApiLevel()) < 30) {
        await adb.broadcastAirplaneMode(shouldEnableAirplaneMode);
      }
    } else {
      this.log.info(
        `Not changing airplane mode, since it is already ${
          shouldEnableAirplaneMode ? 'enabled' : 'disabled'
        }`
      );
    }

    if (shouldEnableWifi === isWiFiEnabled && shouldEnableDataConnection === isDataEnabled) {
      this.log.info(
        'Not changing data connection/Wi-Fi states, since they are already set to expected values'
      );
      if (await adb.isAirplaneModeOn()) {
        return AIRPLANE_MODE_MASK | currentState;
      }
      return ~AIRPLANE_MODE_MASK & currentState;
    }

    if (shouldEnableWifi !== isWiFiEnabled) {
      await this.setWifiState(shouldEnableWifi);
    } else {
      this.log.info(
        `Not changing Wi-Fi state, since it is already ` +
          `${shouldEnableWifi ? 'enabled' : 'disabled'}`
      );
    }

    if (shouldEnableAirplaneMode) {
      this.log.info('Not changing data connection state, because airplane mode is enabled');
    } else if (shouldEnableDataConnection === isDataEnabled) {
      this.log.info(
        `Not changing data connection state, since it is already ` +
          `${shouldEnableDataConnection ? 'enabled' : 'disabled'}`
      );
    } else {
      await adb.setDataState(shouldEnableDataConnection, this.isEmulator());
    }

    return await this.getNetworkConnection();
  },

  async setWifiState(wifi) {
    await /** @type {ADB} */ (this.adb).setWifiState(wifi, this.isEmulator());
  },

  async toggleData() {
    const adb = /** @type {ADB} */ (this.adb);
    let data = !(await adb.isDataOn());
    this.log.info(`Turning network data ${data ? 'on' : 'off'}`);
    await adb.setWifiAndData({data}, this.isEmulator());
  },

  async toggleWiFi() {
    const adb = /** @type {ADB} */ (this.adb);
    let wifi = !(await adb.isWifiOn());
    this.log.info(`Turning WiFi ${wifi ? 'on' : 'off'}`);
    await adb.setWifiAndData({wifi}, this.isEmulator());
  },

  async toggleFlightMode() {
    const adb = /** @type {ADB} */ (this.adb);
    /*
     * TODO: Implement isRealDevice(). This method fails on
     * real devices, it should throw a NotYetImplementedError
     */
    let flightMode = !(await adb.isAirplaneModeOn());
    this.log.info(`Turning flight mode ${flightMode ? 'on' : 'off'}`);
    await adb.setAirplaneMode(flightMode);
    if ((await adb.getApiLevel()) < 30) {
      await adb.broadcastAirplaneMode(flightMode);
    }
  },

  async setGeoLocation(location) {
    await /** @type {ADB} */ (this.adb).setGeoLocation(location, this.isEmulator());
    try {
      return await this.getGeoLocation();
    } catch (e) {
      this.log.warn(
        `Could not get the current geolocation info: ${/** @type {Error} */ (e).message}`
      );
      this.log.warn(`Returning the default zero'ed values`);
      return {
        latitude: GEO_EPSILON,
        longitude: GEO_EPSILON,
        altitude: GEO_EPSILON,
      };
    }
  },

  async mobileRefreshGpsCache(opts = {}) {
    const {timeoutMs} = opts;
    await /** @type {ADB} */ (this.adb).refreshGeoLocationCache(timeoutMs);
  },

  async getGeoLocation() {
    const {latitude, longitude, altitude} = await /** @type {ADB} */ (this.adb).getGeoLocation();
    return {
      latitude: parseFloat(String(latitude)) || GEO_EPSILON,
      longitude: parseFloat(String(longitude)) || GEO_EPSILON,
      altitude: parseFloat(String(altitude)) || GEO_EPSILON,
    };
  },

  async isLocationServicesEnabled() {
    return (await /** @type {ADB} */ (this.adb).getLocationProviders()).includes('gps');
  },

  async toggleLocationServices() {
    this.log.info('Toggling location services');
    const isGpsEnabled = await this.isLocationServicesEnabled();
    this.log.debug(
      `Current GPS state: ${isGpsEnabled}. ` +
        `The service is going to be ${isGpsEnabled ? 'disabled' : 'enabled'}`
    );
    await /** @type {ADB} */ (this.adb).toggleGPSLocationProvider(!isGpsEnabled);
  },
};

mixin(NetworkMixin);

export default NetworkMixin;

/**
 * @typedef {import('appium-adb').ADB} ADB
 */
