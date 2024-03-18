import { errors } from 'appium/driver';

const ISSUE_URL = 'https://github.com/appium/appium/issues/15807';

/**
 * @this {AndroidDriver}
 */
// eslint-disable-next-line require-await
export async function launchApp () {
  throw new errors.UnsupportedOperationError(`This API is not supported anymore. See ${ISSUE_URL}`);
}

/**
 * @this {AndroidDriver}
 */
// eslint-disable-next-line require-await
export async function closeApp () {
  throw new errors.UnsupportedOperationError(`This API is not supported anymore. See ${ISSUE_URL}`);
}

/**
 * @this {AndroidDriver}
 */
// eslint-disable-next-line require-await
export async function reset () {
  throw new errors.UnsupportedOperationError(`This API is not supported anymore. See ${ISSUE_URL}`);
}

/**
 * @typedef {import('../driver').AndroidDriver} AndroidDriver
 */
