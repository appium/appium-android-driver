import moment from 'moment';

const MOMENT_FORMAT_ISO8601 = 'YYYY-MM-DDTHH:mm:ssZ';

/**
 * @this {import('../driver').AndroidDriver}
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
 * @this {import('../driver').AndroidDriver}
 * @param {import('./types').DeviceTimeOpts} [opts={}]
 * @returns {Promise<string>}
 */
export async function mobileGetDeviceTime(opts = {}) {
  return await this.getDeviceTime(opts.format);
}

/**
 * @typedef {import('appium-adb').ADB} ADB
 */
