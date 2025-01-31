import {errors} from 'appium/driver';

/**
 * Simulates the onTrimMemory() event for the given package.
 * Read https://developer.android.com/topic/performance/memory
 * for more details.
 *
 * @this {import('../driver').AndroidDriver}
 * @param {string} pkg The package name to send the `trimMemory` event to
 * @param {'COMPLETE' | 'MODERATE' | 'BACKGROUND' | 'UI_HIDDEN' | 'RUNNING_CRITICAL' | 'RUNNING_LOW' | 'RUNNING_MODERATE'} level The
 * actual memory trim level to be sent
 * @returns {Promise<void>}
 */
export async function mobileSendTrimMemory(pkg, level) {
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
