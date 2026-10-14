import {errors} from 'appium/driver.js';

import type {AndroidDriverConstraints} from '../constraints.js';
import type {AndroidDriver} from '../driver.js';

declare module '../driver.js' {
  interface AndroidDriver<C extends AndroidDriverConstraints> {
    reset(...args: Parameters<typeof reset>): ReturnType<typeof reset>;
    closeApp(...args: Parameters<typeof closeApp>): ReturnType<typeof closeApp>;
    launchApp(...args: Parameters<typeof launchApp>): ReturnType<typeof launchApp>;
  }
}

const ISSUE_URL = 'https://github.com/appium/appium/issues/15807';

/**
 * Launches the application.
 *
 * @returns Promise that resolves when the app is launched.
 * @throws {errors.UnsupportedOperationError} This API is not supported anymore.
 */
export async function launchApp(this: AndroidDriver): Promise<void> {
  throw new errors.UnsupportedOperationError(`This API is not supported anymore. See ${ISSUE_URL}`);
}

/**
 * Closes the application.
 *
 * @returns Promise that resolves when the app is closed.
 * @throws {errors.UnsupportedOperationError} This API is not supported anymore.
 */
export async function closeApp(this: AndroidDriver): Promise<void> {
  throw new errors.UnsupportedOperationError(`This API is not supported anymore. See ${ISSUE_URL}`);
}

/**
 * Resets the application state.
 *
 * @returns Promise that resolves when the app is reset.
 * @throws {errors.UnsupportedOperationError} This API is not supported anymore.
 */
export async function reset(this: AndroidDriver): Promise<void> {
  throw new errors.UnsupportedOperationError(`This API is not supported anymore. See ${ISSUE_URL}`);
}
