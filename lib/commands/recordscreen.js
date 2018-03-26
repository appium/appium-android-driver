import _ from 'lodash';
import _fs from 'fs';
import url from 'url';
import { retryInterval, waitForCondition } from 'asyncbox';
import B from 'bluebird';
import { util, fs, net } from 'appium-support';
import log from '../logger';
import temp from 'temp';


let commands = {}, extensions = {};

const RETRY_PAUSE = 1000;
const MAX_RECORDING_TIME_SEC = 60 * 3;
const DEFAULT_RECORDING_TIME_SEC = MAX_RECORDING_TIME_SEC;
const PROCESS_SHUTDOWN_TIMEOUT_SEC = 5;
const SCREENRECORD_BINARY = 'screenrecord';
const DEFAULT_EXT = '.mp4';
const MIN_EMULATOR_API_LEVEL = 27;


async function extractCurrentRecordingPath (adb, pids) {
  let lsofOutput = '';
  try {
    const {output} = await adb.shell(['lsof', '-p', pids.join(',')]);
    lsofOutput = output;
  } catch (err) {
    log.warn(`Cannot extract the path to the current screen capture. ` +
             `Original error: ${err.message}`);
    return null;
  }
  log.debug(`Got the following output from lsof: ${lsofOutput}`);
  const pattern = new RegExp(/\d+\s+(\/.*\.mp4)/);
  const matches = pattern.exec(lsofOutput);
  return _.isEmpty(matches) ? null : _.last(matches);
}

async function finishScreenCapture (adb, pids) {
  try {
    await adb.shell(['kill', '-2', ...pids]);
  } catch (e) {
    return true;
  }
  try {
    // Wait until the process is terminated
    await waitForCondition(async () => {
      try {
        const output = await adb.shell(['ps']);
        for (const pid of pids) {
          if (new RegExp(`\\b${pid}\\b[^\\n]+\\b${SCREENRECORD_BINARY}$`, 'm').test(output)) {
            return false;
          }
        }
        return true;
      } catch (err) {
        log.warn(err.message);
        return false;
      }
    }, {waitMs: PROCESS_SHUTDOWN_TIMEOUT_SEC * 1000, intervalMs: 500});
  } catch (e) {
    return false;
  }
  return true;
}

async function uploadRecordedMedia (adb, pathOnDevice, remotePath = null, uploadOptions = {}) {
  const localFile = temp.path({prefix: 'appium', suffix: DEFAULT_EXT});
  try {
    await adb.pull(pathOnDevice, localFile);

    const {size} = await fs.stat(localFile);
    log.debug(`The size of the recent screen recording is ${util.toReadableSizeString(size)}`);
    if (_.isEmpty(remotePath)) {
      const memoryUsage = process.memoryUsage();
      const maxMemoryLimit = (memoryUsage.heapTotal - memoryUsage.heapUsed) / 2;
      if (size >= maxMemoryLimit) {
        throw new Error(`Cannot read the recorded media '${pathOnDevice}' to the memory, ` +
                        `because the file is too large ` +
                        `(${util.toReadableSizeString(size)} >= ${util.toReadableSizeString(maxMemoryLimit)}). ` +
                        `Try to provide a link to a remote writable location instead.`);
      }
      const content = await fs.readFile(localFile);
      return content.toString('base64');
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
    } else if (remoteUrl.protocol === 'ftp') {
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
  } finally {
    await fs.rimraf(localFile);
    try {
      await adb.rimraf(pathOnDevice);
    } catch (e) {
      log.warn(`Cannot delete the recorded screen media '${pathOnDevice}' from the device. Continuing anyway`);
    }
  }
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
 * @property {?string|number} timeLimit - The maximum recording time, in seconds. The default and maximum value is 180 (3 minutes).
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
commands.startRecordingScreen = async function (options = {}) {
  const {videoSize, timeLimit=DEFAULT_RECORDING_TIME_SEC, bugReport, bitRate, forceRestart} = options;

  await verifyScreenRecordIsSupported(this.adb, this.isEmulator());

  let result = '';
  if (!forceRestart) {
    result = await this.stopRecordingScreen(options);
  }
  try {
    const pids = (await this.adb.getPIDsByName(SCREENRECORD_BINARY)).map((p) => `${p}`);
    if (!_.isEmpty(pids)) {
      await this.adb.shell(['kill', ...pids]);
    }
  } catch (err) {
    log.errorAndThrow(`Unable to stop screen recording: ${err.message}`);
  }
  if (!_.isEmpty(this._recentScreenRecordingPath)) {
    try {
      await this.adb.rimraf(this._recentScreenRecordingPath);
    } catch (ign) {}
    this._recentScreenRecordingPath = null;
  }

  const pathOnDevice = `/sdcard/${Math.floor(new Date())}${DEFAULT_EXT}`;

  //make adb command
  const cmd = [SCREENRECORD_BINARY];
  if (util.hasValue(videoSize)) {
    cmd.push('--size', videoSize);
  }
  if (util.hasValue(timeLimit)) {
    cmd.push('--time-limit', `${timeLimit}`);
  }
  if (util.hasValue(bitRate)) {
    cmd.push('--bit-rate', `${bitRate}`);
  }
  if (bugReport) {
    cmd.push('--bugreport');
  }
  cmd.push(pathOnDevice);

  // wrap in a manual Promise so we can handle errors in adb shell operation
  return await new B(async (resolve, reject) => {
    let err = null;
    let timeout = Math.floor(parseFloat(timeLimit) * 1000);
    if (timeout > MAX_RECORDING_TIME_SEC * 1000 || timeout <= 0) {
      return reject(new Error(`The timeLimit value must be in range (0, ${MAX_RECORDING_TIME_SEC}] seconds. ` +
                              `The value of ${timeLimit} has been passed instead.`));
    }
    log.debug(`Beginning screen recording with command: 'adb shell ${cmd.join(' ')}'` +
              `Will timeout in ${timeout / 1000} s`);
    // screenrecord has its owen timer, so we only use this one as a safety precaution
    timeout += PROCESS_SHUTDOWN_TIMEOUT_SEC * 1000 * 2;
    // do not await here, as the call runs in the background and we check for its product
    this.adb.shell(cmd, {timeout, killSignal: 'SIGINT'}).catch((e) => {
      err = e;
    });

    // there is the delay time to start recording the screen, so, wait until it is ready.
    // the ready condition is
    //   1. check the movie file is created
    //   2. check it is started to capture the screen
    try {
      await retryInterval(10, RETRY_PAUSE, async () => {
        if (err) {
          return;
        }

        const size = await this.adb.fileSize(pathOnDevice);
        if (size <= 32) {
          throw new Error(`Remote file '${pathOnDevice}' found but it is still too small: ${size} bytes`);
        }
      });
    } catch (e) {
      err = e;
    }

    if (err) {
      log.error(`Error recording screen: ${err.message}`);
      return reject(err);
    }
    this._recentScreenRecordingPath = pathOnDevice;
    resolve(result);
  });
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
 * Stop recording the screen. If no screen recording process is running then
 * the endpoint will try to get the recently recorded file.
 * If no previously recorded file is found and no active screen recording
 * processes are running then the method returns an empty string.
 *
 * @param {?StopRecordingOptions} options - The available options.
 * @returns {string} Base64-encoded content of the recorded media file if 'remotePath'
 *                   parameter is empty or null or an empty string.
 * @throws {Error} If there was an error while getting the name of a media file
 *                 or the file content cannot be uploaded to the remote location
 *                 or screen recording is not supported on the device under test.
 */
commands.stopRecordingScreen = async function (options = {}) {
  const {remotePath, user, pass, method} = options;

  await verifyScreenRecordIsSupported(this.adb, this.isEmulator());

  const pids = (await this.adb.getPIDsByName(SCREENRECORD_BINARY)).map((p) => `${p}`);
  let pathOnDevice = this._recentScreenRecordingPath;
  if (_.isEmpty(pids)) {
    log.info(`Screen recording is not running. There is nothing to stop.`);
  } else {
    pathOnDevice = pathOnDevice || await extractCurrentRecordingPath(this.adb, pids);
    try {
      if (_.isEmpty(pathOnDevice)) {
        log.errorAndThrow(`Cannot parse the path to the file created by ` +
                          `screen recorder process from 'ps' output. ` +
                          `Did you start screen recording before?`);
      }
    } finally {
      if (!await finishScreenCapture(this.adb, pids)) {
        log.warn(`Unable to stop screen recording. Continuing anyway`);
      }
    }
  }

  let result = '';
  if (!_.isEmpty(pathOnDevice)) {
    try {
      result = await uploadRecordedMedia(this.adb, pathOnDevice, remotePath, {user, pass, method});
    } finally {
      this._recentScreenRecordingPath = null;
    }
  }
  return result;
};


Object.assign(extensions, commands);
export { commands };
export default extensions;
