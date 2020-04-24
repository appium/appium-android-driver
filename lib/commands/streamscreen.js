import _ from 'lodash';
import { fs, system, logger, util } from 'appium-support';
import log from '../logger';
import { exec, SubProcess } from 'teen_process';
import { checkPortStatus } from 'portscanner';
import http from 'http';
import net from 'net';
import B from 'bluebird';
import { waitForCondition } from 'asyncbox';
import { spawn } from 'child_process';
import url from 'url';

const commands = {};

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

function createStreamingLogger (streamName, udid) {
  return logger.getLogger(`${streamName}@` + _.truncate(udid, {
    length: 8,
    omission: '',
  }));
}

async function verifyStreamingRequirements (adb) {
  if (!_.trim(await adb.shell(['which', SCREENRECORD_BINARY]))) {
    throw new Error(
      `The required '${SCREENRECORD_BINARY}' binary is not available on the device under test`);
  }

  const gstreamerCheckPromises = [];
  for (const binaryName of [GSTREAMER_BINARY, GST_INSPECT_BINARY]) {
    gstreamerCheckPromises.push((async () => {
      try {
        await fs.which(binaryName);
      } catch (e) {
        throw new Error(`The '${binaryName}' binary is not available in the PATH on the host system. ` +
          `See ${GST_TUTORIAL_URL} for more details on how to install it.`);
      }
    })());
  }
  await B.all(gstreamerCheckPromises);

  const moduleCheckPromises = [];
  for (const [name, modName] of _.toPairs(REQUIRED_GST_PLUGINS)) {
    moduleCheckPromises.push((async () => {
      const {stdout} = await exec(GST_INSPECT_BINARY, [name]);
      if (!_.includes(stdout, modName)) {
        throw new Error(
          `The required GStreamer plugin '${name}' from '${modName}' module is not installed. ` +
          `See ${GST_TUTORIAL_URL} for more details on how to install it.`);
      }
    })());
  }
  await B.all(moduleCheckPromises);
}

async function getDeviceInfo (adb) {
  const output = await adb.shell(['dumpsys', 'display']);
  const result = {};
  for (const [key, pattern] of [
    ['width', /\bdeviceWidth=(\d+)/],
    ['height', /\bdeviceHeight=(\d+)/],
    ['fps', /\bfps=(\d+)/],
  ]) {
    const match = pattern.exec(output);
    if (!match) {
      log.debug(output);
      throw new Error(`Cannot parse the device ${key} from the adb command output. ` +
        `Check the server log for more details.`);
    }
    result[key] = parseInt(match[1], 10);
  }
  result.udid = adb.curDeviceId;
  return result;
}

async function initDeviceStreamingProc (adb, deviceInfo, opts = {}) {
  const {
    width,
    height,
    bitRate,
  } = opts;
  const adjustedWidth = parseInt(width, 10) || deviceInfo.width;
  const adjustedHeight = parseInt(height, 10) || deviceInfo.height;
  const adjustedBitrate = parseInt(bitRate, 10) || DEFAULT_BITRATE;
  let screenRecordCmd = SCREENRECORD_BINARY +
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
  const errorsListener = (chunk) => {
    const stderr = chunk.toString();
    if (_.trim(stderr)) {
      deviceStreamingLogger.debug(stderr);
    }
  };
  deviceStreaming.stderr.on('data', errorsListener);

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
      `Cannot start the screen streaming process. Original error: ${e.message}`);
  } finally {
    deviceStreaming.stderr.removeListener('data', errorsListener);
    deviceStreaming.stdout.removeListener('data', startupListener);
  }
  return deviceStreaming;
}

async function initGstreamerPipeline (deviceStreamingProc, deviceInfo, opts = {}) {
  const {
    width,
    height,
    quality,
    tcpPort,
    considerRotation,
    logPipelineDetails,
  } = opts;
  const adjustedWidth = parseInt(width, 10) || deviceInfo.width;
  const adjustedHeight = parseInt(height, 10) || deviceInfo.height;
  const gstreamerPipeline = new SubProcess(GSTREAMER_BINARY, [
    '-v',
    'fdsrc', 'fd=0',
    '!', 'video/x-h264,' +
      `width=${considerRotation ? Math.max(adjustedWidth, adjustedHeight) : adjustedWidth},` +
      `height=${considerRotation ? Math.max(adjustedWidth, adjustedHeight) : adjustedHeight},` +
      `framerate=${deviceInfo.fps}/1,` +
      'byte-stream=true',
    '!', 'h264parse',
    '!', 'queue', 'leaky=downstream',
    '!', 'avdec_h264',
    '!', 'queue', 'leaky=downstream',
    '!', 'jpegenc', `quality=${quality}`,
    '!', 'multipartmux', `boundary=${BOUNDARY_STRING}`,
    '!', 'tcpserversink', `host=${TCP_HOST}`, `port=${tcpPort}`,
  ], {
    stdio: [deviceStreamingProc.stdout, 'pipe', 'pipe']
  });
  gstreamerPipeline.on('exit', (code, signal) => {
    log.debug(`Pipeline streaming process exited with code ${code}, signal ${signal}`);
  });
  const gstreamerLogger = createStreamingLogger('gst', deviceInfo.udid);
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
    await waitForCondition(async () => {
      try {
        return (await checkPortStatus(tcpPort, TCP_HOST)) === 'open';
      } catch (ign) {
        return false;
      }
    }, {
      waitMs: STREAMING_STARTUP_TIMEOUT_MS,
      intervalMs: 300,
    });
  } catch (e) {
    didFail = true;
    log.errorAndThrow(
      `Cannot start the screen streaming pipeline. Original error: ${e.message}`);
  } finally {
    if (!logPipelineDetails || didFail) {
      gstreamerPipeline.removeListener('output', gstOutputListener);
    }
  }
  return gstreamerPipeline;
}

function extractRemoteAddress (req) {
  return req.headers['x-forwarded-for']
    || req.socket.remoteAddress
    || req.connection.remoteAddress
    || req.connection.socket.remoteAddress;
}


/**
 * @typedef {Object} StartScreenStreamingOptions
 *
 * @property {?number} width - The scaled width of the device's screen. If unset then the script will assign it
 * to the actual screen width measured in pixels.
 * @property {?number} height - The scaled height of the device's screen. If unset then the script will assign it
 * to the actual screen height measured in pixels.
 * @property {?number} bitRate - The video bit rate for the video, in bits per second.
 * The default value is 4000000 (4 Mb/s). You can increase the bit rate to improve video quality,
 * but doing so results in larger movie files.
 * @property {?string} host [127.0.0.1] - The IP address/host name to start the MJPEG server on.
 * You can set it to `0.0.0.0` to trigger the broadcast on all available network interfaces.
 * @property {?string} pathname - The HTTP request path the MJPEG server should be available on.
 * If unset then any pathname on the given `host`/`port` combination will work. Note that the value
 * should always start with a single slash: `/`
 * @property {?number} tcpPort [8094] - The port number to start the internal TCP MJPEG broadcast on.
 * This type of broadcast always starts on the loopback interface (`127.0.0.1`).
 * @property {?number} port [8093] - The port number to start the MJPEG server on.
 * @property {?number} quality [70] - The quality value for the streamed JPEG images.
 * This number should be in range [1, 100], where 100 is the best quality.
 * @property {?boolean} considerRotation [false] - If set to `true` then GStreamer pipeline will
 * increase the dimensions of the resulting images to properly fit images in both landscape and
 * portrait orientations. Set it to `true` if the device rotation is not going to be the same during the
 * broadcasting session.
 * @property {?boolean} logPipelineDetails [false] - Whether to log GStreamer pipeline events into
 * the standard log output. Might be useful for debugging purposes.
 */

/**
 * Starts device screen broadcast by creating MJPEG server.
 * Multiple calls to this method have no effect unless the previous streaming
 * session is stopped.
 * This method only works if the `adb_screen_streaming` feature is
 * enabled on the server side.
 *
 * @param {?StartScreenStreamingOptions} options - The available options.
 * @throws {Error} If screen streaming has failed to start or
 * is not supported on the host system or
 * the corresponding server feature is not enabled.
 */
commands.mobileStartScreenStreaming = async function mobileStartScreenStreaming (options = {}) {
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
    log.info(`The screen streaming session is already running. ` +
      `Stop it first in order to start a new one.`);
    return;
  }
  if ((await checkPortStatus(port, host)) === 'open') {
    log.info(`The port #${port} at ${host} is busy. ` +
      `Assuming the screen streaming is already running`);
    return;
  }
  if ((await checkPortStatus(tcpPort, TCP_HOST)) === 'open') {
    log.errorAndThrow(`The port #${tcpPort} at ${TCP_HOST} is busy. ` +
      `Make sure there are no leftovers from previous sessions.`);
  }
  this._screenStreamingProps = null;

  const deviceInfo = await getDeviceInfo(this.adb);
  const deviceStreamingProc = await initDeviceStreamingProc(this.adb, deviceInfo, {
    width,
    height,
    bitRate,
  });
  let gstreamerPipeline;
  try {
    gstreamerPipeline = await initGstreamerPipeline(deviceStreamingProc, deviceInfo, {
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

  let mjpegSocket;
  let mjpegServer;
  try {
    await new B((resolve, reject) => {
      mjpegSocket = net.createConnection(tcpPort, TCP_HOST, () => {
        log.info(`Successfully connected to MJPEG stream at tcp://${TCP_HOST}:${tcpPort}`);
        mjpegServer = http.createServer((req, res) => {
          const remoteAddress = extractRemoteAddress(req);
          const currentPathname = url.parse(req.url).pathname;
          log.info(`Got an incoming screen bradcasting request from ${remoteAddress} ` +
            `(${req.headers['user-agent'] || 'User Agent unknown'}) at ${currentPathname}`);

          if (pathname && currentPathname !== pathname) {
            log.info('Rejecting the broadcast request since it does not match the given pathname');
            res.writeHead(404, {
              Connection: 'close',
              'Content-Type': 'text/plain; charset=utf-8',
            });
            res.write(`'${currentPathname}' did not match any known endpoints`);
            res.end();
            return;
          }

          log.info('Starting MJPEG broadcast');
          res.writeHead(200, {
            'Cache-Control': 'no-store, no-cache, must-revalidate, pre-check=0, post-check=0, max-age=0',
            Pragma: 'no-cache',
            Connection: 'close',
            'Content-Type': `multipart/x-mixed-replace; boundary=${BOUNDARY_STRING}`
          });

          mjpegSocket.pipe(res);
        });
        mjpegServer.on('error', (e) => {
          log.warn(e);
          reject(e);
        });
        mjpegServer.on('close', () => {
          log.debug(`MJPEG server at http://${host}:${port} has been closed`);
        });
        mjpegServer.on('listening', () => {
          log.info(`Successfully started MJPEG server at http://${host}:${port}`);
          resolve();
        });
        mjpegServer.listen(port, host);
      });
      mjpegSocket.on('error', (e) => {
        log.error(e);
        reject(e);
      });
    }).timeout(STREAMING_STARTUP_TIMEOUT_MS,
      `Cannot connect to the streaming server within ${STREAMING_STARTUP_TIMEOUT_MS}ms`);
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
};

/**
 * Stop screen streaming.
 * If no screen streaming server has been started then nothing is done.
 */
commands.mobileStopScreenStreaming = async function mobileStopScreenStreaming (/* options = {} */) {
  if (_.isEmpty(this._screenStreamingProps)) {
    if (!_.isUndefined(this._screenStreamingProps)) {
      log.debug(`Screen streaming is not running. There is nothing to stop`);
    }
    return;
  }

  const {
    deviceStreamingProc,
    gstreamerPipeline,
    mjpegSocket,
    mjpegServer,
  } = this._screenStreamingProps;

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
        log.warn(e);
        try {
          await gstreamerPipeline.stop('SIGKILL');
        } catch (e1) {
          log.error(e1);
        }
      }
    }
    log.info(`Successfully terminated the screen streaming MJPEG server`);
  } finally {
    this._screenStreamingProps = null;
  }
};


export default commands;
