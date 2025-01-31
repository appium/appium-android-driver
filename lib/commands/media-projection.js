import {fs, net, util} from '@appium/support';
import _ from 'lodash';
import moment from 'moment';
import path from 'node:path';

// https://github.com/appium/io.appium.settings#internal-audio--video-recording
const DEFAULT_EXT = '.mp4';
const MIN_API_LEVEL = 29;
const DEFAULT_FILENAME_FORMAT = 'YYYY-MM-DDTHH-mm-ss';

/**
 * @this {import('../driver').AndroidDriver}
 * @param {string} [resolution] Maximum supported resolution on-device (Detected automatically by the app
 * itself), which usually equals to Full HD 1920x1080 on most phones however
 * you can change it to following supported resolutions as well: "1920x1080",
 * "1280x720", "720x480", "320x240", "176x144".
 * @param {'high' | 'normal' | 'low'} [priority] Recording thread priority.
 * If you face performance drops during testing with recording enabled, you
 * can reduce recording priority
 * 'high' by default
 * @param {number} [maxDurationSec] Maximum allowed duration is 15 minutes; you can increase it if your test
 * takes longer than that. 900s by default.
 * @param {string} [filename] You can type recording video file name as you want, but recording currently
 * supports only "mp4" format so your filename must end with ".mp4". An
 * invalid file name will fail to start the recording. If not provided then
 * the current timestamp will be used as file name.
 * @returns {Promise<boolean>}
 */
export async function mobileStartMediaProjectionRecording(resolution, priority, maxDurationSec, filename) {
  await verifyMediaProjectionRecordingIsSupported(this.adb);

  const recorder = this.settingsApp.makeMediaProjectionRecorder();
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
    this.log.info(
      'Another media projection recording is already in progress. There is nothing to start',
    );
  }
  return didStart;
}

/**
 * @this {import('../driver').AndroidDriver}
 * @returns {Promise<boolean>}
 */
export async function mobileIsMediaProjectionRecordingRunning() {
  await verifyMediaProjectionRecordingIsSupported(this.adb);

  const recorder = this.settingsApp.makeMediaProjectionRecorder();
  return await recorder.isRunning();
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {string} [remotePath] The path to the remote location, where the resulting video should be
 * uploaded. The following protocols are supported: http/https, ftp. Null or
 * empty string value (the default setting) means the content of resulting
 * file should be encoded as Base64 and passed as the endpoont response value.
 * An exception will be thrown if the generated media file is too big to fit
 * into the available process memory.
 * @param {string} [user] The name of the user for the remote authentication.
 * @param {string} [pass] The password for the remote authentication.
 * @param {import('@appium/types').HTTPMethod} [method] The http multipart upload method name.
 * 'PUT' by default.
 * @param {import('@appium/types').StringRecord} [headers] Additional headers mapping for multipart http(s) uploads
 * @param {string} [fileFieldName] The name of the form field, where the file content BLOB should be stored
 * for http(s) uploads. 'file' by default.
 * @param {import('./types').FormFields} [formFields] Additional form fields for multipart http(s) uploads
 * @param {number} [uploadTimeout] The actual media upload request timeout in milliseconds.
 * Defaults to `@appium/support.net.DEFAULT_TIMEOUT_MS`
 * @returns {Promise<string>}
 */
export async function mobileStopMediaProjectionRecording(
  remotePath,
  user,
  pass,
  method,
  headers,
  fileFieldName,
  formFields,
  uploadTimeout,
) {
  await verifyMediaProjectionRecordingIsSupported(this.adb);

  const recorder = this.settingsApp.makeMediaProjectionRecorder();
  if (await recorder.stop()) {
    this.log.info('Successfully stopped a media projection recording. Pulling the recorded media');
  } else {
    this.log.info('Media projection recording is not running. There is nothing to stop');
  }
  const recentRecordingPath = await recorder.pullRecent();
  if (!recentRecordingPath) {
    throw new Error(`No recent media projection recording have been found. Did you start any?`);
  }

  if (_.isEmpty(remotePath)) {
    const {size} = await fs.stat(recentRecordingPath);
    this.log.debug(
      `The size of the resulting media projection recording is ${util.toReadableSizeString(size)}`,
    );
  }
  try {
    return await uploadRecordedMedia(recentRecordingPath, remotePath, {
      user,
      pass,
      method,
      headers,
      fileFieldName,
      formFields,
      uploadTimeout,
    });
  } finally {
    await fs.rimraf(path.dirname(recentRecordingPath));
  }
}

// #region Internal helpers

/**
 *
 * @param {string} localFile
 * @param {string} [remotePath]
 * @param {UploadOptions} uploadOptions
 * @returns
 */
async function uploadRecordedMedia(localFile, remotePath, uploadOptions = {}) {
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
  await net.uploadFile(localFile, /** @type {string} */ (remotePath), options);
  return '';
}

/**
 *
 * @param {string} name
 * @returns {string}
 */
function adjustMediaExtension(name) {
  return _.toLower(name).endsWith(DEFAULT_EXT) ? name : `${name}${DEFAULT_EXT}`;
}

/**
 *
 * @param {ADB} adb
 */
async function verifyMediaProjectionRecordingIsSupported(adb) {
  const apiLevel = await adb.getApiLevel();
  if (apiLevel < MIN_API_LEVEL) {
    throw new Error(
      `Media projection-based recording is not available on API Level ${apiLevel}. ` +
        `Minimum required API Level is ${MIN_API_LEVEL}.`,
    );
  }
}

// #endregion

/**
 * @typedef {Object} UploadOptions
 * @property {string} [user]
 * @property {string} [pass]
 * @property {import('@appium/types').HTTPMethod} [method]
 * @property {import('@appium/types').StringRecord} [headers]
 * @property {string} [fileFieldName]
 * @property {import('./types').FormFields} [formFields]
 * @property {number} [uploadTimeout]
 */

/**
 * @typedef {import('appium-adb').ADB} ADB
 */
