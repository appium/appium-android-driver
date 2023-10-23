// @ts-check

import {fs, net, tempDir, util} from '@appium/support';
import {waitForCondition} from 'asyncbox';
import B from 'bluebird';
import _ from 'lodash';
import moment from 'moment';
import path from 'node:path';
import {SETTINGS_HELPER_PKG_ID} from '../helpers';
import {mixin} from './mixins';

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
        `Minimum required API Level is ${MIN_API_LEVEL}.`
    );
  }
}

class MediaProjectionRecorder {
  /**
   * @param {ADB} adb
   */
  constructor(adb) {
    this.adb = adb;
  }

  async isRunning() {
    const stdout = await this.adb.shell([
      'dumpsys',
      'activity',
      'services',
      RECORDING_SERVICE_NAME,
    ]);
    return stdout.includes(RECORDING_SERVICE_NAME);
  }

  /**
   *
   * @param {import('./types').StartMediaProjectionRecordingOpts} opts
   * @returns {Promise<boolean>}
   */
  async start(opts = {}) {
    if (await this.isRunning()) {
      return false;
    }

    await this.cleanup();
    const {filename, maxDurationSec, priority, resolution} = opts;
    const args = ['am', 'start', '-n', RECORDING_ACTIVITY_NAME, '-a', RECORDING_ACTION_START];
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
        if (!(await this.isRunning())) {
          return reject(
            new Error(
              `The media projection recording is not running after ${RECORDING_STARTUP_TIMEOUT_MS}ms. ` +
                `Please check the logcat output for more details.`
            )
          );
        }
        resolve();
      }, RECORDING_STARTUP_TIMEOUT_MS);
    });
    return true;
  }

  async cleanup() {
    await this.adb.shell([`rm -f ${RECORDINGS_ROOT}/*`]);
  }

  async pullRecent() {
    const recordings = await this.adb.ls(RECORDINGS_ROOT, ['-tr']);
    if (_.isEmpty(recordings)) {
      return null;
    }

    const dstPath = path.join(await tempDir.openDir(), recordings[0]);
    // increase timeout to 5 minutes because it might take a while to pull a large video file
    await this.adb.pull(`${RECORDINGS_ROOT}/${recordings[0]}`, dstPath, {timeout: 300000});
    return dstPath;
  }

  async stop() {
    if (!(await this.isRunning())) {
      return false;
    }

    await this.adb.shell([
      'am',
      'start',
      '-n',
      RECORDING_ACTIVITY_NAME,
      '-a',
      RECORDING_ACTION_STOP,
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
 * @type {import('./mixins').MediaProjectionMixin & ThisType<import('../driver').AndroidDriver>}
 * @satisfies {import('@appium/types').ExternalDriver}
 */
const MediaProjectionMixin = {
  async mobileStartMediaProjectionRecording(options = {}) {
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
      this.log.info(
        'Another media projection recording is already in progress. There is nothing to start'
      );
    }
    return didStart;
  },

  async mobileIsMediaProjectionRecordingRunning() {
    await verifyMediaProjectionRecordingIsSupported(this.adb);

    const recorder = new MediaProjectionRecorder(this.adb);
    return await recorder.isRunning();
  },

  async mobileStopMediaProjectionRecording(options = {}) {
    await verifyMediaProjectionRecordingIsSupported(this.adb);

    const recorder = new MediaProjectionRecorder(this.adb);
    if (await recorder.stop()) {
      this.log.info(
        'Successfully stopped a media projection recording. Pulling the recorded media'
      );
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
        `The size of the resulting media projection recording is ${util.toReadableSizeString(size)}`
      );
    }
    try {
      return await uploadRecordedMedia(recentRecordingPath, remotePath, options);
    } finally {
      await fs.rimraf(path.dirname(recentRecordingPath));
    }
  },
};

mixin(MediaProjectionMixin);

export default MediaProjectionMixin;

/**
 * @typedef {import('appium-adb').ADB} ADB
 */
