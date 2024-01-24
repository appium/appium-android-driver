import _ from 'lodash';
import {fs, tempDir} from '@appium/support';
import path from 'node:path';
import B from 'bluebird';
import {SETTINGS_HELPER_ID} from 'io.appium.settings';
import {getThirdPartyPackages} from './app-management';

// The value close to zero, but not zero, is needed
// to trick JSON generation and send a float value instead of an integer,
// This allows strictly-typed clients, like Java, to properly
// parse it. Otherwise float 0.0 is always represented as integer 0 in JS.
// The value must not be greater than DBL_EPSILON (https://opensource.apple.com/source/Libc/Libc-498/include/float.h)
const GEO_EPSILON = Number.MIN_VALUE;
const MOCK_APP_IDS_STORE = '/data/local/tmp/mock_apps.json';

/**
 * @this {import('../driver').AndroidDriver}
 * @param {import('@appium/types').Location} location
 * @returns {Promise<import('@appium/types').Location>}
 */
export async function setGeoLocation(location) {
  await this.settingsApp.setGeoLocation(location, this.isEmulator());
  try {
    return await this.getGeoLocation();
  } catch (e) {
    this.log.warn(
      `Could not get the current geolocation info: ${/** @type {Error} */ (e).message}`,
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
 * Sends an async request to refresh the GPS cache.
 *
 * This feature only works if the device under test has Google Play Services
 * installed. In case the vanilla LocationManager is used the device API level
 * must be at version 30 (Android R) or higher.
 *
 * @this {import('../driver').AndroidDriver}
 * @param {import('./types').GpsCacheRefreshOpts} [opts={}]
 * @returns {Promise<void>}
 */
export async function mobileRefreshGpsCache(opts = {}) {
  const {timeoutMs} = opts;
  await this.settingsApp.refreshGeoLocationCache(timeoutMs);
}

/**
 * @this {import('../driver').AndroidDriver}
 * @returns {Promise<import('@appium/types').Location>}
 */
export async function getGeoLocation() {
  const {latitude, longitude, altitude} = await this.settingsApp.getGeoLocation();
  return {
    latitude: parseFloat(String(latitude)) || GEO_EPSILON,
    longitude: parseFloat(String(longitude)) || GEO_EPSILON,
    altitude: parseFloat(String(altitude)) || GEO_EPSILON,
  };
}

/**
 * @this {import('../driver').AndroidDriver}
 * @returns {Promise<boolean>}
 */
export async function isLocationServicesEnabled() {
  return (await this.adb.getLocationProviders()).includes('gps');
}

/**
 * @this {import('../driver').AndroidDriver}
 * @returns {Promise<void>}
 */
export async function toggleLocationServices() {
  this.log.info('Toggling location services');
  const isGpsEnabled = await this.isLocationServicesEnabled();
  this.log.debug(
    `Current GPS state: ${isGpsEnabled}. ` +
      `The service is going to be ${isGpsEnabled ? 'disabled' : 'enabled'}`,
  );
  await this.adb.toggleGPSLocationProvider(!isGpsEnabled);
}

// #region Internal helpers

/**
 * @this {import('../driver').AndroidDriver}
 * @param {string} appId
 * @returns {Promise<void>}
 */
export async function setMockLocationApp(appId) {
  try {
    if ((await this.adb.getApiLevel()) < 23) {
      await this.adb.shell(['settings', 'put', 'secure', 'mock_location', '1']);
    } else {
      await this.adb.shell(['appops', 'set', appId, 'android:mock_location', 'allow']);
    }
  } catch (err) {
    this.log.warn(`Unable to set mock location for app '${appId}': ${err.message}`);
    return;
  }
  try {
    /** @type {string[]} */
    let pkgIds = [];
    if (await this.adb.fileExists(MOCK_APP_IDS_STORE)) {
      try {
        pkgIds = JSON.parse(await this.adb.shell(['cat', MOCK_APP_IDS_STORE]));
      } catch (ign) {}
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
    this.log.warn(`Unable to persist mock location app id '${appId}': ${e.message}`);
  }
}

/**
 * @this {import('../driver').AndroidDriver}
 * @returns {Promise<void>}
 */
export async function resetMockLocation() {
  try {
    if ((await this.adb.getApiLevel()) < 23) {
      await this.adb.shell(['settings', 'put', 'secure', 'mock_location', '0']);
      return;
    }

    const thirdPartyPkgIdsPromise = getThirdPartyPackages.bind(this)();
    let pkgIds = [];
    if (await this.adb.fileExists(MOCK_APP_IDS_STORE)) {
      try {
        pkgIds = JSON.parse(await this.adb.shell(['cat', MOCK_APP_IDS_STORE]));
      } catch (ign) {}
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
          } catch (ign) {}
        })(),
      ),
    );
  } catch (err) {
    this.log.warn(`Unable to reset mock location: ${err.message}`);
  }
}

// #endregion Internal helpers
