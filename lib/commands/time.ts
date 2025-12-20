import moment from 'moment-timezone';
import type {AndroidDriver} from '../driver';

const MOMENT_FORMAT_ISO8601 = 'YYYY-MM-DDTHH:mm:ssZ';

/**
 * Gets the current device time.
 *
 * @param format The format string for the time. Defaults to ISO8601 format.
 * @returns Promise that resolves to the formatted device time string.
 */
export async function getDeviceTime(
  this: AndroidDriver,
  format: string = MOMENT_FORMAT_ISO8601,
): Promise<string> {
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
 * Gets the current device time.
 *
 * @param format The format string for the time. Defaults to 'YYYY-MM-DDTHH:mm:ssZ'.
 * @returns Promise that resolves to the formatted device time string.
 */
export async function mobileGetDeviceTime(
  this: AndroidDriver,
  format?: string,
): Promise<string> {
  return await this.getDeviceTime(format);
}

/**
 * Adjusts the device time zone.
 *
 * @param zoneName The time zone identifier (e.g., 'America/New_York', 'Europe/London').
 * @returns Promise that resolves when the time zone is set.
 * @throws {Error} If the time zone identifier is not known.
 */
export async function adjustTimeZone(
  this: AndroidDriver,
  zoneName: string,
): Promise<void> {
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

