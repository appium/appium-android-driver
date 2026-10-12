import type {EventEmitter} from 'node:events';
import os from 'node:os';

import {util} from '@appium/support';
import type {AppiumServer, WSServer} from '@appium/types';
import type {ADB} from 'appium-adb';
import {DEFAULT_WS_PATHNAME_PREFIX} from 'appium/driver.js';
import {WebSocket, WebSocketServer} from 'ws';

import type {AndroidDriverConstraints} from '../constraints.js';
import type {AndroidDriver} from '../driver.js';
import {GET_SERVER_LOGS_FEATURE, toLogRecord, nativeLogEntryToSeleniumEntry, type LogEntry} from '../utils.js';
import {BIDI_EVENT_NAME} from './bidi/constants.js';
import {makeLogEntryAddedEvent} from './bidi/models.js';
import {NATIVE_WIN} from './context/helpers.js';

declare module '../driver.js' {
  interface AndroidDriver<C extends AndroidDriverConstraints> {
    mobileStartLogsBroadcast(
      ...args: Parameters<typeof mobileStartLogsBroadcast>
    ): ReturnType<typeof mobileStartLogsBroadcast>;
    mobileStopLogsBroadcast(
      ...args: Parameters<typeof mobileStopLogsBroadcast>
    ): ReturnType<typeof mobileStopLogsBroadcast>;
    assignBiDiLogListener<EE extends EventEmitter>(
      logEmitter: EE,
      properties: BiDiListenerProperties,
    ): [EE, LogListener];
  }
}

export const supportedLogTypes = {
  logcat: {
    description: 'Logs for Android applications on real device and emulators via ADB',
    getter: (self: AndroidDriver) => (self.adb as ADB).getLogcatLogs(),
  },
  bugreport: {
    description: `'adb bugreport' output for advanced issues diagnostic`,
    getter: async (self: AndroidDriver) => {
      const output = await (self.adb as ADB).bugreport();
      const timestamp = Date.now();
      return output.split(os.EOL).map((x) => toLogRecord(timestamp, x));
    },
  },
  server: {
    description: 'Appium server logs',
    getter: (self: AndroidDriver) => {
      self.assertFeatureEnabled(GET_SERVER_LOGS_FEATURE);
      return self.log.unwrap().record.map(nativeLogEntryToSeleniumEntry);
    },
  },
} as const;

/**
 * Starts Android logcat broadcast websocket on the same host and port
 * where Appium server is running at `/ws/session/:sessionId:/appium/logcat` endpoint. The method
 * will return immediately if the web socket is already listening.
 *
 * Each connected websocket listener will receive logcat log lines
 * as soon as they are visible to Appium.
 *
 * @returns Promise that resolves when the logcat broadcasting websocket is started.
 */
export async function mobileStartLogsBroadcast(this: AndroidDriver): Promise<void> {
  const server = this.server as AppiumServer;
  const pathname = WEBSOCKET_ENDPOINT(this.sessionId as string);
  if (!util.isEmpty(await server.getWebSocketHandlers(pathname))) {
    this.log.debug(`The logcat broadcasting web socket server is already listening at ${pathname}`);
    return;
  }

  this.log.info(`Starting logcat broadcasting on web socket server ${JSON.stringify(server.address())} to ${pathname}`);
  // https://github.com/websockets/ws/blob/master/doc/ws.md
  const wss = new WebSocketServer({
    noServer: true,
  });
  // Tracks every currently connected listener socket so log lines get
  // broadcast to all of them, not just the one that connected first.
  const connectedSockets = new Set<WebSocket>();
  wss.on('connection', (ws, req) => {
    if (req) {
      const remoteIp = util.isEmpty(req.headers['x-forwarded-for'])
        ? req.socket.remoteAddress
        : req.headers['x-forwarded-for'];
      this.log.debug(`Established a new logcat listener web socket connection from ${remoteIp}`);
    } else {
      this.log.debug('Established a new logcat listener web socket connection');
    }

    connectedSockets.add(ws);
    if (!this._logcatWebsocketListener) {
      this._logcatWebsocketListener = (logRecord: LogEntry) => {
        for (const socket of connectedSockets) {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(logRecord.message);
          }
        }
      };
    }
    this.adb.setLogcatListener(this._logcatWebsocketListener);

    ws.on('close', (code, reason) => {
      connectedSockets.delete(ws);
      if (connectedSockets.size === 0 && this._logcatWebsocketListener) {
        try {
          this.adb.removeLogcatListener(this._logcatWebsocketListener);
        } catch {}
        this._logcatWebsocketListener = undefined;
      }

      let closeMsg = 'Logcat listener web socket is closed.';
      if (!util.isEmpty(code)) {
        closeMsg += ` Code: ${code}.`;
      }
      if (!util.isEmpty(reason)) {
        closeMsg += ` Reason: ${reason.toString()}.`;
      }
      this.log.debug(closeMsg);
    });
  });
  await server.addWebSocketHandler(pathname, wss as WSServer);
}

/**
 * Stops the previously started logcat broadcasting wesocket server.
 * This method will return immediately if no server is running.
 *
 * @returns Promise that resolves when the logcat broadcasting websocket is stopped.
 */
export async function mobileStopLogsBroadcast(this: AndroidDriver): Promise<void> {
  const pathname = WEBSOCKET_ENDPOINT(this.sessionId as string);
  const server = this.server as AppiumServer;
  if (util.isEmpty(await server.getWebSocketHandlers(pathname))) {
    return;
  }

  this.log.debug(
    `Stopping logcat broadcasting on web socket server ${JSON.stringify(server.address())} to ${pathname}`,
  );
  await server.removeWebSocketHandler(pathname);
}

/**
 * Assigns a BiDi log listener to an event emitter.
 *
 * https://w3c.github.io/webdriver-bidi/#event-log-entryAdded
 *
 * @template EE The event emitter type.
 * @param logEmitter The event emitter to attach the listener to.
 * @param properties The BiDi listener properties.
 * @returns A tuple containing the event emitter and the listener function.
 */
export function assignBiDiLogListener<EE extends EventEmitter>(
  this: AndroidDriver,
  logEmitter: EE,
  properties: BiDiListenerProperties,
): [EE, LogListener] {
  const {type, context = NATIVE_WIN, srcEventName = 'output', entryTransformer} = properties;
  const listener: LogListener = (logEntry: LogEntry) => {
    const finalEntry = entryTransformer ? entryTransformer(logEntry) : logEntry;
    this.eventEmitter.emit(BIDI_EVENT_NAME, makeLogEntryAddedEvent(finalEntry, context, type));
  };
  logEmitter.on(srcEventName, listener);
  return [logEmitter, listener];
}

// #region Internal helpers

/**
 * Generates the websocket endpoint path for logcat broadcasting.
 *
 * @param sessionId The session ID.
 * @returns The websocket endpoint path.
 */
const WEBSOCKET_ENDPOINT = (sessionId: string): string =>
  `${DEFAULT_WS_PATHNAME_PREFIX}/session/${sessionId}/appium/device/logcat`;

// #endregion

export interface BiDiListenerProperties {
  type: string;
  srcEventName?: string;
  context?: string;
  entryTransformer?: (x: LogEntry) => LogEntry;
}

export type LogListener = (logEntry: LogEntry) => any;
