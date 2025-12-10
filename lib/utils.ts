import _ from 'lodash';
import {errors} from 'appium/driver';
import type {LogEntry} from 'appium-adb';
import type {AndroidDriver} from './driver';

export type {LogEntry};

export const ADB_SHELL_FEATURE = 'adb_shell';
export const ADB_LISTEN_ALL_NETWORK_FEATURE = 'adb_listen_all_network';
export const GET_SERVER_LOGS_FEATURE = 'get_server_logs';
const COLOR_CODE_PATTERN = /\u001b\[(\d+(;\d+)*)?m/g; // eslint-disable-line no-control-regex

/**
 * Assert the presence of particular keys in the given object
 *
 * @param argNames one or more key names
 * @param opts the object to check
 * @returns the same given object
 */
export function requireArgs(argNames: string | string[], opts: Record<string, any>): Record<string, any> {
  for (const argName of _.isArray(argNames) ? argNames : [argNames]) {
    if (!_.has(opts, argName)) {
      throw new errors.InvalidArgumentError(`'${argName}' argument must be provided`);
    }
  }
  return opts;
}

/**
 *
 * @param cap
 * @returns
 */
export function parseArray(cap: string | string[]): string[] {
  let parsedCaps;
  try {
    parsedCaps = JSON.parse(cap as string);
  } catch {}

  if (_.isArray(parsedCaps)) {
    return parsedCaps;
  } else if (_.isString(cap)) {
    return [cap];
  }

  throw new Error(`must provide a string or JSON Array; received ${cap}`);
}

/**
 * @this AndroidDriver
 * @returns
 */
export async function removeAllSessionWebSocketHandlers(this: AndroidDriver): Promise<void> {
  if (!this.sessionId || !_.isFunction(this.server?.getWebSocketHandlers)) {
    return;
  }

  const activeHandlers = await this.server.getWebSocketHandlers(this.sessionId);
  for (const pathname of _.keys(activeHandlers)) {
    await this.server.removeWebSocketHandler(pathname);
  }
}

interface LogEntryWithPrefix {
  message: string;
  prefix?: string;
  timestamp?: number;
  level?: string;
}

/**
 *
 * @param x
 * @returns
 */
export function nativeLogEntryToSeleniumEntry(x: LogEntryWithPrefix): LogEntry {
  const msg = _.isEmpty(x.prefix) ? x.message : `[${x.prefix}] ${x.message}`;
  return toLogRecord(
    x.timestamp ?? Date.now(),
    _.replace(msg, COLOR_CODE_PATTERN, '')
  );
}

/**
 *
 * @see {@link https://github.com/SeleniumHQ/selenium/blob/0d425676b3c9df261dd641917f867d4d5ce7774d/java/client/src/org/openqa/selenium/logging/LogEntry.java}
 * @param timestamp
 * @param message
 * @param level
 * @returns
 */
export function toLogRecord(timestamp: number, message: string, level: string = 'ALL'): LogEntry {
  return {
    timestamp,
    level: level as any,
    message,
  };
}

