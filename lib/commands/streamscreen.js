// @ts-check

import {fs, logger, system, util} from '@appium/support';
import {waitForCondition} from 'asyncbox';
import B from 'bluebird';
import _ from 'lodash';
import {spawn} from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import url from 'node:url';
import {checkPortStatus} from 'portscanner';
import {SubProcess, exec} from 'teen_process';

const RECORDING_INTERVAL_SEC = 5;
const STREAMING_STARTUP_TIMEOUT_MS = 5000;
const GSTREAMER_BINARY = `gst-launch-1.0${system.isWindows() ? '.exe' : ''}`;
const GST_INSPECT_BINARY = `gst-inspect-1.0${system.isWindows() ? '.exe' : ''}`;
const REQUIRED_GST_PLUGINS = {
  avdec_h264: 'gst-libav',
  h264parse: 'gst-plugins-bad',
  jpegenc: 'gst-plugins-good',
  tcpserversink: 'gst-plugins-base',
  multipartmux: 'gst-plugins-good',
};
const SCREENRECORD_BINARY = 'screenrecord';
const GST_TUTORIAL_URL = 'https://gstreamer.freedesktop.org/documentation/installing/index.html';
const DEFAULT_HOST = '127.0.0.1';
const TCP_HOST = '127.0.0.1';
const DEFAULT_PORT = 8093;
const DEFAULT_QUALITY = 70;
const DEFAULT_BITRATE = 4000000; // 4 Mbps
const BOUNDARY_STRING = '--2ae9746887f170b8cf7c271047ce314c';

const ADB_SCREEN_STREAMING_FEATURE = 'adb_screen_streaming';

/**
 * @this {import('../driver').AndroidDriver}
 * @param {import('./types').StartScreenStreamingOpts} [options={}]
 * @returns {Promise<void>}
 */
export async function mobileStartScreenStreaming(options = {}) {
  this.ensureFeatureEnabled(ADB_SCREEN_STREAMING_FEATURE);

  const {
    width,
    height,
    bitRate,
    host = DEFAULT_HOST,
    port = DEFAULT_PORT,
    pathname,
    tcpPort = DEFAULT_PORT + 1,
    quality = DEFAULT_QUALITY,
    considerRotation = false,
    logPipelineDetails = false,
  } = options;
  if (_.isUndefined(this._screenStreamingProps)) {
    await verifyStreamingRequirements(this.adb);
  }
  if (!_.isEmpty(this._screenStreamingProps)) {
    this.log.info(
      `The screen streaming session is already running. ` +
        `Stop it first in order to start a new one.`,
    );
    return;
  }
  if ((await checkPortStatus(port, host)) === 'open') {
    this.log.info(
      `The port #${port} at ${host} is busy. ` + `Assuming the screen streaming is already running`,
    );
    return;
  }
  if ((await checkPortStatus(tcpPort, TCP_HOST)) === 'open') {
    this.log.errorAndThrow(
      `The port #${tcpPort} at ${TCP_HOST} is busy. ` +
        `Make sure there are no leftovers from previous sessions.`,
    );
  }
  this._screenStreamingProps = undefined;

  const deviceInfo = await getDeviceInfo(this.adb, this.log);
  const deviceStreamingProc = await initDeviceStreamingProc(this.adb, this.log, deviceInfo, {
    width,
    height,
    bitRate,
  });
  let gstreamerPipeline;
  try {
    gstreamerPipeline = await initGstreamerPipeline(deviceStreamingProc, deviceInfo, this.log, {
      width,
      height,
      quality,
      tcpPort,
      considerRotation,
      logPipelineDetails,
    });
  } catch (e) {
    if (deviceStreamingProc.kill(0)) {
      deviceStreamingProc.kill();
    }
    throw e;
  }

  /** @type {import('node:net').Socket|undefined} */
  let mjpegSocket;
  /** @type {import('node:http').Server|undefined} */
  let mjpegServer;
  try {
    await new B((resolve, reject) => {
      mjpegSocket = net.createConnection(tcpPort, TCP_HOST, () => {
        this.log.info(`Successfully connected to MJPEG stream at tcp://${TCP_HOST}:${tcpPort}`);
        mjpegServer = http.createServer((req, res) => {
          const remoteAddress = extractRemoteAddress(req);
          const currentPathname = url.parse(String(req.url)).pathname;
          this.log.info(
            `Got an incoming screen broadcasting request from ${remoteAddress} ` +
              `(${req.headers['user-agent'] || 'User Agent unknown'}) at ${currentPathname}`,
          );

          if (pathname && currentPathname !== pathname) {
            this.log.info(
              'Rejecting the broadcast request since it does not match the given pathname',
            );
            res.writeHead(404, {
              Connection: 'close',
              'Content-Type': 'text/plain; charset=utf-8',
            });
            res.write(`'${currentPathname}' did not match any known endpoints`);
            res.end();
            return;
          }

          this.log.info('Starting MJPEG broadcast');
          res.writeHead(200, {
            'Cache-Control':
              'no-store, no-cache, must-revalidate, pre-check=0, post-check=0, max-age=0',
            Pragma: 'no-cache',
            Connection: 'close',
            'Content-Type': `multipart/x-mixed-replace; boundary=${BOUNDARY_STRING}`,
          });

          /** @type {import('node:net').Socket} */ (mjpegSocket).pipe(res);
        });
        mjpegServer.on('error', (e) => {
          this.log.warn(e);
          reject(e);
        });
        mjpegServer.on('close', () => {
          this.log.debug(`MJPEG server at http://${host}:${port} has been closed`);
        });
        mjpegServer.on('listening', () => {
          this.log.info(`Successfully started MJPEG server at http://${host}:${port}`);
          resolve();
        });
        mjpegServer.listen(port, host);
      });
      mjpegSocket.on('error', (e) => {
        this.log.error(e);
        reject(e);
      });
    }).timeout(
      STREAMING_STARTUP_TIMEOUT_MS,
      `Cannot connect to the streaming server within ${STREAMING_STARTUP_TIMEOUT_MS}ms`,
    );
  } catch (e) {
    if (deviceStreamingProc.kill(0)) {
      deviceStreamingProc.kill();
    }
    if (gstreamerPipeline.isRunning) {
      await gstreamerPipeline.stop();
    }
    if (mjpegSocket) {
      mjpegSocket.destroy();
    }
    if (mjpegServer && mjpegServer.listening) {
      mjpegServer.close();
    }
    throw e;
  }

  this._screenStreamingProps = {
    deviceStreamingProc,
    gstreamerPipeline,
    mjpegSocket,
    mjpegServer,
  };
}

/**
 * @this {import('../driver').AndroidDriver}
 * @returns {Promise<void>}
 */
export async function mobileStopScreenStreaming() {
  if (_.isEmpty(this._screenStreamingProps)) {
    if (!_.isUndefined(this._screenStreamingProps)) {
      this.log.debug(`Screen streaming is not running. There is nothing to stop`);
    }
    return;
  }

  const {deviceStreamingProc, gstreamerPipeline, mjpegSocket, mjpegServer} =
    this._screenStreamingProps;

  try {
    mjpegSocket.end();
    if (mjpegServer.listening) {
      mjpegServer.close();
    }
    if (deviceStreamingProc.kill(0)) {
      deviceStreamingProc.kill('SIGINT');
    }
    if (gstreamerPipeline.isRunning) {
      try {
        await gstreamerPipeline.stop('SIGINT');
      } catch (e) {
        this.log.warn(e);
        try {
          await gstreamerPipeline.stop('SIGKILL');
        } catch (e1) {
          this.log.error(e1);
        }
      }
    }
    this.log.info(`Successfully terminated the screen streaming MJPEG server`);
  } finally {
    this._screenStreamingProps = undefined;
  }
}

// #region Internal helpers

/**
 *
 * @param {string} streamName
 * @param {string} udid
 * @returns {AppiumLogger}
 */
function createStreamingLogger(streamName, udid) {
  return logger.getLogger(
    `${streamName}@` +
      _.truncate(udid, {
        length: 8,
        omission: '',
      }),
  );
}

/**
 *
 * @param {ADB} adb
 */
async function verifyStreamingRequirements(adb) {
  if (!_.trim(await adb.shell(['which', SCREENRECORD_BINARY]))) {
    throw new Error(
      `The required '${SCREENRECORD_BINARY}' binary is not available on the device under test`,
    );
  }

  const gstreamerCheckPromises = [];
  for (const binaryName of [GSTREAMER_BINARY, GST_INSPECT_BINARY]) {
    gstreamerCheckPromises.push(
      (async () => {
        try {
          await fs.which(binaryName);
        } catch (e) {
          throw new Error(
            `The '${binaryName}' binary is not available in the PATH on the host system. ` +
              `See ${GST_TUTORIAL_URL} for more details on how to install it.`,
          );
        }
      })(),
    );
  }
  await B.all(gstreamerCheckPromises);

  const moduleCheckPromises = [];
  for (const [name, modName] of _.toPairs(REQUIRED_GST_PLUGINS)) {
    moduleCheckPromises.push(
      (async () => {
        const {stdout} = await exec(GST_INSPECT_BINARY, [name]);
        if (!_.includes(stdout, modName)) {
          throw new Error(
            `The required GStreamer plugin '${name}' from '${modName}' module is not installed. ` +
              `See ${GST_TUTORIAL_URL} for more details on how to install it.`,
          );
        }
      })(),
    );
  }
  await B.all(moduleCheckPromises);
}

const deviceInfoRegexes = /** @type {const} */ ([
  ['width', /\bdeviceWidth=(\d+)/],
  ['height', /\bdeviceHeight=(\d+)/],
  ['fps', /\bfps=(\d+)/],
]);

/**
 *
 * @param {ADB} adb
 * @param {AppiumLogger} [log]
 */
async function getDeviceInfo(adb, log) {
  const output = await adb.shell(['dumpsys', 'display']);
  /**
   * @type {DeviceInfo}
   */
  const result = {};
  for (const [key, pattern] of deviceInfoRegexes) {
    const match = pattern.exec(output);
    if (!match) {
      log?.debug(output);
      throw new Error(
        `Cannot parse the device ${key} from the adb command output. ` +
          `Check the server log for more details.`,
      );
    }
    result[key] = parseInt(match[1], 10);
  }
  result.udid = String(adb.curDeviceId);
  return result;
}

/**
 *
 * @param {ADB} adb
 * @param {AppiumLogger} log
 * @param {DeviceInfo} deviceInfo
 * @param {{width?: string|number, height?: string|number, bitRate?: string|number}} opts
 * @returns
 */
async function initDeviceStreamingProc(adb, log, deviceInfo, opts = {}) {
  const {width, height, bitRate} = opts;
  const adjustedWidth = _.isUndefined(width) ? deviceInfo.width : parseInt(String(width), 10);
  const adjustedHeight = _.isUndefined(height) ? deviceInfo.height : parseInt(String(height), 10);
  const adjustedBitrate = _.isUndefined(bitRate) ? DEFAULT_BITRATE : parseInt(String(bitRate), 10);
  let screenRecordCmd =
    SCREENRECORD_BINARY +
    ` --output-format=h264` +
    // 5 seconds is fine to detect rotation changes
    ` --time-limit=${RECORDING_INTERVAL_SEC}`;
  if (width || height) {
    screenRecordCmd += ` --size=${adjustedWidth}x${adjustedHeight}`;
  }
  if (bitRate) {
    screenRecordCmd += ` --bit-rate=${adjustedBitrate}`;
  }
  const adbArgs = [
    ...adb.executable.defaultArgs,
    'exec-out',
    // The loop is required, because by default the maximum record duration
    // for screenrecord is always limited
    `while true; do ${screenRecordCmd} -; done`,
  ];
  const deviceStreaming = spawn(adb.executable.path, adbArgs);
  deviceStreaming.on('exit', (code, signal) => {
    log.debug(`Device streaming process exited with code ${code}, signal ${signal}`);
  });

  let isStarted = false;
  const deviceStreamingLogger = createStreamingLogger(SCREENRECORD_BINARY, deviceInfo.udid);
  /**
   *
   * @param {Buffer|string} chunk
   */
  const errorsListener = (chunk) => {
    const stderr = chunk.toString();
    if (_.trim(stderr)) {
      deviceStreamingLogger.debug(stderr);
    }
  };
  deviceStreaming.stderr.on('data', errorsListener);

  /**
   *
   * @param {Buffer|string} chunk
   */
  const startupListener = (chunk) => {
    if (!isStarted) {
      isStarted = !_.isEmpty(chunk);
    }
  };
  deviceStreaming.stdout.on('data', startupListener);

  try {
    log.info(`Starting device streaming: ${util.quote([adb.executable.path, ...adbArgs])}`);
    await waitForCondition(() => isStarted, {
      waitMs: STREAMING_STARTUP_TIMEOUT_MS,
      intervalMs: 300,
    });
  } catch (e) {
    log.errorAndThrow(
      `Cannot start the screen streaming process. Original error: ${
        /** @type {Error} */ (e).message
      }`,
    );
  } finally {
    deviceStreaming.stderr.removeListener('data', errorsListener);
    deviceStreaming.stdout.removeListener('data', startupListener);
  }
  return deviceStreaming;
}

/**
 *
 * @param {import('node:child_process').ChildProcess} deviceStreamingProc
 * @param {DeviceInfo} deviceInfo
 * @param {AppiumLogger} log
 * @param {import('./types').InitGStreamerPipelineOpts} opts
 */
async function initGstreamerPipeline(deviceStreamingProc, deviceInfo, log, opts) {
  const {width, height, quality, tcpPort, considerRotation, logPipelineDetails} = opts;
  const adjustedWidth = parseInt(String(width), 10) || deviceInfo.width;
  const adjustedHeight = parseInt(String(height), 10) || deviceInfo.height;
  const gstreamerPipeline = new SubProcess(
    GSTREAMER_BINARY,
    [
      '-v',
      'fdsrc',
      'fd=0',
      '!',
      'video/x-h264,' +
        `width=${considerRotation ? Math.max(adjustedWidth, adjustedHeight) : adjustedWidth},` +
        `height=${considerRotation ? Math.max(adjustedWidth, adjustedHeight) : adjustedHeight},` +
        `framerate=${deviceInfo.fps}/1,` +
        'byte-stream=true',
      '!',
      'h264parse',
      '!',
      'queue',
      'leaky=downstream',
      '!',
      'avdec_h264',
      '!',
      'queue',
      'leaky=downstream',
      '!',
      'jpegenc',
      `quality=${quality}`,
      '!',
      'multipartmux',
      `boundary=${BOUNDARY_STRING}`,
      '!',
      'tcpserversink',
      `host=${TCP_HOST}`,
      `port=${tcpPort}`,
    ],
    {
      stdio: [deviceStreamingProc.stdout, 'pipe', 'pipe'],
    },
  );
  gstreamerPipeline.on('exit', (code, signal) => {
    log.debug(`Pipeline streaming process exited with code ${code}, signal ${signal}`);
  });
  const gstreamerLogger = createStreamingLogger('gst', deviceInfo.udid);
  /**
   *
   * @param {string} stdout
   * @param {string} stderr
   */
  const gstOutputListener = (stdout, stderr) => {
    if (_.trim(stderr || stdout)) {
      gstreamerLogger.debug(stderr || stdout);
    }
  };
  gstreamerPipeline.on('output', gstOutputListener);
  let didFail = false;
  try {
    log.info(`Starting GStreamer pipeline: ${gstreamerPipeline.rep}`);
    await gstreamerPipeline.start(0);
    await waitForCondition(
      async () => {
        try {
          return (await checkPortStatus(tcpPort, TCP_HOST)) === 'open';
        } catch (ign) {
          return false;
        }
      },
      {
        waitMs: STREAMING_STARTUP_TIMEOUT_MS,
        intervalMs: 300,
      },
    );
  } catch (e) {
    didFail = true;
    log.errorAndThrow(
      `Cannot start the screen streaming pipeline. Original error: ${
        /** @type {Error} */ (e).message
      }`,
    );
  } finally {
    if (!logPipelineDetails || didFail) {
      gstreamerPipeline.removeListener('output', gstOutputListener);
    }
  }
  return gstreamerPipeline;
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @privateRemarks This may need to be future-proofed, as `IncomingMessage.connection` is deprecated and its `socket` prop is likely private
 */
function extractRemoteAddress(req) {
  return (
    req.headers['x-forwarded-for'] ||
    req.socket.remoteAddress ||
    req.connection.remoteAddress ||
    // @ts-expect-error socket may be a private API??
    req.connection.socket.remoteAddress
  );
}

// #endregion

/**
 * @typedef {import('appium-adb').ADB} ADB
 * @typedef {import('@appium/types').AppiumLogger} AppiumLogger
 * @typedef {import('./types').DeviceInfo} DeviceInfo
 */
