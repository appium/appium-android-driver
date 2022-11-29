import _ from 'lodash';
import { errors } from 'appium/driver';

export const ADB_SHELL_FEATURE = 'adb_shell';

/**
 * Assert the presence of particular keys in the given object
 *
 * @param {string|Array<string>} argNames one or more key names
 * @param {Object} opts the object to check
 * @returns {Object} the same given object
 */
export function requireArgs (argNames, opts = {}) {
  for (const argName of (_.isArray(argNames) ? argNames : [argNames])) {
    if (!_.has(opts, argName)) {
      throw new errors.InvalidArgumentError(`'${argName}' argument must be provided`);
    }
  }
  return opts;
}