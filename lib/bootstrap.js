import UiAutomator from './uiautomator';
import net from 'net';
import path from 'path';
import _ from 'lodash';
import { errorFromCode } from 'appium-base-driver';
import B from 'bluebird';
import { logger } from 'appium-support';


const log = logger.getLogger('AndroidBootstrap');
const COMMAND_TYPES = {
  ACTION: 'action',
  SHUTDOWN: 'shutdown'
};
const SEND_COMMAND_TIMEOUT = 1 * 60 * 1000;

class AndroidBootstrap {
  constructor (adb, systemPort = 4724, webSocket = undefined) {
    this.adb = adb;
    this.systemPort = systemPort;
    this.webSocket = webSocket;
    this.ignoreUnexpectedShutdown = false;
  }

  get onUnexpectedShutdown () {
    if (!this._onUnexpectedShutdownPromise) {
      let reject;
      this._onUnexpectedShutdownPromise = new B(function _onUnexpectedShutdownPromise (_resolve, _reject) {
        reject = _reject;
      });
      this._onUnexpectedShutdownPromise.cancel = reject;
    }
    return this._onUnexpectedShutdownPromise;
  }

  async start (appPackage, disableAndroidWatchers = false, acceptSslCerts = false) {
    try {
      const rootDir = path.resolve(__dirname, '..', '..');
      const startDetector = (s) => { return /Appium Socket Server Ready/.test(s); };
      const bootstrapJar = path.resolve(rootDir, 'bootstrap', 'bin', 'AppiumBootstrap.jar');

      await this.init();
      await this.adb.forwardPort(this.systemPort, 4724);
      this.process = await this.uiAutomator.start(
                       bootstrapJar, 'io.appium.android.bootstrap.Bootstrap',
                       startDetector, '-e', 'pkg', appPackage,
                       '-e', 'disableAndroidWatchers', disableAndroidWatchers,
                       '-e', 'acceptSslCerts', acceptSslCerts);

      // process the output
      this.process.on('output', (stdout, stderr) => {
        const alertRe = /Emitting system alert message/;
        if (alertRe.test(stdout)) {
          log.debug('Emitting alert message...');
          if (this.webSocket) {
            this.webSocket.sockets.emit('alert', {message: stdout});
          }
        }

        // the bootstrap logger wraps its own log lines with
        // [APPIUM-UIAUTO] ... [APPIUM-UIAUTO]
        // and leaves actual UiAutomator logs as they are
        let stdoutLines = (stdout || '').split('\n');
        const uiautoLog = /\[APPIUM-UIAUTO\](.+)\[\/APPIUM-UIAUTO\]/;
        for (let line of stdoutLines) {
          if (line.trim()) {
            if (uiautoLog.test(line)) {
              let innerLine = uiautoLog.exec(line)[1].trim();
              let logMethod = log.info.bind(log);
              // if the bootstrap log considers something debug, log that as
              // debug and not info
              if (/\[debug\]/.test(innerLine)) {
                logMethod = log.debug.bind(log);
              }
              logMethod(`[BOOTSTRAP LOG] ${innerLine}`);
            } else {
              log.debug(`[UIAUTO STDOUT] ${line}`);
            }
          }
        }

        let stderrLines = (stderr || '').split('\n');
        for (let line of stderrLines) {
          if (line.trim()) {
            log.debug(`[UIAUTO STDERR] ${line}`);
          }
        }
      });

      // only return when the socket client has connected
      return await new B((resolve, reject) => {
        try {
          this.socketClient = net.connect(this.systemPort);
          // Windows: the socket errors out when ADB restarts. Let's catch it to avoid crashing.
          this.socketClient.on('error', (err) => {
            if (!this.ignoreUnexpectedShutdown) {
              throw new Error(`Android bootstrap socket crashed: ${err}`);
            }
          });
          this.socketClient.once('connect', () => {
            log.info('Android bootstrap socket is now connected');
            resolve();
          });
        } catch (err) {
          reject(err);
        }
      });
    } catch (err) {
      log.errorAndThrow(`Error occured while starting AndroidBootstrap. Original error: ${err}`);
    }
  }

  async sendCommand (type, extra = {}) {
    if (!this.socketClient) {
      throw new Error('Socket connection closed unexpectedly');
    }

    return await new B((resolve, reject) => {
      let cmd = Object.assign({cmd: type}, extra);
      let cmdJson = `${JSON.stringify(cmd)} \n`;
      log.debug(`Sending command to android: ${_.truncate(cmdJson, {length: 1000}).trim()}`);
      this.socketClient.write(cmdJson);
      this.socketClient.setEncoding('utf8');
      let streamData = '';
      let sendCommandTimeoutHandler = null;
      this.socketClient.on('data', (data) => {
        if (sendCommandTimeoutHandler) {
          clearTimeout(sendCommandTimeoutHandler);
        }
        log.debug('Received command result from bootstrap');
        try {
          streamData = JSON.parse(streamData + data);
          // we successfully parsed JSON so we've got all the data,
          // remove the socket listener and evaluate
          this.socketClient.removeAllListeners('data');
          if (streamData.status === 0) {
            return resolve(streamData.value);
          }
          reject(errorFromCode(streamData.status, streamData.value));
        } catch (err) {
          if (!_.isString(streamData)) {
            log.error('Got an unexpected error inside socket listener');
            log.error(err.stack);
            return reject(errorFromCode(13, err.message));
          }
          log.debug(`Stream still not complete, waiting up to ${SEND_COMMAND_TIMEOUT}ms for the data to arrive`);
          streamData += data;
          sendCommandTimeoutHandler = setTimeout(() => {
            const errMsg = `Server socket stopped responding. The recent response was '${streamData}'`;
            log.error(errMsg);
            this.socketClient.removeAllListeners('data');
            reject(errorFromCode(13, errMsg));
          }, SEND_COMMAND_TIMEOUT);
        }
      });
    });
  }

  async sendAction (action, params = {}) {
    let extra = {action, params};
    return await this.sendCommand(COMMAND_TYPES.ACTION, extra);
  }

  async shutdown () {
    if (!this.uiAutomator) {
      log.warn('Cannot shut down Android bootstrap; it has already shut down');
      return;
    }

    // remove listners so we don't trigger unexpected shutdown
    this.uiAutomator.removeAllListeners(UiAutomator.EVENT_CHANGED);
    if (this.socketClient) {
      await this.sendCommand(COMMAND_TYPES.SHUTDOWN);
    }
    await this.uiAutomator.shutdown();
    this.uiAutomator = null;
  }

  // this helper function makes unit testing easier.
  async init () { // eslint-disable-line require-await
    this.uiAutomator = new UiAutomator(this.adb);

    // Handle unexpected UiAutomator shutdown
    this.uiAutomator.on(UiAutomator.EVENT_CHANGED, (msg) => {
      if (msg.state === UiAutomator.STATE_STOPPED) {
        this.uiAutomator = null;
        this.onUnexpectedShutdown.cancel(new Error('UiAUtomator shut down unexpectedly'));
      }
    });
  }

  set ignoreUnexpectedShutdown (ignore) {
    log.debug(`${ignore ? 'Ignoring' : 'Watching for'} bootstrap disconnect`);
    this._ignoreUnexpectedShutdown = ignore;
  }

  get ignoreUnexpectedShutdown () {
    return this._ignoreUnexpectedShutdown;
  }
}

export { AndroidBootstrap, COMMAND_TYPES };
export default AndroidBootstrap;
