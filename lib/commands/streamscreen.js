import _ from 'lodash';
import { fs, system } from 'appium-support';
import log from '../logger';
import { exec, SubProcess } from 'teen_process';
import { checkPortStatus } from 'portscanner';
import http from 'http';
import net from 'net';
import B from 'bluebird';
import { waitForCondition } from 'asyncbox';


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
  multipartmux: 'gst-plugins-base',
};
const SCREENRECORD_BINARY = 'screenrecord';
const GST_TUTORIAL_URL = 'https://gstreamer.freedesktop.org/documentation/installing/index.html';
const DEFAULT_HOST = '127.0.0.1';
const TCP_HOST = '127.0.0.1';
const DEFAULT_PORT = 8093;
const DEFAULT_QUALITY = 70;
const DEFAULT_BITRATE = 4000000; // Mbps
const BOUNDARY_STRING = '--2ae9746887f170b8cf7c271047ce314c';


async function verifyStreamingRequirements (adb) {
  if (!_.trim(await adb.shell(['which', SCREENRECORD_BINARY]))) {
    throw new Error(
      `The required '${SCREENRECORD_BINARY}' binary is not available on the device under test`);
  }

  for (const binaryName of [GSTREAMER_BINARY, GST_INSPECT_BINARY]) {
    try {
      await fs.which(binaryName);
    } catch (e) {
      throw new Error(`The ${binaryName} is not available in PATH on the host system. ` +
        `See ${GST_TUTORIAL_URL} for more details on how to install it.`);
    }
  }

  for (const [name, modName] of _.toPairs(REQUIRED_GST_PLUGINS)) {
    const {stdout} = await exec(GST_INSPECT_BINARY, [name]);
    if (!_.includes(stdout, modName)) {
      throw new Error(
        `The required GStreamer plugin '${name}' from '${modName}' module is not installed. ` +
        `See ${GST_TUTORIAL_URL} for more details on how to install it.`);
    }
  }
}

async function getDeviceInfo (adb) {
  const output = await adb.shell(['dumpsys', 'display']);
  const widthMatch = /\bdeviceWidth=(\d+)/.exec(output);
  if (!widthMatch) {
    throw new Error(`Cannot parse the device width from ${output}`);
  }
  const heightMatch = /\bdeviceHeight=(\d+)/.exec(output);
  if (!heightMatch) {
    throw new Error(`Cannot parse the device height from ${output}`);
  }
  const fpsMatch = /\bfps=(\d+)/.exec();
  if (!fpsMatch) {
    throw new Error(`Cannot parse the device FPS from ${output}`);
  }
  return {
    width: parseInt(widthMatch[1], 10),
    height: parseInt(heightMatch[1], 10),
    fps: parseInt(fpsMatch[1], 10),
  };
}

async function initDeviceStreaming (adb, deviceInfo, opts = {}) {
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
  const deviceStreaming = adb.createSubProcess([
    'exec-out',
    // The loop is required, because by default the maximum record duration
    // for screenrecord is always limited
    `while true; do ${screenRecordCmd} -; done`,
  ]);
  deviceStreaming.on('exit', (code, signal) => {
    log.debug(`Device streaming process exited with code ${code}, signal ${signal}`);
  });
  const adbErrorsListener = deviceStreaming.on('output', (stdout, stderr) => {
    if (_.trim(stderr)) {
      log.debug(stderr);
    }
  });
  try {
    log.info(`Starting device streaming: ${deviceStreaming.rep}`);
    await deviceStreaming.start(null, STREAMING_STARTUP_TIMEOUT_MS);
  } catch (e) {
    log.errorAndThrow(
      `Cannot start the screen streaming process. Original error: ${e.message}`);
  } finally {
    deviceStreaming.removeListener(adbErrorsListener);
  }
  return deviceStreaming;
}

async function initGstreamerPipeline (deviceStreaming, deviceInfo, opts = {}) {
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
    '!', 'avdec_h264', 'skip-frame=5',
    '!', 'queue',
    '!', 'jpegenc', `quality=${quality}`,
    '!', 'multipartmux', `boundary=${BOUNDARY_STRING}`,
    '!', 'tcpserversink', `host=${TCP_HOST}`, `port=${tcpPort}`,
  ], {
    stdio: [deviceStreaming.proc.stdout, 'pipe', 'pipe']
  });
  gstreamerPipeline.on('exit', (code, signal) => {
    log.debug(`Pipeline streaming process exited with code ${code}, signal ${signal}`);
  });
  const gstListener = gstreamerPipeline.on('output', (stdout, stderr) => {
    if (_.trim(stderr || stdout)) {
      log.debug(stderr || stdout);
    }
  });
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
      gstreamerPipeline.removeListener(gstListener);
    }
  }
  return gstreamerPipeline;
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
 *
 * @param {?StartScreenStreamingOptions} options - The available options.
 * @throws {Error} If screen streaming has failed to start or is not supported on the host system.
 */
commands.mobileStartScreenStreaming = async function mobileStartScreenStreaming (options = {}) {
  const {
    width,
    height,
    bitRate,
    host = DEFAULT_HOST,
    port = DEFAULT_PORT,
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
  this._screenStreamingProps = null;

  if ((await checkPortStatus(port, host)) === 'open') {
    log.info(`The port #${port} at ${host} is busy. ` +
      `Assuming the screen streaming is already running`);
    return;
  }
  if ((await checkPortStatus(tcpPort, TCP_HOST)) === 'open') {
    log.errorAndThrow(`The port #${tcpPort} at ${TCP_HOST} is busy. ` +
      `Make sure there are no leftovers from previous sessions.`);
    return;
  }

  const deviceInfo = await getDeviceInfo(this.adb);
  const deviceStreaming = await initDeviceStreaming(this.adb, deviceInfo, {
    width,
    height,
    bitRate,
  });
  const gstreamerPipeline = await initGstreamerPipeline(deviceStreaming, deviceInfo, {
    width,
    height,
    quality,
    tcpPort,
    considerRotation,
    logPipelineDetails,
  });

  const mjpegSocket = net.createConnection(tcpPort, TCP_HOST);
  let mjpegServer;
  await new B((resolve, reject) => {
    mjpegSocket.on('error', (e) => {
      log.warn(e);
      if (mjpegServer) {
        mjpegServer.close();
      }
      reject(e);
    });
    mjpegSocket.on('connect', () => {
      log.info(`Successfully connected to MJPEG stream at tcp://${TCP_HOST}:${tcpPort}`);
      mjpegServer = http.createServer((req, res) => {
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
        mjpegSocket.end();
        reject(e);
      });
      mjpegServer.on('close', () => {
        log.debug(`MJPEG server at http://${host}:${port} has been terminated`);
        mjpegSocket.end();
      });
      mjpegServer.on('listening', () => {
        log.info(`Successfully started MJPEG server at http://${host}:${port}`);
        resolve();
      });
      mjpegServer.listen(port, host);
    });
  });

  this._screenStreamingProps = {
    deviceStreaming,
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
    deviceStreaming,
    gstreamerPipeline,
    mjpegSocket,
    mjpegServer,
  } = this._screenStreamingProps;

  try {
    mjpegSocket.end();
    if (mjpegServer.listening) {
      mjpegServer.close();
    }
    if (deviceStreaming.isRunning) {
      try {
        await deviceStreaming.stop('SIGINT');
      } catch (e) {
        log.warn(e);
        try {
          await deviceStreaming.stop('SIGKILL');
        } catch (e1) {
          log.error(e1);
        }
      }
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
