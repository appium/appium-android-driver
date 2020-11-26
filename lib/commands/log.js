import log from '../logger';
import os from 'os';
import _ from 'lodash';
import WebSocket from 'ws';
import { DEFAULT_WS_PATHNAME_PREFIX, BaseDriver } from 'appium-base-driver';

const GET_SERVER_LOGS_FEATURE = 'get_server_logs';

let commands = {}, helpers = {}, extensions = {};

const WEBSOCKET_ENDPOINT = (sessionId) => `${DEFAULT_WS_PATHNAME_PREFIX}/session/${sessionId}/appium/device/logcat`;

// https://github.com/SeleniumHQ/selenium/blob/0d425676b3c9df261dd641917f867d4d5ce7774d/java/client/src/org/openqa/selenium/logging/LogEntry.java
function toLogRecord (timestamp, level, message) {
  return {
    timestamp,
    level,
    message,
  };
}

extensions.supportedLogTypes = {
  logcat: {
    description: 'Logs for Android applications on real device and emulators via ADB',
    getter: async (self) => await self.adb.getLogcatLogs(),
  },
  bugreport: {
    description: `'adb bugreport' output for advanced issues diagnostic`,
    getter: async (self) => {
      const output = await self.adb.bugreport();
      const timestamp = Date.now();
      return output.split(os.EOL)
        .map((x) => toLogRecord(timestamp, 'ALL', x));
    },
  },
  server: {
    description: 'Appium server logs',
    getter: (self) => {
      self.ensureFeatureEnabled(GET_SERVER_LOGS_FEATURE);
      const timestamp = Date.now();
      return log.unwrap().record
        .map((x) => toLogRecord(timestamp,
                                'ALL',
                                _.isEmpty(x.prefix) ? x.message : `[${x.prefix}] ${x.message}`)
        );
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
 */
commands.mobileStartLogsBroadcast = async function mobileStartLogsBroadcast () {
  const pathname = WEBSOCKET_ENDPOINT(this.sessionId);
  if (!_.isEmpty(await this.server.getWebSocketHandlers(pathname))) {
    log.debug(`The logcat broadcasting web socket server is already listening at ${pathname}`);
    return;
  }

  log.info(`Assigning logcat broadcasting web socket server to ${pathname}`);
  // https://github.com/websockets/ws/blob/master/doc/ws.md
  const wss = new WebSocket.Server({
    noServer: true,
  });
  wss.on('connection', (ws, req) => {
    if (req) {
      const remoteIp = _.isEmpty(req.headers['x-forwarded-for'])
        ? req.connection.remoteAddress
        : req.headers['x-forwarded-for'];
      log.debug(`Established a new logcat listener web socket connection from ${remoteIp}`);
    } else {
      log.debug('Established a new logcat listener web socket connection');
    }

    if (_.isEmpty(this._logcatWebsocketListener)) {
      this._logcatWebsocketListener = (logRecord) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
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
        this._logcatWebsocketListener = null;
      }

      let closeMsg = 'Logcat listener web socket is closed.';
      if (!_.isEmpty(code)) {
        closeMsg += ` Code: ${code}.`;
      }
      if (!_.isEmpty(reason)) {
        closeMsg += ` Reason: ${reason}.`;
      }
      log.debug(closeMsg);
    });
  });
  await this.server.addWebSocketHandler(pathname, wss);
};

/**
 * Stops the previously started logcat broadcasting wesocket server.
 * This method will return immediately if no server is running.
 */
commands.mobileStopLogsBroadcast = async function mobileStopLogsBroadcast () {
  const pathname = WEBSOCKET_ENDPOINT(this.sessionId);
  if (_.isEmpty(await this.server.getWebSocketHandlers(pathname))) {
    return;
  }

  log.debug('Stopping the logcat broadcasting web socket server');
  await this.server.removeWebSocketHandler(pathname);
};

commands.getLogTypes = async function getLogTypes () {
  const nativeLogTypes = await BaseDriver.prototype.getLogTypes.call(this);
  if (this.isWebContext()) {
    const webLogTypes = await this.chromedriver.jwproxy.command('/log/types', 'GET');
    return [...nativeLogTypes, ...webLogTypes];
  }
  return nativeLogTypes;
};

commands.getLog = async function getLog (logType) {
  if (this.isWebContext() && !_.keys(this.supportedLogTypes).includes(logType)) {
    return await this.chromedriver.jwproxy.command('/log', 'POST', {type: logType});
  }
  return await BaseDriver.prototype.getLog.call(this, logType);
};

Object.assign(extensions, commands, helpers);
export { commands, helpers };
export default extensions;
