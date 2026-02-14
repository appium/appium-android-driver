import type {AndroidDriver} from '../driver';

const MOMENT_FORMAT_ISO8601 = 'YYYY-MM-DDTHH:mm:ssZ';

/**
 * Formats a date according to the specified format string.
 * Supports common format tokens similar to moment.js.
 * @param timestamp - The original timestamp string to extract timezone info
 * @param format - The format string
 */
function formatDate(timestamp: string, format: string): string {
  // Parse the timestamp to get both the date and the timezone offset
  const date = new Date(timestamp);

  let timezoneOffsetMinutes = -date.getTimezoneOffset();
  const tzMatch = timestamp.match(/([+-])(\d{2}):?(\d{2})$/);
  if (tzMatch) {
    const [, sign, hours, minutes] = tzMatch;
    timezoneOffsetMinutes = (sign === '+' ? 1 : -1) * (parseInt(hours, 10) * 60 + parseInt(minutes, 10));
  }

  const utcTime = date.getTime();
  const adjustedTime = new Date(utcTime + timezoneOffsetMinutes * 60000);

  const year = adjustedTime.getUTCFullYear();
  const month = adjustedTime.getUTCMonth() + 1;
  const day = adjustedTime.getUTCDate();
  const hours = adjustedTime.getUTCHours();
  const minutes = adjustedTime.getUTCMinutes();
  const seconds = adjustedTime.getUTCSeconds();
  const milliseconds = adjustedTime.getUTCMilliseconds();

  let result = format;

  // Year
  result = result.replace(/YYYY/g, String(year));
  result = result.replace(/YY/g, String(year).slice(-2));

  // Month
  result = result.replace(/MM/g, String(month).padStart(2, '0'));
  result = result.replace(/M(?!M)/g, String(month));

  // Day
  result = result.replace(/DD/g, String(day).padStart(2, '0'));
  result = result.replace(/D(?!D)/g, String(day));

  // Hours
  result = result.replace(/HH/g, String(hours).padStart(2, '0'));
  result = result.replace(/H(?!H)/g, String(hours));

  // Minutes
  result = result.replace(/mm/g, String(minutes).padStart(2, '0'));
  result = result.replace(/m(?!m)/g, String(minutes));

  // Seconds
  result = result.replace(/ss/g, String(seconds).padStart(2, '0'));
  result = result.replace(/s(?!s)/g, String(seconds));

  // Milliseconds
  result = result.replace(/SSS/g, String(milliseconds).padStart(3, '0'));

  // Timezone offset (Z format: ±HH:mm)
  if (result.includes('Z')) {
    const offsetHours = Math.floor(Math.abs(timezoneOffsetMinutes) / 60);
    const offsetMinutes = Math.abs(timezoneOffsetMinutes) % 60;
    const offsetSign = timezoneOffsetMinutes >= 0 ? '+' : '-';
    const offsetString = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;
    result = result.replace(/Z/g, offsetString);
  }

  return result;
}

/**
 * Parses a timestamp string in ISO8601-like format.
 * Handles formats like: 2024-01-15T10:30:45+0530 or 2024-01-15T10:30:45+05:30
 */
function parseTimestamp(timestamp: string): Date | null {
  // Manual parsing for format: YYYY-MM-DDTHH:mm:ss±HHmm (without colon in offset)
  const matchWithoutColon = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})([+-])(\d{2})(\d{2})$/);
  if (matchWithoutColon) {
    const [, year, month, day, hour, minute, second, sign, offsetHours, offsetMinutes] = matchWithoutColon;
    const dateStr = `${year}-${month}-${day}T${hour}:${minute}:${second}${sign}${offsetHours}:${offsetMinutes}`;
    const parsedDate = new Date(dateStr);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }

  const date = new Date(timestamp);
  if (!isNaN(date.getTime())) {
    return date;
  }

  return null;
}

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
  const parsedTimestamp = parseTimestamp(deviceTimestamp);
  if (!parsedTimestamp) {
    this.log.warn('Cannot parse the returned timestamp. Returning as is');
    return deviceTimestamp;
  }
  return formatDate(deviceTimestamp, format);
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
  try {
    Intl.DateTimeFormat(undefined, { timeZone: zoneName });
  } catch {
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

