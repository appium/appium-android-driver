import _ from 'lodash';
import {errors} from 'appium/driver';

export const ADB_SHELL_FEATURE = 'adb_shell';
export const GET_SERVER_LOGS_FEATURE = 'get_server_logs';
const COLOR_CODE_PATTERN = /\u001b\[(\d+(;\d+)*)?m/g; // eslint-disable-line no-control-regex

/**
 * Assert the presence of particular keys in the given object
 *
 * @param {string|string[]} argNames one or more key names
 * @param {any} opts the object to check
 * @returns {Record<string, any>} the same given object
 */
export function requireArgs(argNames, opts) {
  for (const argName of _.isArray(argNames) ? argNames : [argNames]) {
    if (!_.has(opts, argName)) {
      throw new errors.InvalidArgumentError(`'${argName}' argument must be provided`);
    }
  }
  return opts;
}

/**
 *
 * @param {string | string[]} cap
 * @returns {string[]}
 */
export function parseArray(cap) {
  let parsedCaps;
  try {
    // @ts-ignore this is fine
    parsedCaps = JSON.parse(cap);
  } catch (ign) {}

  if (_.isArray(parsedCaps)) {
    return parsedCaps;
  } else if (_.isString(cap)) {
    return [cap];
  }

  throw new Error(`must provide a string or JSON Array; received ${cap}`);
}

/**
 * @param {import('@appium/types').AppiumServer} server
 * @param {string?} [sessionId]
 * @returns {Promise<void>}
 */
export async function removeAllSessionWebSocketHandlers(server, sessionId) {
  if (!server || !_.isFunction(server.getWebSocketHandlers)) {
    return;
  }

  const activeHandlers = await server.getWebSocketHandlers(sessionId);
  for (const pathname of _.keys(activeHandlers)) {
    await server.removeWebSocketHandler(pathname);
  }
}

/**
 *
 * @param {Object} x
 * @returns {LogEntry}
 */
export function nativeLogEntryToSeleniumEntry (x) {
  const msg = _.isEmpty(x.prefix) ? x.message : `[${x.prefix}] ${x.message}`;
  return toLogRecord(
    /** @type {any} */ (x).timestamp ?? Date.now(),
    _.replace(msg, COLOR_CODE_PATTERN, '')
  );
}

/**
 *
 * @see {@link https://github.com/SeleniumHQ/selenium/blob/0d425676b3c9df261dd641917f867d4d5ce7774d/java/client/src/org/openqa/selenium/logging/LogEntry.java}
 * @param {number} timestamp
 * @param {string} message
 * @param {string} [level='ALL']
 * @returns {LogEntry}
 */
export function toLogRecord(timestamp, message, level = 'ALL') {
  return {
    timestamp,
    level,
    message,
  };
}

/**
 * @typedef {import('appium-adb').LogcatRecord} LogEntry
 */
