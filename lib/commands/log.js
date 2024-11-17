import {DEFAULT_WS_PATHNAME_PREFIX, BaseDriver} from 'appium/driver';
import _ from 'lodash';
import os from 'node:os';
import WebSocket from 'ws';
import {
  GET_SERVER_LOGS_FEATURE,
  toLogRecord,
  nativeLogEntryToSeleniumEntry,
} from '../utils';
import { NATIVE_WIN } from './context/helpers';
import { BIDI_EVENT_NAME } from './bidi/constants';
import { makeLogEntryAddedEvent } from './bidi/models';

export const supportedLogTypes = {
  logcat: {
    description: 'Logs for Android applications on real device and emulators via ADB',
    /**
     *
     * @param {import('../driver').AndroidDriver} self
     * @returns
     */
    getter: (self) => /** @type {ADB} */ (self.adb).getLogcatLogs(),
  },
  bugreport: {
    description: `'adb bugreport' output for advanced issues diagnostic`,
    /**
     *
     * @param {import('../driver').AndroidDriver} self
     * @returns
     */
    getter: async (self) => {
      const output = await /** @type {ADB} */ (self.adb).bugreport();
      const timestamp = Date.now();
      return output.split(os.EOL).map((x) => toLogRecord(timestamp, x));
    },
  },
  server: {
    description: 'Appium server logs',
    /**
     *
     * @param {import('../driver').AndroidDriver} self
     * @returns
     */
    getter: (self) => {
      self.ensureFeatureEnabled(GET_SERVER_LOGS_FEATURE);
      return self.log.unwrap().record.map(nativeLogEntryToSeleniumEntry);
    },
  },
};

/**
 * Starts Android logcat broadcast websocket on the same host and port
 * where Appium server is running at `/ws/session/:sessionId:/appium/logcat` endpoint. The method
 * will return immediately if the web socket is already listening.
 *
 * Each connected websocket listener will receive logcat log lines
 * as soon as they are visible to Appium.
 *
 * @this {import('../driver').AndroidDriver}
 * @returns {Promise<void>}
 */
export async function mobileStartLogsBroadcast() {
  const server = /** @type {import('@appium/types').AppiumServer} */ (this.server);
  const pathname = WEBSOCKET_ENDPOINT(/** @type {string} */ (this.sessionId));
  if (!_.isEmpty(await server.getWebSocketHandlers(pathname))) {
    this.log.debug(`The logcat broadcasting web socket server is already listening at ${pathname}`);
    return;
  }

  this.log.info(
    `Starting logcat broadcasting on web socket server ` +
      `${JSON.stringify(server.address())} to ${pathname}`,
  );
  // https://github.com/websockets/ws/blob/master/doc/ws.md
  const wss = new WebSocket.Server({
    noServer: true,
  });
  wss.on('connection', (ws, req) => {
    if (req) {
      const remoteIp = _.isEmpty(req.headers['x-forwarded-for'])
        ? req.connection?.remoteAddress
        : req.headers['x-forwarded-for'];
      this.log.debug(`Established a new logcat listener web socket connection from ${remoteIp}`);
    } else {
      this.log.debug('Established a new logcat listener web socket connection');
    }

    if (_.isEmpty(this._logcatWebsocketListener)) {
      this._logcatWebsocketListener = (logRecord) => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(logRecord.message);
        }
      };
    }
    this.adb.setLogcatListener(this._logcatWebsocketListener);

    ws.on('close', (code, reason) => {
      if (!_.isEmpty(this._logcatWebsocketListener)) {
        try {
          this.adb.removeLogcatListener(this._logcatWebsocketListener);
        } catch (ign) {}
        this._logcatWebsocketListener = undefined;
      }

      let closeMsg = 'Logcat listener web socket is closed.';
      if (!_.isEmpty(code)) {
        closeMsg += ` Code: ${code}.`;
      }
      if (!_.isEmpty(reason)) {
        closeMsg += ` Reason: ${reason.toString()}.`;
      }
      this.log.debug(closeMsg);
    });
  });
  await server.addWebSocketHandler(pathname, /** @type {import('@appium/types').WSServer} */ (wss));
}

/**
 * Stops the previously started logcat broadcasting wesocket server.
 * This method will return immediately if no server is running.
 *
 * @this {import('../driver').AndroidDriver}
 * @returns {Promise<void>}
 */
export async function mobileStopLogsBroadcast() {
  const pathname = WEBSOCKET_ENDPOINT(/** @type {string} */ (this.sessionId));
  const server = /** @type {import('@appium/types').AppiumServer} */ (this.server);
  if (_.isEmpty(await server.getWebSocketHandlers(pathname))) {
    return;
  }

  this.log.debug(
    `Stopping logcat broadcasting on web socket server ` +
      `${JSON.stringify(server.address())} to ${pathname}`,
  );
  await server.removeWebSocketHandler(pathname);
}

/**
 * @this {import('../driver').AndroidDriver}
 * @returns {Promise<string[]>}
 */
export async function getLogTypes() {
  // XXX why doesn't `super` work here?
  const nativeLogTypes = await BaseDriver.prototype.getLogTypes.call(this);
  if (this.isWebContext()) {
    const webLogTypes = /** @type {string[]} */ (
      await /** @type {import('appium-chromedriver').Chromedriver} */ (
        this.chromedriver
      ).jwproxy.command('/log/types', 'GET')
    );
    return [...nativeLogTypes, ...webLogTypes];
  }
  return nativeLogTypes;
}

/**
 * https://w3c.github.io/webdriver-bidi/#event-log-entryAdded
 *
 * @template {import('node:events').EventEmitter} EE
 * @this {import('../driver').AndroidDriver}
 * @param {EE} logEmitter
 * @param {BiDiListenerProperties} properties
 * @returns {[EE, LogListener]}
 */
export function assignBiDiLogListener (logEmitter, properties) {
  const {
    type,
    context = NATIVE_WIN,
    srcEventName = 'output',
    entryTransformer,
  } = properties;
  const listener = (/** @type {import('../utils').LogEntry} */ logEntry) => {
    const finalEntry = entryTransformer ? entryTransformer(logEntry) : logEntry;
    this.eventEmitter.emit(BIDI_EVENT_NAME, makeLogEntryAddedEvent(finalEntry, context, type));
  };
  logEmitter.on(srcEventName, listener);
  return [logEmitter, listener];
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {string} logType
 * @returns {Promise<any>}
 */
export async function getLog(logType) {
  if (this.isWebContext() && !_.keys(this.supportedLogTypes).includes(logType)) {
    return await /** @type {import('appium-chromedriver').Chromedriver} */ (
      this.chromedriver
    ).jwproxy.command('/log', 'POST', {type: logType});
  }
  // XXX why doesn't `super` work here?
  return await BaseDriver.prototype.getLog.call(this, logType);
}

// #region Internal helpers

/**
 * @param {string} sessionId
 * @returns {string}
 */
const WEBSOCKET_ENDPOINT = (sessionId) =>
  `${DEFAULT_WS_PATHNAME_PREFIX}/session/${sessionId}/appium/device/logcat`;


// #endregion

/**
 * @typedef {import('appium-adb').ADB} ADB
 */

/**
 * @typedef {Object} BiDiListenerProperties
 * @property {string} type
 * @property {string} [srcEventName='output']
 * @property {string} [context=NATIVE_WIN]
 * @property {(x: Object) => import('../utils').LogEntry} [entryTransformer]
 */

/** @typedef {(logEntry: import('../utils').LogEntry) => any} LogListener */