// @ts-check

import _ from 'lodash';
import {fs, util, zip, tempDir} from '@appium/support';
import path from 'path';
import {errors} from 'appium/driver';
import {requireArgs} from '../utils';
import {mixin} from './mixins';

const CONTAINER_PATH_MARKER = '@';
// https://regex101.com/r/PLdB0G/2
const CONTAINER_PATH_PATTERN = new RegExp(`^${CONTAINER_PATH_MARKER}([^/]+)/(.+)`);
const ANDROID_MEDIA_RESCAN_INTENT = 'android.intent.action.MEDIA_SCANNER_SCAN_FILE';

/**
 * Parses the actual destination path from the given value
 *
 * @param {string} remotePath The preformatted remote path, which looks like
 * `@my.app.id/my/path`
 * @returns {Array<string>} An array, where the first item is the parsed package
 * identifier and the second one is the actual destination path inside the package.
 * @throws {Error} If the given string cannot be parsed
 */
function parseContainerPath(remotePath) {
  const match = CONTAINER_PATH_PATTERN.exec(remotePath);
  if (!match) {
    throw new Error(
      `It is expected that package identifier is separated from the relative path with a single slash. ` +
        `'${remotePath}' is given instead`
    );
  }
  return [match[1], path.posix.resolve(`/data/data/${match[1]}`, match[2])];
}

/**
 * Scans the given file/folder on the remote device
 * and adds matching items to the device's media library.
 * Exceptions are ignored and written into the log.
 *
 * @param {ADB} adb ADB instance
 * @param {string} remotePath The file/folder path on the remote device
 * @param {import('@appium/types').AppiumLogger} [log] Logger instance
 */
async function scanMedia(adb, remotePath, log) {
  log?.debug(`Performing media scan of '${remotePath}'`);
  try {
    // https://github.com/appium/appium/issues/16184
    if ((await adb.getApiLevel()) >= 29) {
      await adb.scanMedia(remotePath);
    } else {
      await adb.shell([
        'am',
        'broadcast',
        '-a',
        ANDROID_MEDIA_RESCAN_INTENT,
        '-d',
        `file://${remotePath}`,
      ]);
    }
  } catch (e) {
    const err = /** @type {any} */ (e);
    // FIXME: what has a `stderr` prop?
    log?.warn(
      `Ignoring an unexpected error upon media scanning of '${remotePath}': ${
        err.stderr ?? err.message
      }`
    );
  }
}

/**
 * A small helper, which escapes single quotes in paths,
 * so they are safe to be passed as arguments of shell commands
 *
 * @param {string} p The initial remote path
 * @returns {string} The escaped path value
 */
function escapePath(p) {
  return p.replace(/'/g, `\\'`);
}

/**
 * @type {import('./mixins').FileActionsMixin & ThisType<import('../driver').AndroidDriver>}
 * @satisfies {import('@appium/types').ExternalDriver}
 */
const FileActionsMixin = {
  async pullFile(remotePath) {
    if (remotePath.endsWith('/')) {
      throw new errors.InvalidArgumentError(
        `It is expected that remote path points to a file and not to a folder. ` +
          `'${remotePath}' is given instead`
      );
    }
    let tmpDestination = null;
    if (remotePath.startsWith(CONTAINER_PATH_MARKER)) {
      const [packageId, pathInContainer] = parseContainerPath(remotePath);
      this.log.debug(
        `Parsed package identifier '${packageId}' from '${remotePath}'. Will get the data from '${pathInContainer}'`
      );
      tmpDestination = `/data/local/tmp/${path.posix.basename(pathInContainer)}`;
      try {
        await this.adb.shell(['run-as', packageId, `chmod 777 '${escapePath(pathInContainer)}'`]);
        await this.adb.shell([
          'run-as',
          packageId,
          `cp -f '${escapePath(pathInContainer)}' '${escapePath(tmpDestination)}'`,
        ]);
      } catch (e) {
        this.log.errorAndThrow(
          `Cannot access the container of '${packageId}' application. ` +
            `Is the application installed and has 'debuggable' build option set to true? ` +
            `Original error: ${/** @type {Error} */ (e).message}`
        );
      }
    }
    const localFile = await tempDir.path({prefix: 'appium', suffix: '.tmp'});
    try {
      await this.adb.pull(tmpDestination || remotePath, localFile);
      return (await util.toInMemoryBase64(localFile)).toString();
    } finally {
      if (await fs.exists(localFile)) {
        await fs.unlink(localFile);
      }
      if (tmpDestination) {
        await this.adb.shell(['rm', '-f', tmpDestination]);
      }
    }
  },

  async mobilePullFile(opts) {
    const {remotePath} = requireArgs('remotePath', opts);
    return await this.pullFile(remotePath);
  },

  async pushFile(remotePath, base64Data) {
    if (remotePath.endsWith('/')) {
      throw new errors.InvalidArgumentError(
        `It is expected that remote path points to a file and not to a folder. ` +
          `'${remotePath}' is given instead`
      );
    }
    const localFile = await tempDir.path({prefix: 'appium', suffix: '.tmp'});
    if (_.isArray(base64Data)) {
      // some clients (ahem) java, send a byte array encoding utf8 characters
      // instead of a string, which would be infinitely better!
      base64Data = Buffer.from(base64Data).toString('utf8');
    }
    const content = Buffer.from(base64Data, 'base64');
    let tmpDestination = null;
    try {
      await fs.writeFile(localFile, content.toString('binary'), 'binary');
      if (remotePath.startsWith(CONTAINER_PATH_MARKER)) {
        const [packageId, pathInContainer] = parseContainerPath(remotePath);
        this.log.debug(
          `Parsed package identifier '${packageId}' from '${remotePath}'. ` +
            `Will put the data into '${pathInContainer}'`
        );
        tmpDestination = `/data/local/tmp/${path.posix.basename(pathInContainer)}`;
        try {
          await this.adb.shell([
            'run-as',
            packageId,
            `mkdir -p '${escapePath(path.posix.dirname(pathInContainer))}'`,
          ]);
          await this.adb.shell(['run-as', packageId, `touch '${escapePath(pathInContainer)}'`]);
          await this.adb.shell(['run-as', packageId, `chmod 777 '${escapePath(pathInContainer)}'`]);
          await this.adb.push(localFile, tmpDestination);
          await this.adb.shell([
            'run-as',
            packageId,
            `cp -f '${escapePath(tmpDestination)}' '${escapePath(pathInContainer)}'`,
          ]);
        } catch (e) {
          this.log.errorAndThrow(
            `Cannot access the container of '${packageId}' application. ` +
              `Is the application installed and has 'debuggable' build option set to true? ` +
              `Original error: ${/** @type {Error} */ (e).message}`
          );
        }
      } else {
        // adb push creates folders and overwrites existing files.
        await this.adb.push(localFile, remotePath);

        // if we have pushed a file, it might be a media file, so ensure that
        // apps know about it
        await scanMedia(this.adb, remotePath, this.log);
      }
    } finally {
      if (await fs.exists(localFile)) {
        await fs.unlink(localFile);
      }
      if (tmpDestination) {
        await this.adb.shell(['rm', '-f', tmpDestination]);
      }
    }
  },

  async mobilePushFile(opts) {
    const {remotePath, payload} = requireArgs(['remotePath', 'payload'], opts);
    return await this.pushFile(remotePath, payload);
  },

  async pullFolder(remotePath) {
    const tmpRoot = await tempDir.openDir();
    try {
      await this.adb.pull(remotePath, tmpRoot);
      return (
        await zip.toInMemoryZip(tmpRoot, {
          encodeToBase64: true,
        })
      ).toString();
    } finally {
      await fs.rimraf(tmpRoot);
    }
  },

  async mobilePullFolder(opts) {
    const {remotePath} = requireArgs('remotePath', opts);
    return await this.pullFolder(remotePath);
  },

  async mobileDeleteFile(opts) {
    const {remotePath} = requireArgs('remotePath', opts);
    if (remotePath.endsWith('/')) {
      throw new errors.InvalidArgumentError(
        `It is expected that remote path points to a folder and not to a file. ` +
          `'${remotePath}' is given instead`
      );
    }
    return await deleteFileOrFolder.call(this, this.adb, remotePath);
  },
};

/**
 * Factory providing filesystem test functions using ADB
 * @param {ADB} adb
 */
function createFSTests(adb) {
  /**
   *
   * @param {string} p
   * @param {'d'|'f'|'e'} op
   * @param {string} [runAs]
   * @returns
   */
  const performRemoteFsCheck = async (p, op, runAs) => {
    const passFlag = '__PASS__';
    const checkCmd = `[ -${op} '${escapePath(p)}' ] && echo ${passFlag}`;
    const fullCmd = runAs ? `run-as ${runAs} ${checkCmd}` : checkCmd;
    try {
      return _.includes(await adb.shell([fullCmd]), passFlag);
    } catch (ign) {
      return false;
    }
  };

  /**
   * @param {string} p
   * @param {string} [runAs]
   */
  const isFile = async (p, runAs) => await performRemoteFsCheck(p, 'f', runAs);
  /**
   * @param {string} p
   * @param {string} [runAs]
   */
  const isDir = async (p, runAs) => await performRemoteFsCheck(p, 'd', runAs);
  /**
   * @param {string} p
   * @param {string} [runAs]
   */
  const isPresent = async (p, runAs) => await performRemoteFsCheck(p, 'e', runAs);

  return {isFile, isDir, isPresent};
}

/**
 * Deletes the given folder or file from the remote device
 *
 * @param {ADB} adb
 * @param {string} remotePath The full path to the remote folder
 * or file (folder names must end with a single slash)
 * @throws {Error} If the provided remote path is invalid or
 * the package content cannot be accessed
 * @returns {Promise<boolean>} `true` if the remote item has been successfully deleted.
 * If the remote path is valid, but the remote path does not exist
 * this function return `false`.
 * @this {import('../driver').AndroidDriver}
 */
async function deleteFileOrFolder(adb, remotePath) {
  const {isDir, isPresent, isFile} = createFSTests(adb);
  let dstPath = remotePath;
  /** @type {string|undefined} */
  let pkgId;
  if (remotePath.startsWith(CONTAINER_PATH_MARKER)) {
    const [packageId, pathInContainer] = parseContainerPath(remotePath);
    this.log.debug(`Parsed package identifier '${packageId}' from '${remotePath}'`);
    dstPath = pathInContainer;
    pkgId = packageId;
  }

  if (pkgId) {
    try {
      await adb.shell(['run-as', pkgId, 'ls']);
    } catch (e) {
      this.log.errorAndThrow(
        `Cannot access the container of '${pkgId}' application. ` +
          `Is the application installed and has 'debuggable' build option set to true? ` +
          `Original error: ${/** @type {Error} */ (e).message}`
      );
    }
  }

  if (!(await isPresent(dstPath, pkgId))) {
    this.log.info(`The item at '${dstPath}' does not exist. Perhaps, already deleted?`);
    return false;
  }

  const expectsFile = !remotePath.endsWith('/');
  if (expectsFile && !(await isFile(dstPath, pkgId))) {
    this.log.errorAndThrow(`The item at '${dstPath}' is not a file`);
  } else if (!expectsFile && !(await isDir(dstPath, pkgId))) {
    this.log.errorAndThrow(`The item at '${dstPath}' is not a folder`);
  }

  if (pkgId) {
    await adb.shell(['run-as', pkgId, `rm -f${expectsFile ? '' : 'r'} '${escapePath(dstPath)}'`]);
  } else {
    await adb.shell(['rm', `-f${expectsFile ? '' : 'r'}`, dstPath]);
  }
  if (await isPresent(dstPath, pkgId)) {
    this.log.errorAndThrow(
      `The item at '${dstPath}' still exists after being deleted. ` + `Is it writable?`
    );
  }
  return true;
}

mixin(FileActionsMixin);

/**
 * @typedef {import('appium-adb').ADB} ADB
 */

export default FileActionsMixin;
