import {errors} from 'appium/driver';
import path from 'node:path';
import {fs, tempDir} from '@appium/support';
import crypto from 'node:crypto';
import _ from 'lodash';

const EMULATOR_RESOURCES_ROOT = ['emulator', 'resources'];
const CONFIG_NAME = 'Toren1BD.posters';
const CONFIG = `poster wall
size 2 2
position -0.807 0.320 5.316
rotation 0 -150 0
default poster.png

poster table
size 1 1
position 0 0 -1.5
rotation 0 0 0
`;
const PNG_MAGIC = '89504e47';
const PNG_MAGIC_LENGTH = 4;

/**
 * Updates the emulator configuration to show the given
 * image on the foreground when one opens the Camera app.
 * It is expected that the rear camera of the emulator is
 * configured to show VirtualScene for this feature to work.
 *
 * @this {AndroidDriver}
 * @param {import('./types').ImageInjectionOpts} opts
 * @returns {Promise<void>}
 */
export async function mobileInjectEmulatorCameraImage(opts) {
  if (!this.isEmulator()) {
    throw new Error('The image injection feature is only available on emulators');
  }

  const {payload} = opts;
  if (!_.isString(payload) || _.size(payload) <= PNG_MAGIC_LENGTH) {
    throw new errors.InvalidArgumentError(
      `You must provide a valid base64-encoded .PNG data as the 'payload' argument`
    );
  }
  const pngBuffer = Buffer.from(payload, 'base64');
  const magic = pngBuffer.toString('hex', 0, PNG_MAGIC_LENGTH);
  if (magic !== PNG_MAGIC) {
    throw new errors.InvalidArgumentError(
      'The provided image payload must contain a valid base64-encoded .PNG data'
    );
  }

  const sdkRoot = /** @type {string} */ (this.adb.sdkRoot);
  const destinationFolder = path.resolve(sdkRoot, ...EMULATOR_RESOURCES_ROOT);
  await fs.writeFile(path.resolve(destinationFolder, CONFIG_NAME), CONFIG, 'utf-8');
  const tmpImagePath = await tempDir.path({
    // this is needed to avoid creation of multiple temp files for the same image payload
    prefix: calculateImageHash(pngBuffer),
    suffix: '.png',
  });
  await fs.writeFile(tmpImagePath, pngBuffer);
  await this.adb.execEmuConsoleCommand(`virtualscene-image table ${tmpImagePath}`);
  this.log.info(
    `The provided image has been successully injected to the ${this.adb.curDeviceId} emulator`
  );
}

// #region Internal helpers

/**
 *
 * @param {Buffer} buffer
 * @returns {string}
 */
function calculateImageHash(buffer) {
  const hasher = crypto.createHash('sha1');
  hasher.update(buffer);
  return hasher.digest('hex');
}

// #endregion

/**
 * @typedef {import('appium-adb').ADB} ADB
 * @typedef {import('../driver').AndroidDriver} AndroidDriver
 */
