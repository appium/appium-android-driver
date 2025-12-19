import _ from 'lodash';
import {fs, tempDir} from '@appium/support';
import path from 'node:path';
import B from 'bluebird';
import type {Location} from '@appium/types';
import {SETTINGS_HELPER_ID} from 'io.appium.settings';
import {getThirdPartyPackages} from './app-management';
import type {AndroidDriver} from '../driver';

// The value close to zero, but not zero, is needed
// to trick JSON generation and send a float value instead of an integer,
// This allows strictly-typed clients, like Java, to properly
// parse it. Otherwise float 0.0 is always represented as integer 0 in JS.
// The value must not be greater than DBL_EPSILON (https://opensource.apple.com/source/Libc/Libc-498/include/float.h)
const GEO_EPSILON = Number.MIN_VALUE;
const MOCK_APP_IDS_STORE = '/data/local/tmp/mock_apps.json';

/**
 * Sets the device geolocation.
 *
 * @param location The geolocation object containing latitude, longitude, and altitude.
 * @returns Promise that resolves to the current geolocation after setting it.
 */
export async function setGeoLocation(
  this: AndroidDriver,
  location: Location,
): Promise<Location> {
  await this.settingsApp.setGeoLocation(location, this.isEmulator());
  try {
    return await this.getGeoLocation();
  } catch (e) {
    this.log.warn(
      `Could not get the current geolocation info: ${(e as Error).message}`,
    );
    this.log.warn(`Returning the default zero'ed values`);
    return {
      latitude: GEO_EPSILON,
      longitude: GEO_EPSILON,
      altitude: GEO_EPSILON,
    };
  }
}

/**
 * Set the device geolocation.
 *
 * @param latitude Valid latitude value.
 * @param longitude Valid longitude value.
 * @param altitude Valid altitude value.
 * @param satellites Number of satellites being tracked (1-12). Available for emulators.
 * @param speed Valid speed value.
 * https://developer.android.com/reference/android/location/Location#setSpeed(float)
 * @param bearing Valid bearing value. Available for real devices.
 * https://developer.android.com/reference/android/location/Location#setBearing(float)
 * @param accuracy Valid accuracy value. Available for real devices.
 * https://developer.android.com/reference/android/location/Location#setAccuracy(float),
 * https://developer.android.com/reference/android/location/Criteria
 */
export async function mobileSetGeolocation(
  this: AndroidDriver,
  latitude: number,
  longitude: number,
  altitude?: number,
  satellites?: number,
  speed?: number,
  bearing?: number,
  accuracy?: number,
): Promise<void> {
  await this.settingsApp.setGeoLocation({
    latitude,
    longitude,
    altitude,
    satellites,
    speed,
    bearing,
    accuracy,
  }, this.isEmulator());
}

/**
 * Sends an async request to refresh the GPS cache.
 *
 * This feature only works if the device under test has Google Play Services
 * installed. In case the vanilla LocationManager is used the device API level
 * must be at version 30 (Android R) or higher.
 *
 * @param timeoutMs The maximum number of milliseconds
 * to block until GPS cache is refreshed. Providing zero or a negative
 * value to it skips waiting completely.
 * 20000ms by default.
 * @returns Promise that resolves when the GPS cache refresh is initiated.
 */
export async function mobileRefreshGpsCache(
  this: AndroidDriver,
  timeoutMs?: number,
): Promise<void> {
  await this.settingsApp.refreshGeoLocationCache(timeoutMs);
}

/**
 * Gets the current device geolocation.
 *
 * @returns Promise that resolves to the current geolocation object.
 */
export async function getGeoLocation(
  this: AndroidDriver,
): Promise<Location> {
  const {latitude, longitude, altitude} = await this.settingsApp.getGeoLocation();
  return {
    latitude: parseFloat(String(latitude)) || GEO_EPSILON,
    longitude: parseFloat(String(longitude)) || GEO_EPSILON,
    altitude: parseFloat(String(altitude)) || GEO_EPSILON,
  };
}

/**
 * Gets the current device geolocation.
 *
 * @returns Promise that resolves to the current geolocation object.
 */
export async function mobileGetGeolocation(
  this: AndroidDriver,
): Promise<Location> {
  return await this.getGeoLocation();
}

/**
 * Checks if location services are enabled.
 *
 * @returns Promise that resolves to `true` if location services are enabled, `false` otherwise.
 */
export async function isLocationServicesEnabled(
  this: AndroidDriver,
): Promise<boolean> {
  return (await this.adb.getLocationProviders()).includes('gps');
}

/**
 * Toggles the location services state.
 *
 * @returns Promise that resolves when the location services state is toggled.
 */
export async function toggleLocationServices(
  this: AndroidDriver,
): Promise<void> {
  this.log.info('Toggling location services');
  const isGpsEnabled = await this.isLocationServicesEnabled();
  this.log.debug(
    `Current GPS state: ${isGpsEnabled}. ` +
      `The service is going to be ${isGpsEnabled ? 'disabled' : 'enabled'}`,
  );
  await this.adb.toggleGPSLocationProvider(!isGpsEnabled);
}

/**
 * Resets the geolocation to the default state.
 *
 * @returns Promise that resolves when the geolocation is reset.
 * @throws {Error} If called on an emulator (geolocation reset does not work on emulators).
 */
export async function mobileResetGeolocation(
  this: AndroidDriver,
): Promise<void> {
  if (this.isEmulator()) {
    throw new Error('Geolocation reset does not work on emulators');
  }
  await resetMockLocation.bind(this);
}

// #region Internal helpers

/**
 * Sets the mock location permission for a specific app.
 *
 * @param appId The application package identifier.
 * @returns Promise that resolves when the mock location permission is set.
 */
export async function setMockLocationApp(
  this: AndroidDriver,
  appId: string,
): Promise<void> {
  try {
    await this.adb.shell(['appops', 'set', appId, 'android:mock_location', 'allow']);
  } catch (err) {
    this.log.warn(`Unable to set mock location for app '${appId}': ${(err as Error).message}`);
    return;
  }
  try {
    let pkgIds: string[] = [];
    if (await this.adb.fileExists(MOCK_APP_IDS_STORE)) {
      try {
        pkgIds = JSON.parse(await this.adb.shell(['cat', MOCK_APP_IDS_STORE]));
      } catch {}
    }
    if (pkgIds.includes(appId)) {
      return;
    }
    pkgIds.push(appId);
    const tmpRoot = await tempDir.openDir();
    const srcPath = path.posix.join(tmpRoot, path.posix.basename(MOCK_APP_IDS_STORE));
    try {
      await fs.writeFile(srcPath, JSON.stringify(pkgIds), 'utf8');
      await this.adb.push(srcPath, MOCK_APP_IDS_STORE);
    } finally {
      await fs.rimraf(tmpRoot);
    }
  } catch (e) {
    this.log.warn(`Unable to persist mock location app id '${appId}': ${(e as Error).message}`);
  }
}

/**
 * Resets the mock location permissions for all apps.
 *
 * @returns Promise that resolves when the mock location permissions are reset.
 */
async function resetMockLocation(
  this: AndroidDriver,
): Promise<void> {
  try {
    const thirdPartyPkgIdsPromise = getThirdPartyPackages.bind(this)();
    let pkgIds: string[] = [];
    if (await this.adb.fileExists(MOCK_APP_IDS_STORE)) {
      try {
        pkgIds = JSON.parse(await this.adb.shell(['cat', MOCK_APP_IDS_STORE]));
      } catch {}
    }
    const thirdPartyPkgIds = await thirdPartyPkgIdsPromise;
    // Only include currently installed packages
    const resultPkgs = _.intersection(pkgIds, thirdPartyPkgIds);
    if (_.size(resultPkgs) <= 1) {
      await this.adb.shell([
        'appops',
        'set',
        resultPkgs[0] ?? SETTINGS_HELPER_ID,
        'android:mock_location',
        'deny',
      ]);
      return;
    }

    this.log.debug(`Resetting mock_location permission for the following apps: ${resultPkgs}`);
    await B.all(
      resultPkgs.map((pkgId) =>
        (async () => {
          try {
            await this.adb.shell(['appops', 'set', pkgId, 'android:mock_location', 'deny']);
          } catch {}
        })(),
      ),
    );
  } catch (err) {
    this.log.warn(`Unable to reset mock location: ${(err as Error).message}`);
  }
}

// #endregion Internal helpers

