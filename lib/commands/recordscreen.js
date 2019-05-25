import _ from 'lodash';
import _fs from 'fs';
import url from 'url';
import { waitForCondition } from 'asyncbox';
import { util, fs, net, tempDir, system } from 'appium-support';
import log from '../logger';
import { exec } from 'teen_process';
import path from 'path';
import v8 from 'v8';


let commands = {}, extensions = {};

const RETRY_PAUSE = 300;
const RETRY_TIMEOUT = 5000;
const MAX_RECORDING_TIME_SEC = 60 * 3;
const MAX_TIME_SEC = 60 * 30;
const DEFAULT_RECORDING_TIME_SEC = MAX_RECORDING_TIME_SEC;
const PROCESS_SHUTDOWN_TIMEOUT = 10 * 1000;
const SCREENRECORD_BINARY = 'screenrecord';
const DEFAULT_EXT = '.mp4';
const MIN_EMULATOR_API_LEVEL = 27;
const FFMPEG_BINARY = `ffmpeg${system.isWindows() ? '.exe' : ''}`;

async function uploadRecordedMedia (adb, localFile, remotePath = null, uploadOptions = {}) {
  const {size} = await fs.stat(localFile);
  log.debug(`The size of the resulting screen recording is ${util.toReadableSizeString(size)}`);
  if (_.isEmpty(remotePath)) {
    const maxMemoryLimit = v8.getHeapStatistics().total_available_size / 2;
    if (size >= maxMemoryLimit) {
      log.info(`The file might be too large to fit into the process memory ` +
        `(${util.toReadableSizeString(size)} >= ${util.toReadableSizeString(maxMemoryLimit)}). ` +
        `Provide a link to a remote writable location for video upload ` +
        `(http(s) and ftp protocols are supported) if you experience Out Of Memory errors`);
    }
    return (await fs.readFile(localFile)).toString('base64');
  }

  const remoteUrl = url.parse(remotePath);
  let options = {};
  const {user, pass, method} = uploadOptions;
  if (remoteUrl.protocol.startsWith('http')) {
    options = {
      url: remoteUrl.href,
      method: method || 'PUT',
      multipart: [{ body: _fs.createReadStream(localFile) }],
    };
    if (user && pass) {
      options.auth = {user, pass};
    }
  } else if (remoteUrl.protocol.startsWith('ftp')) {
    options = {
      host: remoteUrl.hostname,
      port: remoteUrl.port || 21,
    };
    if (user && pass) {
      options.user = user;
      options.pass = pass;
    }
  }
  await net.uploadFile(localFile, remotePath, options);
  return '';
}

async function verifyScreenRecordIsSupported (adb, isEmulator) {
  const apiLevel = await adb.getApiLevel();
  if (isEmulator && apiLevel < MIN_EMULATOR_API_LEVEL) {
    throw new Error(`Screen recording does not work on emulators running Android API level less than ${MIN_EMULATOR_API_LEVEL}`);
  }
  if (apiLevel < 19) {
    throw new Error(`Screen recording not available on API Level ${apiLevel}. Minimum API Level is 19.`);
  }
}

async function scheduleScreenRecord (adb, recordingProperties) {
  if (recordingProperties.stopped) {
    return;
  }

  const {
    startTimestamp,
    videoSize,
    bitRate,
    timeLimit,
    bugReport,
  } = recordingProperties;

  let currentTimeLimit = MAX_RECORDING_TIME_SEC;
  if (util.hasValue(recordingProperties.currentTimeLimit)) {
    const currentTimeLimitInt = parseInt(recordingProperties.currentTimeLimit, 10);
    if (!isNaN(currentTimeLimitInt) && currentTimeLimitInt < MAX_RECORDING_TIME_SEC) {
      currentTimeLimit = currentTimeLimitInt;
    }
  }
  const pathOnDevice = `/sdcard/${Math.floor(new Date())}${DEFAULT_EXT}`;
  const recordingProc = adb.screenrecord(pathOnDevice, {
    videoSize,
    bitRate,
    timeLimit: currentTimeLimit,
    bugReport,
  });

  recordingProc.on('end', () => {
    if (recordingProperties.stopped || !util.hasValue(timeLimit)) {
      return;
    }
    const currentDuration = process.hrtime(startTimestamp)[0];
    log.debug(`The overall screen recording duration is ${currentDuration}s so far`);
    const timeLimitInt = parseInt(timeLimit, 10);
    if (isNaN(timeLimitInt) || currentDuration >= timeLimitInt) {
      log.debug('There is no need to start the next recording chunk');
      return;
    }

    recordingProperties.currentTimeLimit = timeLimitInt - currentDuration;
    const chunkDuration = recordingProperties.currentTimeLimit < MAX_RECORDING_TIME_SEC
      ? recordingProperties.currentTimeLimit
      : MAX_RECORDING_TIME_SEC;
    log.debug(`Starting the next ${chunkDuration}s-chunk ` +
      `of screen recording in order to achieve ${timeLimitInt}s total duration`);
    scheduleScreenRecord(adb, recordingProperties)
      .catch((e) => {
        log.error(e.stack);
        recordingProperties.stopped = true;
      });
  });

  await recordingProc.start(0);
  try {
    await waitForCondition(async () => await adb.fileExists(pathOnDevice),
      {waitMs: RETRY_TIMEOUT, intervalMs: RETRY_PAUSE});
  } catch (e) {
    throw new Error(`The expected screen record file '${pathOnDevice}' does not exist after ${RETRY_TIMEOUT}ms. ` +
      `Is ${SCREENRECORD_BINARY} utility available and operational on the device under test?`);
  }

  recordingProperties.records.push(pathOnDevice);
  recordingProperties.recordingProcess = recordingProc;
}

async function mergeScreenRecords (mediaFiles) {
  try {
    await fs.which(FFMPEG_BINARY);
  } catch (e) {
    throw new Error(`${FFMPEG_BINARY} utility is not available in PATH. Please install it from https://www.ffmpeg.org/`);
  }
  const configContent = mediaFiles
    .map((x) => `file '${x}'`)
    .join('\n');
  const configFile = path.resolve(path.dirname(mediaFiles[0]), 'config.txt');
  await fs.writeFile(configFile, configContent, 'utf8');
  log.debug(`Generated ffmpeg merging config '${configFile}' with items:\n${configContent}`);
  const result = path.resolve(path.dirname(mediaFiles[0]), `merge_${Math.floor(new Date())}${DEFAULT_EXT}`);
  const args = ['-safe', '0', '-f', 'concat', '-i', configFile, '-c', 'copy', result];
  log.info(`Initiating screen records merging using the command '${FFMPEG_BINARY} ${args.join(' ')}'`);
  await exec(FFMPEG_BINARY, args);
  return result;
}

async function terminateBackgroundScreenRecording (adb, force = true) {
  const pids = (await adb.getPIDsByName(SCREENRECORD_BINARY))
    .map((p) => `${p}`);
  if (_.isEmpty(pids)) {
    return false;
  }

  try {
    await adb.shell(['kill', force ? '-15' : '-2', ...pids]);
    await waitForCondition(async () => _.isEmpty(await adb.getPIDsByName(SCREENRECORD_BINARY)), {
      waitMs: PROCESS_SHUTDOWN_TIMEOUT,
      intervalMs: 500,
    });
    return true;
  } catch (err) {
    throw new Error(`Unable to stop the background screen recording: ${err.message}`);
  }
}


/**
 * @typedef {Object} StartRecordingOptions
 *
 * @property {?string} remotePath - The path to the remote location, where the captured video should be uploaded.
 *                                  The following protocols are supported: http/https, ftp.
 *                                  Null or empty string value (the default setting) means the content of resulting
 *                                  file should be encoded as Base64 and passed as the endpount response value.
 *                                  An exception will be thrown if the generated media file is too big to
 *                                  fit into the available process memory.
 *                                  This option only has an effect if there is screen recording process in progreess
 *                                  and `forceRestart` parameter is not set to `true`.
 * @property {?string} user - The name of the user for the remote authentication. Only works if `remotePath` is provided.
 * @property {?string} pass - The password for the remote authentication. Only works if `remotePath` is provided.
 * @property {?string} method - The http multipart upload method name. The 'PUT' one is used by default.
 *                              Only works if `remotePath` is provided.
 * @property {?string} videoSize - The format is widthxheight.
 *                  The default value is the device's native display resolution (if supported),
 *                  1280x720 if not. For best results,
 *                  use a size supported by your device's Advanced Video Coding (AVC) encoder.
 *                  For example, "1280x720"
 * @property {?boolean} bugReport - Set it to `true` in order to display additional information on the video overlay,
 *                                  such as a timestamp, that is helpful in videos captured to illustrate bugs.
 *                                  This option is only supported since API level 27 (Android P).
 * @property {?string|number} timeLimit - The maximum recording time, in seconds. The default value is 180 (3 minutes).
 *                                        The maximum value is 1800 (30 minutes). If the passed value is greater than 180 then
 *                                        the algorithm will try to schedule multiple screen recording chunks and merge the
 *                                        resulting videos into a single media file using `ffmpeg` utility.
 *                                        If the utility is not available in PATH then the most recent screen recording chunk is
 *                                        going to be returned.
 * @property {?string|number} bitRate - The video bit rate for the video, in megabits per second.
 *                The default value is 4. You can increase the bit rate to improve video quality,
 *                but doing so results in larger movie files.
 * @property {?boolean} forceRestart - Whether to try to catch and upload/return the currently running screen recording
 *                                     (`false`, the default setting) or ignore the result of it and start a new recording
 *                                     immediately (`true`).
 */

/**
 * Record the display of a real devices running Android 4.4 (API level 19) and higher.
 * Emulators are supported since API level 27 (Android P).
 * It records screen activity to an MPEG-4 file. Audio is not recorded with the video file.
 * If screen recording has been already started then the command will stop it forcefully and start a new one.
 * The previously recorded video file will be deleted.
 *
 * @param {?StartRecordingOptions} options - The available options.
 * @returns {string} Base64-encoded content of the recorded media file if
 *                   any screen recording is currently running or an empty string.
 * @throws {Error} If screen recording has failed to start or is not supported on the device under test.
 */
commands.startRecordingScreen = async function startRecordingScreen (options = {}) {
  await verifyScreenRecordIsSupported(this.adb, this.isEmulator());

  let result = '';
  const {videoSize, timeLimit = DEFAULT_RECORDING_TIME_SEC, bugReport, bitRate, forceRestart} = options;
  if (!forceRestart) {
    result = await this.stopRecordingScreen(options);
  }

  if (await terminateBackgroundScreenRecording(this.adb, true)) {
    log.warn(`There were some ${SCREENRECORD_BINARY} process leftovers running ` +
      `in the background. Make sure you stop screen recording each time after it is started, ` +
      `otherwise the recorded media might quickly exceed all the free space on the device under test.`);
  }

  if (!_.isEmpty(this._screenRecordingProperties)) {
    for (const record of (this._screenRecordingProperties.records || [])) {
      await this.adb.rimraf(record);
    }
    this._screenRecordingProperties = null;
  }

  const timeout = parseFloat(timeLimit);
  if (isNaN(timeout) || timeout > MAX_TIME_SEC || timeout <= 0) {
    throw new Error(`The timeLimit value must be in range [1, ${MAX_TIME_SEC}] seconds. ` +
      `The value of '${timeLimit}' has been passed instead.`);
  }

  this._screenRecordingProperties = {
    startTimestamp: process.hrtime(),
    videoSize,
    timeLimit,
    currentTimeLimit: timeLimit,
    bitRate,
    bugReport,
    records: [],
    recordingProcess: null,
    stopped: false,
  };
  await scheduleScreenRecord(this.adb, this._screenRecordingProperties);
  return result;
};

/**
 * @typedef {Object} StopRecordingOptions
 *
 * @property {?string} remotePath - The path to the remote location, where the resulting video should be uploaded.
 *                                  The following protocols are supported: http/https, ftp.
 *                                  Null or empty string value (the default setting) means the content of resulting
 *                                  file should be encoded as Base64 and passed as the endpount response value.
 *                                  An exception will be thrown if the generated media file is too big to
 *                                  fit into the available process memory.
 * @property {?string} user - The name of the user for the remote authentication.
 * @property {?string} pass - The password for the remote authentication.
 * @property {?string} method - The http multipart upload method name. The 'PUT' one is used by default.
 */

/**
 * Stop recording the screen.
 * If no screen recording has been started before then the method returns an empty string.
 *
 * @param {?StopRecordingOptions} options - The available options.
 * @returns {string} Base64-encoded content of the recorded media file if 'remotePath'
 *                   parameter is falsy or an empty string.
 * @throws {Error} If there was an error while getting the name of a media file
 *                 or the file content cannot be uploaded to the remote location
 *                 or screen recording is not supported on the device under test.
 */
commands.stopRecordingScreen = async function stopRecordingScreen (options = {}) {
  await verifyScreenRecordIsSupported(this.adb, this.isEmulator());

  if (!_.isEmpty(this._screenRecordingProperties)) {
    this._screenRecordingProperties.stopped = true;
  }

  try {
    await terminateBackgroundScreenRecording(this.adb, false);
  } catch (err) {
    log.warn(err.message);
    if (!_.isEmpty(this._screenRecordingProperties)) {
      log.warn('The resulting video might be corrupted');
    }
  }

  if (_.isEmpty(this._screenRecordingProperties)) {
    log.info(`Screen recording has not been previously started by Appium. There is nothing to stop`);
    return '';
  }

  if (this._screenRecordingProperties.recordingProcess && this._screenRecordingProperties.recordingProcess.isRunning) {
    try {
      await this._screenRecordingProperties.recordingProcess.stop('SIGINT', PROCESS_SHUTDOWN_TIMEOUT);
    } catch (e) {
      log.errorAndThrow(`Unable to stop screen recording within ${PROCESS_SHUTDOWN_TIMEOUT}ms`);
    }
    this._screenRecordingProperties.recordingProcess = null;
  }

  if (_.isEmpty(this._screenRecordingProperties.records)) {
    log.errorAndThrow(`No screen recordings have been stored on the device so far. ` +
      `Are you sure the ${SCREENRECORD_BINARY} utility works as expected?`);
  }

  const tmpRoot = await tempDir.openDir();
  try {
    const localRecords = [];
    for (const pathOnDevice of this._screenRecordingProperties.records) {
      localRecords.push(path.resolve(tmpRoot, path.posix.basename(pathOnDevice)));
      await this.adb.pull(pathOnDevice, _.last(localRecords));
      await this.adb.rimraf(pathOnDevice);
    }
    let resultFilePath = _.last(localRecords);
    if (localRecords.length > 1) {
      log.info(`Got ${localRecords.length} screen recordings. Trying to merge them`);
      try {
        resultFilePath = await mergeScreenRecords(localRecords);
      } catch (e) {
        log.warn(`Cannot merge the recorded files. The most recent screen recording is going to be returned as the result. ` +
          `Original error: ${e.message}`);
      }
    }
    const {remotePath, user, pass, method} = options;
    return await uploadRecordedMedia(this.adb, resultFilePath, remotePath, {user, pass, method});
  } finally {
    await fs.rimraf(tmpRoot);
    this._screenRecordingProperties = null;
  }
};


Object.assign(extensions, commands);
export { commands };
export default extensions;
