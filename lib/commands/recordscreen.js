import _ from 'lodash';
import _fs from 'fs';
import url from 'url';
import { retryInterval } from 'asyncbox';
import B from 'bluebird';
import { util, fs } from 'appium-support';
import log from '../logger';
import temp from 'temp';
import request from 'request-promise';
import Ftp from 'jsftp';


let commands = {}, extensions = {};

const RETRY_PAUSE = 1000;
const MAX_RECORDING_TIME_SEC = 60 * 3;
const SCREENRECORD_BINARY = 'screenrecord';
const DEFAULT_EXT = '.mp4';

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

async function uploadMediaToHttp (localFileStream, remoteUrl, uploadOptions = {}) {
  const {user, pass, method} = uploadOptions;
  const options = {
    url: remoteUrl.href,
    method: method || 'PUT',
    multipart: [{ body: localFileStream }],
  };
  if (user && pass) {
    options.auth = {user, pass};
  }
  log.debug(`Http upload options: ${JSON.stringify(options)}`);

  const response = await request(options);
  const responseDebugMsg = `Response code: ${response.statusCode}. Response body: ${JSON.stringify(response.body)}`;
  log.debug(responseDebugMsg);
  if (response.statusCode >= 400) {
    throw new Error(`Cannot upload the recorded media to '${remoteUrl.href}'. ${responseDebugMsg}`);
  }
}

async function uploadMediaToFtp (localFileStream, remoteUrl, uploadOptions = {}) {
  const {user, pass} = uploadOptions;
  const options = {
    host: remoteUrl.hostname,
    port: remoteUrl.port || 21,
  };
  if (user && pass) {
    options.user = user;
    options.pass = pass;
  }
  log.debug(`FTP upload options: ${JSON.stringify(options)}`);

  return await new B((resolve, reject) => {
    new Ftp(options).put(localFileStream, remoteUrl.pathname, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function toReadableSizeString (bytes) {
  if (bytes >= 1048576) {
    return `${parseFloat(bytes / 1048576.0).toFixed(2)} MB`;
  } else if (bytes >= 1024) {
    return `${parseFloat(bytes / 1024.0).toFixed(2)} KB`;
  }
  return `${bytes} B`;
}

async function uploadRecordedMedia (adb, pathOnDevice, remotePath = null, uploadOptions = {}) {
  const localFile = temp.path({prefix: 'appium', suffix: DEFAULT_EXT});
  try {
    await adb.pull(pathOnDevice, localFile);

    const {size} = await fs.stat(localFile);
    log.debug(`The size of the recent screen recording is ${toReadableSizeString(size)}`);
    if (_.isEmpty(remotePath)) {
      const memoryUsage = process.memoryUsage();
      const maxMemoryLimit = (memoryUsage.heapTotal - memoryUsage.heapUsed) / 2;
      if (size >= maxMemoryLimit) {
        throw new Error(`Cannot read the recorded media '${pathOnDevice}' to the memory, ` +
                        `because the file is too large (${toReadableSizeString(size)} >= ${toReadableSizeString(maxMemoryLimit)}). ` +
                        `Try to provide a link to a remote writable location instead.`);
      }
      const content = await fs.readFile(localFile);
      return content.toString('base64');
    }

    const remoteUrl = url.parse(remotePath);
    const localFileStream = _fs.createReadStream(localFile);
    const timeStarted = process.hrtime();
    log.info(`Uploading '${pathOnDevice}' of ${toReadableSizeString(size)} size to '${remotePath}'...`);
    if (remoteUrl.protocol.startsWith('http')) {
      await uploadMediaToHttp(localFileStream, remoteUrl, uploadOptions);
    } else if (remoteUrl.protocol === 'ftp') {
      await uploadMediaToFtp(localFileStream, remoteUrl, uploadOptions);
    } else {
      throw new Error(`Cannot upload the recorded media '${pathOnDevice}' to '${remotePath}'` +
                      `Unsupported remote protocol '${remoteUrl.protocol}'. Only http/https and ftp are supported`);
    }
    log.info(`Uploaded '${pathOnDevice}' of ${toReadableSizeString(size)} size in ${process.hrtime(timeStarted)[0]} seconds`);
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
 * @property {?string|number} timeLimit - The maximum recording time, in seconds. The default and maximum value is 180 (3 minutes).
 * @property {?string|number} bitRate - The video bit rate for the video, in megabits per second.
 *                The default value is 4. You can increase the bit rate to improve video quality,
 *                but doing so results in larger movie files.
 * @property {?boolean} forceRestart - Whether to try to catch and upload/return the currently running screen recording
 *                                     (`false`, the default setting) or ignore the result of it and start a new recording
 *                                     immediately (`true`).
 */

/**
 * Record the display of devices running Android 4.4 (API level 19) and higher.
 * It records screen activity to an MPEG-4 file. Audio is not recorded with the video file.
 * If screen recording has been already started then the command will stop it forcefully and start a new one.
 * The previously recorded video file will be deleted.
 *
 * @param {?StartRecordingOptions} options - The available options.
 * @returns {string} Base64-encoded content of the recorded media file if
 *                   any screen recording is currently running or an empty string.
 * @throws {Error} If screen recording has failed to start.
 */
commands.startRecordingScreen = async function (options = {}) {
  const {videoSize, timeLimit, bitRate, forceRestart} = options;
  let result = '';
  if (this.isEmulator()) {
    throw new Error('Screen recording does not work on emulators');
  }

  // this function is suppported on the device running android 4.4(api level 19)
  const apiLevel = await this.adb.getApiLevel();
  if (apiLevel < 19) {
    throw new Error(`Screen recording not available on API Level ${apiLevel}. Minimum API Level is 19.`);
  }

  if (!forceRestart) {
    result = await this.stopRecordingScreen(options);
  }
  try {
    const pids = (await this.adb.getPIDsByName(SCREENRECORD_BINARY))
      .map((p) => `${p}`);
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

  const localPath = `/sdcard/${Math.floor(new Date())}${DEFAULT_EXT}`;

  //make adb command
  const cmd = [SCREENRECORD_BINARY, localPath];
  if (util.hasValue(videoSize)) {
    cmd.push('--size', videoSize);
  }
  if (util.hasValue(timeLimit)) {
    cmd.push('--time-limit', timeLimit);
  }
  if (util.hasValue(bitRate)) {
    cmd.push('--bit-rate', bitRate);
  }

  // wrap in a manual Promise so we can handle errors in adb shell operation
  return await new B(async (resolve, reject) => {
    let err = null;
    const timeoutMs = isNaN(timeLimit) ? MAX_RECORDING_TIME_SEC * 1000 :
      Math.round(parseFloat(timeLimit) * 1000);
    if (timeoutMs > MAX_RECORDING_TIME_SEC * 1000) {
      return reject(new Error(`The timeLimit ${timeLimit} cannot be greater than ` +
                              `${MAX_RECORDING_TIME_SEC} seconds`));
    }
    if (timeoutMs <= 0) {
      return reject(new Error(`The timeLimit ${timeLimit} must be greater than zero`));
    }
    log.debug(`Beginning screen recording with command: 'adb ${cmd.join(' ')}'. ` +
              `Will timeout in ${timeoutMs / 1000} s`);
    // do not await here, as the call runs in the background and we check for its product
    this.adb.shell(cmd, {timeout: timeoutMs, killSignal: 'SIGINT'}).catch((e) => {
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

        const size = await this.adb.fileSize(localPath);
        if (size <= 32) {
          throw new Error(`Remote file '${localPath}' found but it is still too small: ${size} bytes`);
        }
      });
    } catch (e) {
      err = e;
    }

    if (err) {
      log.error(`Error recording screen: ${err.message}`);
      return reject(err);
    }
    this._recentScreenRecordingPath = localPath;
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
 *                 or the file content cannot be uploaded to the remote location.
 */
commands.stopRecordingScreen = async function (options = {}) {
  const {remotePath, user, pass, method} = options;
  let result = '';

  const pids = (await this.adb.getPIDsByName(SCREENRECORD_BINARY))
    .map((p) => `${p}`);
  if (_.isEmpty(pids)) {
    log.info(`Screen recording is not running. There is nothing to stop.`);
    if (!_.isEmpty(this._recentScreenRecordingPath)) {
      result = await uploadRecordedMedia(this.adb, this._recentScreenRecordingPath, remotePath,
        {user, pass, method});
      this._recentScreenRecordingPath = null;
    }
    return result;
  }

  const pathOnDevice = this._recentScreenRecordingPath || await extractCurrentRecordingPath(this.adb, pids);
  try {
    if (_.isEmpty(pathOnDevice)) {
      log.errorAndThrow(`Cannot parse the path to the file created by ` +
                        `the screen recorder process. Did you start screen recording before?`);
    }
  } finally {
    try {
      await this.adb.shell(['kill', '-2', ...pids]);
    } catch (err) {
      log.warn(`Unable to stop screen recording: ${err.message}. Continuing anyway`);
    }
  }

  result = await uploadRecordedMedia(this.adb, pathOnDevice, remotePath, {user, pass, method});
  this._recentScreenRecordingPath = null;
  return result;
};


Object.assign(extensions, commands);
export { commands };
export default extensions;
