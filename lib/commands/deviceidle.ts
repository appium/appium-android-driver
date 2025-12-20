import {errors} from 'appium/driver';
import _ from 'lodash';
import type {AndroidDriver} from '../driver';

const SUPPORTED_ACTIONS = ['whitelistAdd', 'whitelistRemove'] as const;

/**
 * This is a wrapper to 'adb shell dumpsys deviceidle' interface.
 * Read https://www.protechtraining.com/blog/post/diving-into-android-m-doze-875
 * for more details.
 *
 * @param action The action name to execute.
 * @param packages Either a single package or multiple packages to add or remove from the idle whitelist.
 * @returns Promise that resolves when the action is completed.
 * @throws {errors.InvalidArgumentError} If packages argument is not a string or array.
 * @throws {errors.InvalidArgumentError} If action is not one of the supported actions.
 */
export async function mobileDeviceidle(
  this: AndroidDriver,
  action: typeof SUPPORTED_ACTIONS[number],
  packages?: string | string[],
): Promise<void> {
  if (!(_.isString(packages) || _.isArray(packages))) {
    throw new errors.InvalidArgumentError(`packages argument must be a string or an array`);
  }

  const packagesArr = _.isArray(packages) ? packages : [packages];
  const commonArgs = ['dumpsys', 'deviceidle', 'whitelist'];
  let argsGenerator: (pkg: string) => string[];
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

