import {errors} from 'appium/driver';
import _ from 'lodash';

const SUPPORTED_ACTIONS = ['whitelistAdd', 'whitelistRemove'];

/**
 * This is a wrapper to 'adb shell dumpsys deviceidle' interface.
 * Read https://www.protechtraining.com/blog/post/diving-into-android-m-doze-875
 * for more details.
 *
 * @param {import('./types').DeviceidleOpts} opts
 * @returns {Promise<void>}
 */
export async function mobileDeviceidle(opts) {
  const {action, packages} = opts;

  if (!(_.isString(packages) || _.isArray(packages))) {
    throw new errors.InvalidArgumentError(`packages argument must be a string or an array`);
  }

  /** @type {string[]} */
  const packagesArr = _.isArray(packages) ? packages : [packages];
  /** @type {string[]} */
  const commonArgs = ['dumpsys', 'deviceidle', 'whitelist'];
  /** @type {(x: string) => string[]} */
  let argsGenerator;
  switch (action) {
    case SUPPORTED_ACTIONS[0]:
      argsGenerator = (pkg) => [...commonArgs, `+${pkg}`];
      break;
    case SUPPORTED_ACTIONS[1]:
      argsGenerator = (pkg) => [...commonArgs, `-${pkg}`];
      break;
    default:
      throw new errors.InvalidArgumentError(
        `action must be one of ${JSON.stringify(SUPPORTED_ACTIONS)}. Got '${action}' instead`,
      );
  }
  await this.adb.shellChunks(argsGenerator, packagesArr);
}

/**
 * @typedef {import('appium-adb').ADB} ADB
 */
