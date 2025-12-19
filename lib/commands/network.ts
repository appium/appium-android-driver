import _ from 'lodash';
import {errors} from 'appium/driver';
import {util} from '@appium/support';
import B from 'bluebird';
import type {AndroidDriver} from '../driver';
import type {ServiceType, GetConnectivityResult} from './types';

const AIRPLANE_MODE_MASK = 0b001;
const WIFI_MASK = 0b010;
const DATA_MASK = 0b100;
const WIFI_KEY_NAME = 'wifi';
const DATA_KEY_NAME = 'data';
const AIRPLANE_MODE_KEY_NAME = 'airplaneMode';
const SUPPORTED_SERVICE_NAMES: ServiceType[] = [
  WIFI_KEY_NAME,
  DATA_KEY_NAME,
  AIRPLANE_MODE_KEY_NAME,
];

/**
 * Gets the current network connection state.
 *
 * @returns Promise that resolves to a number representing the network connection state.
 * The value is a bitmask where:
 * - Bit 0 (0b001) = Airplane mode
 * - Bit 1 (0b010) = Wi-Fi
 * - Bit 2 (0b100) = Data connection
 */
export async function getNetworkConnection(
  this: AndroidDriver,
): Promise<number> {
  this.log.info('Getting network connection');
  const airplaneModeOn = await this.adb.isAirplaneModeOn();
  let connection = airplaneModeOn ? AIRPLANE_MODE_MASK : 0;

  // no need to check anything else if we are in airplane mode
  if (!airplaneModeOn) {
    const wifiOn = await this.isWifiOn();
    connection |= wifiOn ? WIFI_MASK : 0;
    const dataOn = await this.adb.isDataOn();
    connection |= dataOn ? DATA_MASK : 0;
  }

  return connection;
}

/**
 * Checks if Wi-Fi is enabled.
 *
 * @returns Promise that resolves to `true` if Wi-Fi is enabled, `false` otherwise.
 */
export async function isWifiOn(
  this: AndroidDriver,
): Promise<boolean> {
  return await this.adb.isWifiOn();
}

/**
 * Sets the connectivity state for Wi-Fi, data, and/or airplane mode.
 *
 * @since Android 12 (only real devices, emulators work in all APIs)
 * @param wifi Either to enable or disable Wi-Fi.
 * An unset value means to not change the state for the given service.
 * @param data Either to enable or disable mobile data connection.
 * An unset value means to not change the state for the given service.
 * @param airplaneMode Either to enable to disable the Airplane Mode.
 * An unset value means to not change the state for the given service.
 * @returns Promise that resolves when the connectivity state is set.
 * @throws {errors.InvalidArgumentError} If none of the options are provided.
 */
export async function mobileSetConnectivity(
  this: AndroidDriver,
  wifi?: boolean,
  data?: boolean,
  airplaneMode?: boolean,
): Promise<void> {
  if (_.every([wifi, data, airplaneMode], _.isUndefined)) {
    throw new errors.InvalidArgumentError(
      `Either one of ${JSON.stringify(SUPPORTED_SERVICE_NAMES)} options must be provided`,
    );
  }

  const services: ServiceType[] = [
    [wifi, WIFI_KEY_NAME],
    [data, DATA_KEY_NAME],
    [airplaneMode, AIRPLANE_MODE_KEY_NAME],
  ].reduce<ServiceType[]>((acc, [value, key]: [boolean | undefined, ServiceType]) => {
    if (!_.isUndefined(value)) {
      acc.push(key);
    }
    return acc;
  }, []);
  const currentState = await this.mobileGetConnectivity(services);
  const setters: Array<Promise<any> | (() => Promise<any>)> = [];
  if (!_.isUndefined(wifi) && currentState.wifi !== Boolean(wifi)) {
    setters.push(this.setWifiState(wifi));
  }
  if (!_.isUndefined(data) && currentState.data !== Boolean(data)) {
    setters.push(this.setDataState(data));
  }
  if (!_.isUndefined(airplaneMode) && currentState.airplaneMode !== Boolean(airplaneMode)) {
    setters.push(async () => {
      await this.adb.setAirplaneMode(airplaneMode);
      if ((await this.adb.getApiLevel()) < 30) {
        await this.adb.broadcastAirplaneMode(airplaneMode);
      }
    });
  }
  if (!_.isEmpty(setters)) {
    await B.all(setters);
  }
}

/**
 * Gets the connectivity state for one or more services.
 *
 * @param services One or more services to get the connectivity for.
 * @returns Promise that resolves to an object containing the connectivity state for the requested services.
 * @throws {errors.InvalidArgumentError} If any of the provided service names are not supported.
 */
export async function mobileGetConnectivity(
  this: AndroidDriver,
  services: ServiceType[] | ServiceType = SUPPORTED_SERVICE_NAMES,
): Promise<GetConnectivityResult> {
  const svcs = _.castArray(services);
  const unsupportedServices = _.difference(svcs, SUPPORTED_SERVICE_NAMES);
  if (!_.isEmpty(unsupportedServices)) {
    throw new errors.InvalidArgumentError(
      `${util.pluralize(
        'Service name',
        unsupportedServices.length,
        false,
      )} ${unsupportedServices} ` +
        `${
          unsupportedServices.length === 1 ? 'is' : 'are'
        } not known. Only the following services are ` +
        `suported: ${SUPPORTED_SERVICE_NAMES}`,
    );
  }

  const statePromises = {
    wifi: B.resolve(svcs.includes(WIFI_KEY_NAME) ? this.adb.isWifiOn() : undefined),
    data: B.resolve(svcs.includes(DATA_KEY_NAME) ? this.adb.isDataOn() : undefined),
    airplaneMode: B.resolve(
      svcs.includes(AIRPLANE_MODE_KEY_NAME) ? this.adb.isAirplaneModeOn() : undefined,
    ),
  };
  await B.all(_.values(statePromises));
  return _.reduce(
    statePromises,
    (state, v, k) => _.isUndefined(v.value()) ? state : {...state, [k]: Boolean(v.value())},
    {} as GetConnectivityResult,
  );
}

/**
 * Sets the network connection state using a bitmask.
 *
 * @since Android 12 (only real devices, emulators work in all APIs)
 * @param type A number representing the desired network connection state.
 * The value is a bitmask where:
 * - Bit 0 (0b001) = Airplane mode
 * - Bit 1 (0b010) = Wi-Fi
 * - Bit 2 (0b100) = Data connection
 * @returns Promise that resolves to the current network connection state after the change.
 */
export async function setNetworkConnection(
  this: AndroidDriver,
  type: number,
): Promise<number> {
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
    await this.adb.setAirplaneMode(shouldEnableAirplaneMode);
    if ((await this.adb.getApiLevel()) < 30) {
      await this.adb.broadcastAirplaneMode(shouldEnableAirplaneMode);
    }
  } else {
    this.log.info(
      `Not changing airplane mode, since it is already ${
        shouldEnableAirplaneMode ? 'enabled' : 'disabled'
      }`,
    );
  }

  if (shouldEnableWifi === isWiFiEnabled && shouldEnableDataConnection === isDataEnabled) {
    this.log.info(
      'Not changing data connection/Wi-Fi states, since they are already set to expected values',
    );
    if (await this.adb.isAirplaneModeOn()) {
      return AIRPLANE_MODE_MASK | currentState;
    }
    return ~AIRPLANE_MODE_MASK & currentState;
  }

  if (shouldEnableWifi !== isWiFiEnabled) {
    await this.setWifiState(shouldEnableWifi);
  } else {
    this.log.info(
      `Not changing Wi-Fi state, since it is already ` +
        `${shouldEnableWifi ? 'enabled' : 'disabled'}`,
    );
  }

  if (shouldEnableAirplaneMode) {
    this.log.info('Not changing data connection state, because airplane mode is enabled');
  } else if (shouldEnableDataConnection === isDataEnabled) {
    this.log.info(
      `Not changing data connection state, since it is already ` +
        `${shouldEnableDataConnection ? 'enabled' : 'disabled'}`,
    );
  } else {
    await this.setDataState(shouldEnableDataConnection);
  }

  return await this.getNetworkConnection();
}

/**
 * Sets the Wi-Fi state.
 *
 * @since Android 12 (only real devices, emulators work in all APIs)
 * @param isOn `true` to enable Wi-Fi, `false` to disable it.
 * @returns Promise that resolves when the Wi-Fi state is set.
 */
export async function setWifiState(
  this: AndroidDriver,
  isOn: boolean,
): Promise<void> {
  await this.settingsApp.setWifiState(isOn, this.isEmulator());
}

/**
 * Sets the mobile data connection state.
 *
 * @since Android 12 (only real devices, emulators work in all APIs)
 * @param isOn `true` to enable mobile data, `false` to disable it.
 * @returns Promise that resolves when the data connection state is set.
 */
export async function setDataState(
  this: AndroidDriver,
  isOn: boolean,
): Promise<void> {
  await this.settingsApp.setDataState(isOn, this.isEmulator());
}

/**
 * Toggles the mobile data connection state.
 *
 * @since Android 12 (only real devices, emulators work in all APIs)
 * @returns Promise that resolves when the data connection state is toggled.
 */
export async function toggleData(
  this: AndroidDriver,
): Promise<void> {
  const isOn = await this.adb.isDataOn();
  this.log.info(`Turning network data ${!isOn ? 'on' : 'off'}`);
  await this.setDataState(!isOn);
}

/**
 * Toggles the Wi-Fi state.
 *
 * @since Android 12 (only real devices, emulators work in all APIs)
 * @returns Promise that resolves when the Wi-Fi state is toggled.
 */
export async function toggleWiFi(
  this: AndroidDriver,
): Promise<void> {
  const isOn = await this.adb.isWifiOn();
  this.log.info(`Turning WiFi ${!isOn ? 'on' : 'off'}`);
  await this.setWifiState(!isOn);
}

/**
 * Toggles the airplane mode state.
 *
 * @since Android 12 (only real devices, emulators work in all APIs)
 * @returns Promise that resolves when the airplane mode state is toggled.
 */
export async function toggleFlightMode(
  this: AndroidDriver,
): Promise<void> {
  const flightMode = !(await this.adb.isAirplaneModeOn());
  this.log.info(`Turning flight mode ${flightMode ? 'on' : 'off'}`);
  await this.adb.setAirplaneMode(flightMode);
  if ((await this.adb.getApiLevel()) < 30) {
    await this.adb.broadcastAirplaneMode(flightMode);
  }
}
