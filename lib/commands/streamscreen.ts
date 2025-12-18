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
import type {AndroidDriver} from '../driver';
import type {ADB} from 'appium-adb';
import type {AppiumLogger} from '@appium/types';
import type {DeviceInfo, InitGStreamerPipelineOpts} from './types';

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
} as const;
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
 * Starts a screen streaming session that broadcasts the device screen as an MJPEG stream.
 *
 * This method uses Android's `screenrecord` command to capture the screen and GStreamer
 * to encode it as an MJPEG stream accessible via HTTP. The stream can be viewed in any
 * web browser or MJPEG-compatible client.
 *
 * Requirements:
 * - The device must have the `screenrecord` binary available
 * - The host system must have GStreamer installed with required plugins
 * - The ADB screen streaming feature must be enabled
 *
 * @param width The scaled width of the device's screen.
 * If unset then the script will assign it to the actual screen width measured
 * in pixels.
 * @param height The scaled height of the device's screen.
 * If unset then the script will assign it to the actual screen height
 * measured in pixels.
 * @param bitRate The video bit rate for the video, in bits per second.
 * The default value is 4 Mb/s. You can increase the bit rate to improve video
 * quality, but doing so results in larger movie files.
 * @param host The IP address/host name to start the MJPEG server on.
 * You can set it to `0.0.0.0` to trigger the broadcast on all available
 * network interfaces.
 * @param port The port number to start the MJPEG server on.
 * @param tcpPort The port number to start the internal TCP MJPEG broadcast on.
 * @param pathname The HTTP request path the MJPEG server should be available on.
 * If unset, then any pathname on the given `host`/`port` combination will
 * work. Note that the value should always start with a single slash: `/`
 * @param quality The quality value for the streamed JPEG images.
 * This number should be in range `[1,100]`, where `100` is the best quality.
 * @param considerRotation If set to `true` then GStreamer pipeline will increase the dimensions of
 * the resulting images to properly fit images in both landscape and portrait
 * orientations.
 * Set it to `true` if the device rotation is not going to be the same during
 * the broadcasting session.
 * @param logPipelineDetails Whether to log GStreamer pipeline events into the standard log output.
 * Might be useful for debugging purposes.
 * @throws {Error} If streaming requirements are not met, ports are busy, or streaming fails to start.
 */
export async function mobileStartScreenStreaming(
  this: AndroidDriver,
  width?: number,
  height?: number,
  bitRate?: number,
  host: string = DEFAULT_HOST,
  port: number = DEFAULT_PORT,
  pathname?: string,
  tcpPort: number = DEFAULT_PORT + 1,
  quality: number = DEFAULT_QUALITY,
  considerRotation: boolean = false,
  logPipelineDetails: boolean = false,
): Promise<void> {
  this.assertFeatureEnabled(ADB_SCREEN_STREAMING_FEATURE);

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
    throw this.log.errorWithException(
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

  let mjpegSocket: net.Socket | undefined;
  let mjpegServer: http.Server | undefined;
  try {
    await new B<void>((resolve, reject) => {
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

          if (mjpegSocket) {
            mjpegSocket.pipe(res);
          }
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
    if (mjpegServer?.listening) {
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
 * Stops the currently running screen streaming session.
 *
 * This method gracefully terminates all processes involved in screen streaming:
 * - The MJPEG HTTP server
 * - The GStreamer pipeline
 * - The device screen recording process
 *
 * If no streaming session is active, this method returns without error.
 */
export async function mobileStopScreenStreaming(this: AndroidDriver): Promise<void> {
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

function createStreamingLogger(streamName: string, udid: string): AppiumLogger {
  return logger.getLogger(
    `${streamName}@` +
      _.truncate(udid, {
        length: 8,
        omission: '',
      }),
  );
}

async function verifyStreamingRequirements(adb: ADB): Promise<void> {
  if (!_.trim(await adb.shell(['which', SCREENRECORD_BINARY]))) {
    throw new Error(
      `The required '${SCREENRECORD_BINARY}' binary is not available on the device under test`,
    );
  }

  const gstreamerCheckPromises: Promise<void>[] = [];
  for (const binaryName of [GSTREAMER_BINARY, GST_INSPECT_BINARY]) {
    gstreamerCheckPromises.push(
      (async () => {
        try {
          await fs.which(binaryName);
        } catch {
          throw new Error(
            `The '${binaryName}' binary is not available in the PATH on the host system. ` +
              `See ${GST_TUTORIAL_URL} for more details on how to install it.`,
          );
        }
      })(),
    );
  }
  await B.all(gstreamerCheckPromises);

  const moduleCheckPromises: Promise<void>[] = [];
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

const deviceInfoRegexes = [
  ['width', /\bdeviceWidth=(\d+)/],
  ['height', /\bdeviceHeight=(\d+)/],
  ['fps', /\bfps=(\d+)/],
] as const;

async function getDeviceInfo(adb: ADB, log?: AppiumLogger): Promise<DeviceInfo> {
  const output = await adb.shell(['dumpsys', 'display']);
  const result: Partial<DeviceInfo> = {};
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
  return result as DeviceInfo;
}

async function initDeviceStreamingProc(
  adb: ADB,
  log: AppiumLogger,
  deviceInfo: DeviceInfo,
  opts: {width?: string | number; height?: string | number; bitRate?: string | number} = {},
): Promise<ReturnType<typeof spawn>> {
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
  const errorsListener = (chunk: Buffer | string) => {
    const stderr = chunk.toString();
    if (_.trim(stderr)) {
      deviceStreamingLogger.debug(stderr);
    }
  };
  deviceStreaming.stderr.on('data', errorsListener);

  const startupListener = (chunk: Buffer | string) => {
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
    throw log.errorWithException(
      `Cannot start the screen streaming process. Original error: ${
        (e as Error).message
      }`,
    );
  } finally {
    deviceStreaming.stderr.removeListener('data', errorsListener);
    deviceStreaming.stdout.removeListener('data', startupListener);
  }
  return deviceStreaming;
}

async function initGstreamerPipeline(
  deviceStreamingProc: ReturnType<typeof spawn>,
  deviceInfo: DeviceInfo,
  log: AppiumLogger,
  opts: InitGStreamerPipelineOpts,
): Promise<SubProcess> {
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
  const gstOutputListener = (stdout: string, stderr: string) => {
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
        } catch {
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
    throw log.errorWithException(
      `Cannot start the screen streaming pipeline. Original error: ${
        (e as Error).message
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
 * @privateRemarks This may need to be future-proofed, as `IncomingMessage.connection` is deprecated and its `socket` prop is likely private
 */
function extractRemoteAddress(req: http.IncomingMessage): string {
  return (
    (req.headers['x-forwarded-for'] as string) ||
    req.socket.remoteAddress ||
    (req as any).connection?.remoteAddress ||
    (req as any).connection?.socket?.remoteAddress ||
    'unknown'
  );
}

// #endregion

