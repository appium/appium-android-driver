import {errors} from 'appium/driver';

/**
 * Simulates the onTrimMemory() event for the given package.
 * Read https://developer.android.com/topic/performance/memory
 * for more details.
 *
 * @this {import('../driver').AndroidDriver}
 * @param {import('./types').SendTrimMemoryOpts} opts
 * @returns {Promise<void>}
 */
export async function mobileSendTrimMemory(opts) {
  const {pkg, level} = opts;

  if (!pkg) {
    throw new errors.InvalidArgumentError(`The 'pkg' argument must be provided`);
  }
  if (!level) {
    throw new errors.InvalidArgumentError(`The 'level' argument must be provided`);
  }

  await this.adb.shell(['am', 'send-trim-memory', pkg, level]);
}

/**
 * @typedef {import('appium-adb').ADB} ADB
 */
