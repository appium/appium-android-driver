import _ from 'lodash';
import { waitForCondition } from 'asyncbox';
import { util, fs, net, tempDir } from '@appium/support';
import path from 'path';
import B from 'bluebird';
import { SETTINGS_HELPER_PKG_ID } from '../android-helpers';
import moment from 'moment';


const commands = {};

// https://github.com/appium/io.appium.settings#internal-audio--video-recording
const DEFAULT_EXT = '.mp4';
const RECORDING_STARTUP_TIMEOUT_MS = 3 * 1000;
const RECORDING_STOP_TIMEOUT_MS = 3 * 1000;
const MIN_API_LEVEL = 29;
const RECORDING_SERVICE_NAME = `${SETTINGS_HELPER_PKG_ID}/.recorder.RecorderService`;
const RECORDING_ACTIVITY_NAME = `${SETTINGS_HELPER_PKG_ID}/io.appium.settings.Settings`;
const RECORDING_ACTION_START = `${SETTINGS_HELPER_PKG_ID}.recording.ACTION_START`;
const RECORDING_ACTION_STOP = `${SETTINGS_HELPER_PKG_ID}.recording.ACTION_STOP`;
const RECORDINGS_ROOT = `/storage/emulated/0/Android/data/${SETTINGS_HELPER_PKG_ID}/files`;
const DEFAULT_FILENAME_FORMAT = 'YYYY-MM-DDTHH-mm-ss';


async function uploadRecordedMedia (localFile, remotePath = null, uploadOptions = {}) {
  if (_.isEmpty(remotePath)) {
    return (await util.toInMemoryBase64(localFile)).toString();
  }

  const {
    user,
    pass,
    method,
    headers,
    fileFieldName,
    formFields,
    uploadTimeout: timeout,
  } = uploadOptions;
  const options = {
    method: method || 'PUT',
    headers,
    fileFieldName,
    formFields,
    timeout,
  };
  if (user && pass) {
    options.auth = {user, pass};
  }
  await net.uploadFile(localFile, remotePath, options);
  return '';
}

function adjustMediaExtension (name) {
  return _.toLower(name).endsWith(DEFAULT_EXT) ? name : `${name}${DEFAULT_EXT}`;
}

async function verifyMediaProjectionRecordingIsSupported (adb) {
  const apiLevel = await adb.getApiLevel();
  if (apiLevel < MIN_API_LEVEL) {
    throw new Error(`Media projection-based recording is not available on API Level ${apiLevel}. ` +
      `Minimum required API Level is ${MIN_API_LEVEL}.`);
  }
}


class MediaProjectionRecorder {
  constructor (adb) {
    this.adb = adb;
  }

  async isRunning () {
    const stdout = await this.adb.shell([
      'dumpsys', 'activity', 'services', RECORDING_SERVICE_NAME
    ]);
    return stdout.includes(RECORDING_SERVICE_NAME);
  }

  async start (opts = {}) {
    if (await this.isRunning()) {
      return false;
    }

    await this.cleanup();
    const {
      filename,
      maxDurationSec,
      priority,
      resolution,
    } = opts;
    const args = [
      'am', 'start',
      '-n', RECORDING_ACTIVITY_NAME,
      '-a', RECORDING_ACTION_START,
    ];
    if (filename) {
      args.push('--es', 'filename', filename);
    }
    if (maxDurationSec) {
      args.push('--es', 'max_duration_sec', `${maxDurationSec}`);
    }
    if (priority) {
      args.push('--es', 'priority', priority);
    }
    if (resolution) {
      args.push('--es', 'resolution', resolution);
    }
    await this.adb.shell(args);
    await new B((resolve, reject) => {
      setTimeout(async () => {
        if (!await this.isRunning()) {
          return reject(new Error(
            `The media projection recording is not running after ${RECORDING_STARTUP_TIMEOUT_MS}ms. ` +
            `Please check the logcat output for more details.`
          ));
        }
        resolve();
      }, RECORDING_STARTUP_TIMEOUT_MS);
    });
    return true;
  }

  async cleanup () {
    await this.adb.shell([`rm -f ${RECORDINGS_ROOT}/*`]);
  }

  async pullRecent () {
    const recordings = await this.adb.ls(RECORDINGS_ROOT, ['-tr']);
    if (_.isEmpty(recordings)) {
      return null;
    }

    const dstPath = path.join(await tempDir.openDir(), recordings[0]);
    // increase timeout to 5 minutes because it might take a while to pull a large video file
    await this.adb.pull(`${RECORDINGS_ROOT}/${recordings[0]}`, dstPath, {timeout: 300000});
    return dstPath;
  }

  async stop () {
    if (!await this.isRunning()) {
      return false;
    }

    await this.adb.shell([
      'am', 'start',
      '-n', RECORDING_ACTIVITY_NAME,
      '-a', RECORDING_ACTION_STOP,
    ]);
    try {
      await waitForCondition(async () => !(await this.isRunning()), {
        waitMs: RECORDING_STOP_TIMEOUT_MS,
        intervalMs: 500,
      });
    } catch (e) {
      throw new Error(
        `The attempt to stop the current media projection recording timed out after ` +
        `${RECORDING_STOP_TIMEOUT_MS}ms`
      );
    }
    return true;
  }
}


/**
 * @typedef {Object} StartRecordingOptions
 *
 * @property {string?} resolution Maximum supported resolution on-device (Detected
 * automatically by the app itself), which usually equals to Full HD 1920x1080 on most
 * phones however you can change it to following supported resolutions
 * as well: "1920x1080", "1280x720", "720x480", "320x240", "176x144".
 * @property {number?} maxDurationSec [900] Default value: 900 seconds which means
 * maximum allowed duration is 15 minute, you can increase it if your test takes
 * longer than that.
 * @property {string?} priority [high] Means recording thread priority is maximum
 * however if you face performance drops during testing with recording enabled, you
 * can reduce recording priority to "normal" or "low".
 * @property {string?} filename You can type recording video file name as you want,
 * but recording currently supports only "mp4" format so your filename must end with ".mp4".
 * An invalid file name will fail to start the recording.
 * If not provided then the current timestamp will be used as file name.
 */

/**
 * Record the display of a real devices running Android 10 (API level 29) and higher.
 * The screen activity is recorded to a MPEG-4 file. Audio is also recorded by default
 * (only for apps that allow it in their manifests).
 * If another recording has been already started then the command will exit silently.
 * The previously recorded video file is deleted when a new recording session is started.
 * Recording continues it is stopped explicitly or until the timeout happens.
 *
 * @param {?StartRecordingOptions} options Available options.
 * @returns {boolean} True if a new recording has successfully started.
 * @throws {Error} If recording has failed to start or is not supported on the device under test.
 */
commands.mobileStartMediaProjectionRecording = async function mobileStartMediaProjectionRecording (options = {}) {
  await verifyMediaProjectionRecordingIsSupported(this.adb);

  const {resolution, priority, maxDurationSec, filename} = options;
  const recorder = new MediaProjectionRecorder(this.adb);
  const fname = adjustMediaExtension(filename || moment().format(DEFAULT_FILENAME_FORMAT));
  const didStart = await recorder.start({
    resolution,
    priority,
    maxDurationSec,
    filename: fname,
  });
  if (didStart) {
    this.log.info(`A new media projection recording '${fname}' has been successfully started`);
  } else {
    this.log.info('Another media projection recording is already in progress. There is nothing to start');
  }
  return didStart;
};

/**
 * Checks if a media projection-based recording is currently running.
 *
 * @returns {boolean} True if a recording is in progress.
 * @throws {Error} If a recording is not supported on the device under test.
 */
commands.mobileIsMediaProjectionRecordingRunning = async function mobileIsMediaProjectionRecordingRunning () {
  await verifyMediaProjectionRecordingIsSupported(this.adb);

  const recorder = new MediaProjectionRecorder(this.adb);
  return await recorder.isRunning();
};

/**
 * @typedef {Object} StopRecordingOptions
 *
 * @property {string?} remotePath The path to the remote location, where the resulting video should be uploaded.
 * The following protocols are supported: http/https, ftp.
 * Null or empty string value (the default setting) means the content of resulting
 * file should be encoded as Base64 and passed as the endpoont response value.
 * An exception will be thrown if the generated media file is too big to
 * fit into the available process memory.
 * @property {string?} user The name of the user for the remote authentication.
 * @property {string?} pass The password for the remote authentication.
 * @property {string?} method The http multipart upload method name. The 'PUT' one is used by default.
 * @property {Object?} headers Additional headers mapping for multipart http(s) uploads
 * @property {string?} fileFieldName [file] The name of the form field, where the file content BLOB should be stored for
 * http(s) uploads
 * @property {Object|Array<Pair>?} formFields Additional form fields for multipart http(s) uploads
 * @property {number?} uploadTimeout - The actual media upload request timeout in milliseconds;
 * defaults to @appium/support net DEFAULT_TIMEOUT_MS
 */

/**
 * Stop a media projection-based recording.
 * If no recording has been started before then an error is thrown.
 * If the recording has been already finished before this API has been called
 * then the most recent recorded file is returned.
 *
 * @param {?StopRecordingOptions} options Available options.
 * @returns {string} Base64-encoded content of the recorded media file if 'remotePath'
 * parameter is falsy or an empty string.
 * @throws {Error} If there was an error while stopping a recording,
 * fetching the content of the remote media file,
 * or if a recording is not supported on the device under test.
 */
commands.mobileStopMediaProjectionRecording = async function mobileStopMediaProjectionRecording (options = {}) {
  await verifyMediaProjectionRecordingIsSupported(this.adb);

  const recorder = new MediaProjectionRecorder(this.adb);
  if (await recorder.stop()) {
    this.log.info('Successfully stopped a media projection recording. Pulling the recorded media');
  } else {
    this.log.info('Media projection recording is not running. There is nothing to stop');
  }
  const recentRecordingPath = await recorder.pullRecent();
  if (!recentRecordingPath) {
    throw new Error(`No recent media projection recording have been found. Did you start any?`);
  }

  const {remotePath} = options;
  if (_.isEmpty(remotePath)) {
    const {size} = await fs.stat(recentRecordingPath);
    this.log.debug(`The size of the resulting media projection recording is ${util.toReadableSizeString(size)}`);
  }
  try {
    return await uploadRecordedMedia(recentRecordingPath, remotePath, options);
  } finally {
    await fs.rimraf(path.dirname(recentRecordingPath));
  }
};


export { commands };
export default commands;
