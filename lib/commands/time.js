import moment from 'moment-timezone';

const MOMENT_FORMAT_ISO8601 = 'YYYY-MM-DDTHH:mm:ssZ';

/**
 * @this {AndroidDriver}
 * @param {string} [format=MOMENT_FORMAT_ISO8601]
 * @returns {Promise<string>}
 */
export async function getDeviceTime(format = MOMENT_FORMAT_ISO8601) {
  this.log.debug(
    'Attempting to capture android device date and time. ' + `The format specifier is '${format}'`,
  );
  const deviceTimestamp = (await this.adb.shell(['date', '+%Y-%m-%dT%T%z'])).trim();
  this.log.debug(`Got device timestamp: ${deviceTimestamp}`);
  const parsedTimestamp = moment.utc(deviceTimestamp, 'YYYY-MM-DDTHH:mm:ssZZ');
  if (!parsedTimestamp.isValid()) {
    this.log.warn('Cannot parse the returned timestamp. Returning as is');
    return deviceTimestamp;
  }
  // @ts-expect-error private API
  return parsedTimestamp.utcOffset(parsedTimestamp._tzm || 0).format(format);
}

/**
 * @this {AndroidDriver}
 * @param {import('./types').DeviceTimeOpts} [opts={}]
 * @returns {Promise<string>}
 */
export async function mobileGetDeviceTime(opts = {}) {
  return await this.getDeviceTime(opts.format);
}

/**
 * @this {AndroidDriver}
 * @param {string} zoneName
 * @returns {Promise<void>}
 */
export async function adjustTimeZone(zoneName) {
  if (!moment.tz.names().includes(zoneName)) {
    throw new Error(
      `The provided time zone identifier '${zoneName}' is not known. ` +
      `Please choose a valid TZ identifier from https://en.wikipedia.org/wiki/List_of_tz_database_time_zones`
    );
  }
  this.log.info(`Setting the device time zone to '${zoneName}'`);
  // The magic number '3' depends on the actual ordering of methods in
  // the IAlarmManager interface and might be a subject of change between
  // different Android API versions.
  // See, for example,
  // https://cs.android.com/android/platform/superproject/+/master:frameworks/base/apex/jobscheduler/framework/java/android/app/IAlarmManager.aidl;l=1?q=IAlarmManager
  await this.adb.shell(['service', 'call', 'alarm', '3', 's16', zoneName]);
}

/**
 * @typedef {import('appium-adb').ADB} ADB
 * @typedef {import('../driver').AndroidDriver} AndroidDriver
 */
