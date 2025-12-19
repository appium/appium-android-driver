import {fs, net, util} from '@appium/support';
import type {NetOptions, HttpUploadOptions} from '@appium/support';
import _ from 'lodash';
import moment from 'moment';
import path from 'node:path';
import type {HTTPMethod, StringRecord} from '@appium/types';
import type {AndroidDriver} from '../driver';
import type {ADB} from 'appium-adb';
import type {FormFields} from './types';

// https://github.com/appium/io.appium.settings#internal-audio--video-recording
const DEFAULT_EXT = '.mp4';
const MIN_API_LEVEL = 29;
const DEFAULT_FILENAME_FORMAT = 'YYYY-MM-DDTHH-mm-ss';

/**
 * Starts media projection-based screen recording on the Android device.
 *
 * @param resolution Maximum supported resolution on-device (Detected automatically by the app
 * itself), which usually equals to Full HD 1920x1080 on most phones however
 * you can change it to following supported resolutions as well: "1920x1080",
 * "1280x720", "720x480", "320x240", "176x144".
 * @param priority Recording thread priority.
 * If you face performance drops during testing with recording enabled, you
 * can reduce recording priority. 'high' by default.
 * @param maxDurationSec Maximum allowed duration is 15 minutes; you can increase it if your test
 * takes longer than that. 900s by default.
 * @param filename You can type recording video file name as you want, but recording currently
 * supports only "mp4" format so your filename must end with ".mp4". An
 * invalid file name will fail to start the recording. If not provided then
 * the current timestamp will be used as file name.
 * @returns Promise that resolves to `true` if recording was started, `false` if another recording is already in progress.
 */
export async function mobileStartMediaProjectionRecording(
  this: AndroidDriver,
  resolution?: string,
  priority?: 'high' | 'normal' | 'low',
  maxDurationSec?: number,
  filename?: string,
): Promise<boolean> {
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
 * Checks if media projection recording is currently running.
 *
 * @returns Promise that resolves to `true` if recording is running, `false` otherwise.
 */
export async function mobileIsMediaProjectionRecordingRunning(
  this: AndroidDriver,
): Promise<boolean> {
  await verifyMediaProjectionRecordingIsSupported(this.adb);

  const recorder = this.settingsApp.makeMediaProjectionRecorder();
  return await recorder.isRunning();
}

/**
 * Stops the media projection recording and returns the recorded video.
 *
 * @param remotePath The path to the remote location, where the resulting video should be
 * uploaded. The following protocols are supported: http/https, ftp. Null or
 * empty string value (the default setting) means the content of resulting
 * file should be encoded as Base64 and passed as the endpoint response value.
 * An exception will be thrown if the generated media file is too big to fit
 * into the available process memory.
 * @param user The name of the user for the remote authentication.
 * @param pass The password for the remote authentication.
 * @param method The http multipart upload method name. 'PUT' by default.
 * @param headers Additional headers mapping for multipart http(s) uploads.
 * @param fileFieldName The name of the form field, where the file content BLOB should be stored
 * for http(s) uploads. 'file' by default.
 * @param formFields Additional form fields for multipart http(s) uploads.
 * @param uploadTimeout The actual media upload request timeout in milliseconds.
 * Defaults to `@appium/support.net.DEFAULT_TIMEOUT_MS`.
 * @returns Promise that resolves to the recorded video as a base64-encoded string
 * if `remotePath` is not provided, or an empty string if the video was uploaded to a remote location.
 * @throws {Error} If no recent recording was found.
 */
export async function mobileStopMediaProjectionRecording(
  this: AndroidDriver,
  remotePath?: string,
  user?: string,
  pass?: string,
  method?: HTTPMethod,
  headers?: StringRecord,
  fileFieldName?: string,
  formFields?: FormFields,
  uploadTimeout?: number,
): Promise<string> {
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

async function uploadRecordedMedia(
  localFile: string,
  remotePath?: string,
  uploadOptions: UploadOptions = {},
): Promise<string> {
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
  const options: NetOptions & HttpUploadOptions = {
    method: method || 'PUT',
    headers,
    fileFieldName,
    formFields,
    timeout,
  };
  if (user && pass) {
    options.auth = {user, pass};
  }
  await net.uploadFile(localFile, remotePath as string, options);
  return '';
}

function adjustMediaExtension(name: string): string {
  return _.toLower(name).endsWith(DEFAULT_EXT) ? name : `${name}${DEFAULT_EXT}`;
}

async function verifyMediaProjectionRecordingIsSupported(adb: ADB): Promise<void> {
  const apiLevel = await adb.getApiLevel();
  if (apiLevel < MIN_API_LEVEL) {
    throw new Error(
      `Media projection-based recording is not available on API Level ${apiLevel}. ` +
        `Minimum required API Level is ${MIN_API_LEVEL}.`,
    );
  }
}

// #endregion

interface UploadOptions {
  user?: string;
  pass?: string;
  method?: HTTPMethod;
  headers?: StringRecord;
  fileFieldName?: string;
  formFields?: FormFields;
  uploadTimeout?: number;
}

