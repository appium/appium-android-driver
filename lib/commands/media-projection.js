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
 * @param {import('./types').StartMediaProjectionRecordingOpts} [options={}]
 * @returns {Promise<boolean>}
 */
export async function mobileStartMediaProjectionRecording(options = {}) {
  await verifyMediaProjectionRecordingIsSupported(this.adb);

  const {resolution, priority, maxDurationSec, filename} = options;
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
 * @param {import('./types').StopMediaProjectionRecordingOpts} [options={}]
 * @returns {Promise<string>}
 */
export async function mobileStopMediaProjectionRecording(options = {}) {
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

  const {remotePath} = options;
  if (_.isEmpty(remotePath)) {
    const {size} = await fs.stat(recentRecordingPath);
    this.log.debug(
      `The size of the resulting media projection recording is ${util.toReadableSizeString(size)}`,
    );
  }
  try {
    return await uploadRecordedMedia(recentRecordingPath, remotePath, options);
  } finally {
    await fs.rimraf(path.dirname(recentRecordingPath));
  }
}

// #region Internal helpers

/**
 *
 * @param {string} localFile
 * @param {string} [remotePath]
 * @param {import('./types').StopMediaProjectionRecordingOpts} uploadOptions
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
  /**
   * @type {Omit<import('./types').StopMediaProjectionRecordingOpts, 'uploadTimeout'> & {auth?: {user: string, pass: string}, timeout?: number}}
   */
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
 * @typedef {import('appium-adb').ADB} ADB
 */
