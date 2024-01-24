import _ from 'lodash';
import {errors} from 'appium/driver';

export const ADB_SHELL_FEATURE = 'adb_shell';

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
