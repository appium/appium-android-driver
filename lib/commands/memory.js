import {errors} from 'appium/driver';
import {mixin} from './mixins';

/**
 * @type {import('./mixins').MemoryMixin & ThisType<import('../driver').AndroidDriver>}
 * @satisfies {import('@appium/types').ExternalDriver}
 */
const MemoryMixin = {
  /**
   * Simulates the onTrimMemory() event for the given package.
   * Read https://developer.android.com/topic/performance/memory
   * for more details.
   *
   * @param {import('./types').SendTrimMemoryOpts} opts
   */
  async mobileSendTrimMemory(opts) {
    const {
      pkg,
      level,
    } = opts;

    if (!pkg) {
      throw new errors.InvalidArgumentError(`The 'pkg' argument must be provided`);
    }
    if (!level) {
      throw new errors.InvalidArgumentError(`The 'level' argument must be provided`);
    }

    await this.adb.shell(['am', 'send-trim-memory', pkg, level]);
  },
};

mixin(MemoryMixin);

export default MemoryMixin;

/**
 * @typedef {import('appium-adb').ADB} ADB
 */
