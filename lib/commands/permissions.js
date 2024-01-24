import {errors} from 'appium/driver';
import B from 'bluebird';
import _ from 'lodash';
import {ADB_SHELL_FEATURE} from '../utils';

const ALL_PERMISSIONS_MAGIC = 'all';
const PM_ACTION = Object.freeze({
  GRANT: 'grant',
  REVOKE: 'revoke',
});
const APPOPS_ACTION = Object.freeze({
  ALLOW: 'allow',
  DENY: 'deny',
  IGNORE: 'ignore',
  DEFAULT: 'default',
});
const PERMISSION_TARGET = Object.freeze({
  PM: 'pm',
  APPOPS: 'appops',
});
const PERMISSIONS_TYPE = Object.freeze({
  DENIED: 'denied',
  GRANTED: 'granted',
  REQUESTED: 'requested',
});

/**
 * @this {import('../driver').AndroidDriver}
 * @param {import('./types').ChangePermissionsOpts} opts
 * @returns {Promise<void>}
 */
export async function mobileChangePermissions(opts) {
  const {
    permissions,
    appPackage = this.opts.appPackage,
    action = _.toLower(opts.target) === PERMISSION_TARGET.APPOPS
      ? APPOPS_ACTION.ALLOW
      : PM_ACTION.GRANT,
    target = PERMISSION_TARGET.PM,
  } = opts;
  if (_.isNil(permissions)) {
    throw new errors.InvalidArgumentError(`'permissions' argument is required`);
  }
  if (_.isEmpty(permissions)) {
    throw new errors.InvalidArgumentError(`'permissions' argument must not be empty`);
  }

  switch (_.toLower(target)) {
    case PERMISSION_TARGET.PM:
      return await changePermissionsViaPm.bind(this)(permissions, appPackage, _.toLower(action));
    case PERMISSION_TARGET.APPOPS:
      this.ensureFeatureEnabled(ADB_SHELL_FEATURE);
      return await changePermissionsViaAppops.bind(this)(
        permissions,
        appPackage,
        _.toLower(action),
      );
    default:
      throw new errors.InvalidArgumentError(
        `'target' argument must be one of: ${_.values(PERMISSION_TARGET)}`,
      );
  }
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {import('./types').GetPermissionsOpts} [opts={}]
 * @returns {Promise<string[]>}
 */
export async function mobileGetPermissions(opts = {}) {
  const {type = PERMISSIONS_TYPE.REQUESTED, appPackage = this.opts.appPackage} = opts;
  /**
   * @type {(pkg: string) => Promise<string[]>}
   */
  let actionFunc;
  switch (_.toLower(type)) {
    case PERMISSIONS_TYPE.REQUESTED:
      actionFunc = (pkg) => this.adb.getReqPermissions(pkg);
      break;
    case PERMISSIONS_TYPE.GRANTED:
      actionFunc = (pkg) => this.adb.getGrantedPermissions(pkg);
      break;
    case PERMISSIONS_TYPE.DENIED:
      actionFunc = (pkg) => this.adb.getDeniedPermissions(pkg);
      break;
    default:
      throw new errors.InvalidArgumentError(
        `Unknown permissions type '${type}'. ` +
          `Only ${JSON.stringify(_.values(PERMISSIONS_TYPE))} types are supported`,
      );
  }
  return await actionFunc(/** @type {string} */ (appPackage));
}

// #region Internal helpers

/**
 * @this {AndroidDriver}
 * @param {string|string[]} permissions
 * @param {string} appPackage
 * @param {import('type-fest').ValueOf<PM_ACTION>} action
 */
async function changePermissionsViaPm(permissions, appPackage, action) {
  if (!_.values(PM_ACTION).includes(action)) {
    throw new errors.InvalidArgumentError(
      `Unknown action '${action}'. ` +
        `Only ${JSON.stringify(_.values(PM_ACTION))} actions are supported`,
    );
  }

  let affectedPermissions = _.isArray(permissions) ? permissions : [permissions];
  if (_.isString(permissions) && _.toLower(permissions) === ALL_PERMISSIONS_MAGIC) {
    const dumpsys = await this.adb.shell(['dumpsys', 'package', appPackage]);
    const grantedPermissions = await this.adb.getGrantedPermissions(appPackage, dumpsys);
    if (action === PM_ACTION.GRANT) {
      const reqPermissons = await this.adb.getReqPermissions(appPackage, dumpsys);
      affectedPermissions = _.difference(reqPermissons, grantedPermissions);
    } else {
      affectedPermissions = grantedPermissions;
    }
    if (_.isEmpty(affectedPermissions)) {
      this.log.info(`'${appPackage}' contains no permissions to ${action}`);
      return;
    }
  }

  if (action === PM_ACTION.GRANT) {
    await this.adb.grantPermissions(appPackage, affectedPermissions);
  } else {
    await B.all(affectedPermissions.map((name) => this.adb.revokePermission(appPackage, name)));
  }
}
/**
 * @this {AndroidDriver}
 * @param {string|string[]} permissions
 * @param {string} appPackage
 * @param {import('type-fest').ValueOf<APPOPS_ACTION>} action
 */
async function changePermissionsViaAppops(permissions, appPackage, action) {
  if (!_.values(APPOPS_ACTION).includes(action)) {
    throw new errors.InvalidArgumentError(
      `Unknown action '${action}'. ` +
        `Only ${JSON.stringify(_.values(APPOPS_ACTION))} actions are supported`,
    );
  }
  if (_.isString(permissions) && _.toLower(permissions) === ALL_PERMISSIONS_MAGIC) {
    throw new errors.InvalidArgumentError(
      `'${ALL_PERMISSIONS_MAGIC}' permission is only supported for ` +
        `'${PERMISSION_TARGET.PM}' target. ` +
        `Check AppOpsManager.java from Android platform sources to get the full list of supported AppOps permissions`,
    );
  }

  const promises = (_.isArray(permissions) ? permissions : [permissions]).map((permission) =>
    this.adb.shell(['appops', 'set', appPackage, permission, action]),
  );
  await B.all(promises);
}

// #endregion

/**
 * @typedef {import('appium-adb').ADB} ADB
 * @typedef {import('../driver').AndroidDriver} AndroidDriver
 */
