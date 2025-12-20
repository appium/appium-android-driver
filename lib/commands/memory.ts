import {errors} from 'appium/driver';
import type {AndroidDriver} from '../driver';
import type {TrimMemoryLevel} from './types';

/**
 * Simulates the onTrimMemory() event for the given package.
 * Read https://developer.android.com/topic/performance/memory
 * for more details.
 *
 * @param pkg The package name to send the `trimMemory` event to
 * @param level The actual memory trim level to be sent
 * @returns Promise that resolves when the trim memory event is sent.
 * @throws {errors.InvalidArgumentError} If pkg or level arguments are not provided.
 */
export async function mobileSendTrimMemory(
  this: AndroidDriver,
  pkg: string,
  level: TrimMemoryLevel,
): Promise<void> {
  if (!pkg) {
    throw new errors.InvalidArgumentError(`The 'pkg' argument must be provided`);
  }
  if (!level) {
    throw new errors.InvalidArgumentError(`The 'level' argument must be provided`);
  }

  await this.adb.shell(['am', 'send-trim-memory', pkg, level]);
}

