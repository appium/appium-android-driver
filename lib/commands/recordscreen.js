import {fs, net, system, tempDir, timing, util} from '@appium/support';
import {waitForCondition} from 'asyncbox';
import _ from 'lodash';
import path from 'path';
import {exec} from 'teen_process';

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
const ADB_PULL_TIMEOUT = 5 * 60 * 1000;

/**
 *
 * @this {import('../driver').AndroidDriver}
 * @param {import('./types').StartScreenRecordingOpts} [options={}]
 * @returns {Promise<string>}
 */
export async function startRecordingScreen(options = {}) {
  await verifyScreenRecordIsSupported(this.adb, this.isEmulator());

  let result = '';
  const {
    videoSize,
    timeLimit = DEFAULT_RECORDING_TIME_SEC,
    bugReport,
    bitRate,
    forceRestart,
  } = options;
  if (!forceRestart) {
    result = await this.stopRecordingScreen(options);
  }

  if (await terminateBackgroundScreenRecording(this.adb, true)) {
    this.log.warn(
      `There were some ${SCREENRECORD_BINARY} process leftovers running ` +
        `in the background. Make sure you stop screen recording each time after it is started, ` +
        `otherwise the recorded media might quickly exceed all the free space on the device under test.`,
    );
  }

  if (!_.isEmpty(this._screenRecordingProperties)) {
    // XXX: this doesn't need to be done in serial, does it?
    for (const record of this._screenRecordingProperties.records || []) {
      await this.adb.rimraf(record);
    }
    this._screenRecordingProperties = undefined;
  }

  const timeout = parseFloat(String(timeLimit));
  if (isNaN(timeout) || timeout > MAX_TIME_SEC || timeout <= 0) {
    throw new Error(
      `The timeLimit value must be in range [1, ${MAX_TIME_SEC}] seconds. ` +
        `The value of '${timeLimit}' has been passed instead.`,
    );
  }

  this._screenRecordingProperties = {
    timer: new timing.Timer().start(),
    videoSize,
    timeLimit,
    currentTimeLimit: timeLimit,
    bitRate,
    bugReport,
    records: [],
    recordingProcess: null,
    stopped: false,
  };
  await scheduleScreenRecord.bind(this)(this._screenRecordingProperties);
  return result;
}

/**
 *
 * @this {import('../driver').AndroidDriver}
 * @param {import('./types').StopScreenRecordingOpts} [options={}]
 * @returns {Promise<string>}
 */
export async function stopRecordingScreen(options = {}) {
  await verifyScreenRecordIsSupported(this.adb, this.isEmulator());

  if (!_.isEmpty(this._screenRecordingProperties)) {
    this._screenRecordingProperties.stopped = true;
  }

  try {
    await terminateBackgroundScreenRecording(this.adb, false);
  } catch (err) {
    this.log.warn(/** @type {Error} */ (err).message);
    if (!_.isEmpty(this._screenRecordingProperties)) {
      this.log.warn('The resulting video might be corrupted');
    }
  }

  if (_.isEmpty(this._screenRecordingProperties)) {
    this.log.info(
      `Screen recording has not been previously started by Appium. There is nothing to stop`,
    );
    return '';
  }

  if (
    this._screenRecordingProperties.recordingProcess &&
    this._screenRecordingProperties.recordingProcess.isRunning
  ) {
    try {
      await this._screenRecordingProperties.recordingProcess.stop(
        'SIGINT',
        PROCESS_SHUTDOWN_TIMEOUT,
      );
    } catch (e) {
      this.log.errorAndThrow(
        `Unable to stop screen recording within ${PROCESS_SHUTDOWN_TIMEOUT}ms`,
      );
    }
    this._screenRecordingProperties.recordingProcess = null;
  }

  if (_.isEmpty(this._screenRecordingProperties.records)) {
    this.log.errorAndThrow(
      `No screen recordings have been stored on the device so far. ` +
        `Are you sure the ${SCREENRECORD_BINARY} utility works as expected?`,
    );
  }

  const tmpRoot = await tempDir.openDir();
  try {
    const localRecords = [];
    for (const pathOnDevice of this._screenRecordingProperties.records) {
      const relativePath = path.resolve(tmpRoot, path.posix.basename(pathOnDevice));
      localRecords.push(relativePath);
      await this.adb.pull(pathOnDevice, relativePath, { timeout: ADB_PULL_TIMEOUT });
      await this.adb.rimraf(pathOnDevice);
    }
    let resultFilePath = /** @type {string} */ (_.last(localRecords));
    if (localRecords.length > 1) {
      this.log.info(`Got ${localRecords.length} screen recordings. Trying to merge them`);
      try {
        resultFilePath = await mergeScreenRecords.bind(this)(localRecords);
      } catch (e) {
        this.log.warn(
          `Cannot merge the recorded files. The most recent screen recording is going to be returned as the result. ` +
            `Original error: ${/** @type {Error} */ (e).message}`,
        );
      }
    }
    if (_.isEmpty(options.remotePath)) {
      const {size} = await fs.stat(resultFilePath);
      this.log.debug(
        `The size of the resulting screen recording is ${util.toReadableSizeString(size)}`,
      );
    }
    return await uploadRecordedMedia(resultFilePath, options.remotePath, options);
  } finally {
    await fs.rimraf(tmpRoot);
    this._screenRecordingProperties = undefined;
  }
}

// #region Internal helpers

/**
 *
 * @param {string} localFile
 * @param {string} [remotePath]
 * @param {import('./types').StopScreenRecordingOpts} uploadOptions
 * @returns {Promise<string>}
 */
async function uploadRecordedMedia(localFile, remotePath, uploadOptions = {}) {
  if (_.isEmpty(remotePath)) {
    return (await util.toInMemoryBase64(localFile)).toString();
  }

  const {user, pass, method, headers, fileFieldName, formFields} = uploadOptions;
  /**
   * @type {import('@appium/support').NetOptions & import('@appium/support').HttpUploadOptions}
   */
  const options = {
    method: method || 'PUT',
    headers,
    fileFieldName,
    formFields,
  };
  if (user && pass) {
    options.auth = {user, pass};
  }
  await net.uploadFile(localFile, /** @type {string} */ (remotePath), options);
  return '';
}

/**
 *
 * @param {ADB} adb
 * @param {boolean} isEmulator
 */
async function verifyScreenRecordIsSupported(adb, isEmulator) {
  const apiLevel = await adb.getApiLevel();
  if (isEmulator && apiLevel < MIN_EMULATOR_API_LEVEL) {
    throw new Error(
      `Screen recording does not work on emulators running Android API level less than ${MIN_EMULATOR_API_LEVEL}`,
    );
  }
  if (apiLevel < 19) {
    throw new Error(
      `Screen recording not available on API Level ${apiLevel}. Minimum API Level is 19.`,
    );
  }
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {import('@appium/types').StringRecord} recordingProperties
 * @returns {Promise<void>}
 */
async function scheduleScreenRecord(recordingProperties) {
  if (recordingProperties.stopped) {
    return;
  }

  const {timer, videoSize, bitRate, timeLimit, bugReport} = recordingProperties;

  let currentTimeLimit = MAX_RECORDING_TIME_SEC;
  if (util.hasValue(recordingProperties.currentTimeLimit)) {
    const currentTimeLimitInt = parseInt(recordingProperties.currentTimeLimit, 10);
    if (!isNaN(currentTimeLimitInt) && currentTimeLimitInt < MAX_RECORDING_TIME_SEC) {
      currentTimeLimit = currentTimeLimitInt;
    }
  }
  const pathOnDevice = `/sdcard/${util.uuidV4().substring(0, 8)}${DEFAULT_EXT}`;
  const recordingProc = this.adb.screenrecord(pathOnDevice, {
    videoSize,
    bitRate,
    timeLimit: currentTimeLimit,
    bugReport,
  });

  recordingProc.on('end', () => {
    if (recordingProperties.stopped || !util.hasValue(timeLimit)) {
      return;
    }
    const currentDuration = timer.getDuration().asSeconds.toFixed(0);
    this.log.debug(`The overall screen recording duration is ${currentDuration}s so far`);
    const timeLimitInt = parseInt(timeLimit, 10);
    if (isNaN(timeLimitInt) || currentDuration >= timeLimitInt) {
      this.log.debug('There is no need to start the next recording chunk');
      return;
    }

    recordingProperties.currentTimeLimit = timeLimitInt - currentDuration;
    const chunkDuration =
      recordingProperties.currentTimeLimit < MAX_RECORDING_TIME_SEC
        ? recordingProperties.currentTimeLimit
        : MAX_RECORDING_TIME_SEC;
    this.log.debug(
      `Starting the next ${chunkDuration}s-chunk ` +
        `of screen recording in order to achieve ${timeLimitInt}s total duration`,
    );
    (async () => {
      try {
        await scheduleScreenRecord.bind(this)(recordingProperties);
      } catch (e) {
        this.log.error(/** @type {Error} */ (e).stack);
        recordingProperties.stopped = true;
      }
    })();
  });

  await recordingProc.start(0);
  try {
    await waitForCondition(async () => await this.adb.fileExists(pathOnDevice), {
      waitMs: RETRY_TIMEOUT,
      intervalMs: RETRY_PAUSE,
    });
  } catch (e) {
    throw new Error(
      `The expected screen record file '${pathOnDevice}' does not exist after ${RETRY_TIMEOUT}ms. ` +
        `Is ${SCREENRECORD_BINARY} utility available and operational on the device under test?`,
    );
  }

  recordingProperties.records.push(pathOnDevice);
  recordingProperties.recordingProcess = recordingProc;
}

/**
 *
 * @this {import('../driver').AndroidDriver}
 * @param {string[]} mediaFiles
 * @returns {Promise<string>}
 */
async function mergeScreenRecords(mediaFiles) {
  try {
    await fs.which(FFMPEG_BINARY);
  } catch (e) {
    throw new Error(
      `${FFMPEG_BINARY} utility is not available in PATH. Please install it from https://www.ffmpeg.org/`,
    );
  }
  const configContent = mediaFiles.map((x) => `file '${x}'`).join('\n');
  const configFile = path.resolve(path.dirname(mediaFiles[0]), 'config.txt');
  await fs.writeFile(configFile, configContent, 'utf8');
  this.log.debug(`Generated ffmpeg merging config '${configFile}' with items:\n${configContent}`);
  const result = path.resolve(
    path.dirname(mediaFiles[0]),
    `merge_${Math.floor(+new Date())}${DEFAULT_EXT}`,
  );
  const args = ['-safe', '0', '-f', 'concat', '-i', configFile, '-c', 'copy', result];
  this.log.info(
    `Initiating screen records merging using the command '${FFMPEG_BINARY} ${args.join(' ')}'`,
  );
  await exec(FFMPEG_BINARY, args);
  return result;
}

/**
 *
 * @param {ADB} adb
 * @param {boolean} force
 * @returns {Promise<boolean>}
 */
async function terminateBackgroundScreenRecording(adb, force = true) {
  const pids = (await adb.getPIDsByName(SCREENRECORD_BINARY)).map((p) => `${p}`);
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
    throw new Error(
      `Unable to stop the background screen recording: ${/** @type {Error} */ (err).message}`,
    );
  }
}

// #endregion

/**
 * @typedef {import('appium-adb').ADB} ADB
 */
