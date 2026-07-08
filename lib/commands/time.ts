import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import type {AndroidDriver} from '../driver';

dayjs.extend(utc);
dayjs.extend(customParseFormat);

const DATETIME_FORMAT_ISO8601 = 'YYYY-MM-DDTHH:mm:ssZ';

/**
 * Gets the current device time.
 *
 * @param format The format string for the time. Defaults to ISO8601 format.
 * @returns Promise that resolves to the formatted device time string.
 */
export async function getDeviceTime(
  this: AndroidDriver,
  format: string = DATETIME_FORMAT_ISO8601,
): Promise<string> {
  this.log.debug(
    `Attempting to capture Android device date and time. The format specifier is '${format}'`,
  );
  const deviceTimestamp = (await this.adb.shell(['date', '+%Y-%m-%dT%T%z'])).trim();
  this.log.debug(`Got device timestamp: ${deviceTimestamp}`);
  const parsedTimestamp = dayjs.utc(deviceTimestamp, 'YYYY-MM-DDTHH:mm:ssZZ');
  if (!parsedTimestamp.isValid()) {
    this.log.warn('Cannot parse the returned timestamp. Returning as is');
    return deviceTimestamp;
  }
  const offset = parseOffset(deviceTimestamp);
  return parsedTimestamp.utcOffset(offset).format(format);
}

/**
 * Gets the current device time.
 *
 * @param format The format string for the time. Defaults to 'YYYY-MM-DDTHH:mm:ssZ'.
 * @returns Promise that resolves to the formatted device time string.
 */
export async function mobileGetDeviceTime(this: AndroidDriver, format?: string): Promise<string> {
  return await this.getDeviceTime(format);
}

/**
 * Adjusts the device time zone.
 *
 * @param zoneName The time zone identifier (e.g., 'America/New_York', 'Europe/London').
 * @returns Promise that resolves when the time zone is set.
 * @throws {Error} If the time zone identifier is not known.
 */
export async function adjustTimeZone(this: AndroidDriver, zoneName: string): Promise<void> {
  if (!isValidTimeZone(zoneName)) {
    throw new Error(
      `The provided time zone identifier '${zoneName}' is not known. ` +
        `Please choose a valid TZ identifier from https://en.wikipedia.org/wiki/List_of_tz_database_time_zones`,
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

function parseOffset(timestamp: string): number {
  const m = timestamp.match(/([+-])(\d{2})(\d{2})$/);
  if (!m) {
    return 0;
  }
  const sign = m[1] === '+' ? 1 : -1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

function isValidTimeZone(zoneName: string): boolean {
  return Intl.supportedValuesOf('timeZone').includes(zoneName);
}
