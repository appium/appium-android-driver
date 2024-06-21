import {errors} from 'appium/driver';
import path from 'node:path';
import {fs, tempDir} from '@appium/support';
import crypto from 'node:crypto';
import _ from 'lodash';

const EMULATOR_RESOURCES_ROOT = ['emulator', 'resources'];
const CONFIG_NAME = 'Toren1BD.posters';
const DEFAULT_CONFIG_PAYLOAD_PREFIX = `poster wall
size 2 2
position -0.807 0.320 5.316
rotation 0 -150 0
default poster.png

poster table`;
const DEFAULT_CONFIG_PAYLOAD = `${DEFAULT_CONFIG_PAYLOAD_PREFIX}
size 1 1
position 0 0 -1.5
rotation 0 0 0
`;
const PNG_MAGIC = '89504e47';
const PNG_MAGIC_LENGTH = 4;

/**
 * Updates the emulator configuration to show the
 * image using the given properties when one opens the Camera app.
 *
 * @this {AndroidDriver}
 * @param {string} sdkRoot ADB SDK root folder path
 * @returns {Promise<boolean>} If emulator services restart is needed
 * to load the updated config or false if the current config is already up to date
 * or does not need to be updated
 */
export async function prepareEmulatorForImageInjection(sdkRoot) {
  const { injectedImageProperties: props } = this.opts;
  if (!props) {
    return false;
  }

  const size = `size ${props.size?.scaleX ?? 1} ${props.size?.scaleY ?? 1}`;
  const position = `position ${props.position?.x ?? 0} ${props.position?.y ?? 0} ${props.position?.z ?? -1.5}`;
  const rotation = `rotation ${props.rotation?.x ?? 0} ${props.rotation?.y ?? 0} ${props.rotation?.z ?? 0}`;
  const strProps = `${size}\n${position}\n${rotation}`;
  const configPath = path.resolve(sdkRoot, ...EMULATOR_RESOURCES_ROOT, CONFIG_NAME);
  if (await fs.exists(configPath)) {
    const configPayload = await fs.readFile(configPath, 'utf8');
    if (configPayload.includes(strProps)) {
      this.log.info(`The image injection config at '${configPath}' is already up to date. Doing nothing`);
      return false;
    }
    const updatedPayload = `${DEFAULT_CONFIG_PAYLOAD_PREFIX}
    ${size}
    ${position}
    ${rotation}
    `;
    await fs.writeFile(configPath, updatedPayload, 'utf-8');
  } else {
    await fs.writeFile(configPath, DEFAULT_CONFIG_PAYLOAD, 'utf-8');
  }
  this.log.info(
    `The image injection config at '${configPath}' has been successfully updated with ` +
    `${size}, ${position}, ${rotation}. ` +
    `Expecting further emulator restart to reload the changed config.`
  );
  return true;
}

/**
 * Updates the emulator configuration to show the given
 * image on the foreground when one opens the Camera app.
 * It is expected that the rear camera of the emulator is
 * configured to show VirtualScene for this feature to work.
 * It is expected that the Virtual Scene posters config is
 * already prepared and loaded either manually or using the
 * `injectedImageProperties` capability.
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
