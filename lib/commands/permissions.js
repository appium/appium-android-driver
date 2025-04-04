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
 * @param {string | string[]} permissions If `target` is set to 'pm':
 *  The full name of the permission to be changed
 * or a list of permissions. Check https://developer.android.com/reference/android/Manifest.permission
 * to get the full list of standard Android permssion names. Mandatory argument.
 * If 'all' magic string is passed then the chosen action is going to be applied to all
 * permisisons requested/granted by 'appPackage'.
 * If `target` is set to 'appops':
 * The full name of the appops permission to be changed
 * or a list of permissions. Check AppOpsManager.java sources to get the full list of
 * available appops permission names. Mandatory argument.
 * Examples: 'ACTIVITY_RECOGNITION', 'SMS_FINANCIAL_TRANSACTIONS', 'READ_SMS', 'ACCESS_NOTIFICATIONS'.
 * The 'all' magic string is unsupported.
 * @param {string} [appPackage] The application package to set change permissions on. Defaults to the
 * package name under test
 * @param {string} [action] One of `PM_ACTION` values if `target` is set to 'pm', otherwise
 * one of `APPOPS_ACTION` values
 * @param {'pm' | 'appops'} [target='pm'] Either 'pm' or 'appops'. The 'appops' one requires
 * 'adb_shell' server security option to be enabled.
 */
export async function mobileChangePermissions(
  permissions,
  appPackage,
  action,
  target = PERMISSION_TARGET.PM
) {
  appPackage ??= this.opts.appPackage;
  action ??= _.toLower(target) === PERMISSION_TARGET.APPOPS
    ? APPOPS_ACTION.ALLOW
    : PM_ACTION.GRANT;
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
      this.assertFeatureEnabled(ADB_SHELL_FEATURE);
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
 * @param {string} [type='requested'] One of possible permission types to get.
 * @param {string} [appPackage] The application package to set change permissions on.
 * Defaults to the package name under test
 * @returns {Promise<string[]>}
 */
export async function mobileGetPermissions(type = PERMISSIONS_TYPE.REQUESTED, appPackage) {
  appPackage ??= this.opts.appPackage;
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
