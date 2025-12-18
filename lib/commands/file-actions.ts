import _ from 'lodash';
import {fs, util, zip, tempDir} from '@appium/support';
import path from 'path';
import {errors} from 'appium/driver';
import type {AndroidDriver} from '../driver';
import type {ADB} from 'appium-adb';

const CONTAINER_PATH_MARKER = '@';
// https://regex101.com/r/PLdB0G/2
const CONTAINER_PATH_PATTERN = new RegExp(`^${CONTAINER_PATH_MARKER}([^/]+)/(.+)`);
const ANDROID_MEDIA_RESCAN_INTENT = 'android.intent.action.MEDIA_SCANNER_SCAN_FILE';

/**
 * Pulls a file from the remote device.
 *
 * The full path to the remote file or a specially formatted path, which
 * points to an item inside an app bundle, for example `@my.app.id/my/path`.
 * It is mandatory for the app bundle to have debugging enabled in order to
 * use the latter `remotePath` format.
 *
 * @param remotePath The full path to the remote file or a specially formatted path, which
 * points to an item inside an app bundle, for example `@my.app.id/my/path`.
 * It is mandatory for the app bundle to have debugging enabled in order to
 * use the latter `remotePath` format.
 * @returns Promise that resolves to the file content as a base64-encoded string.
 * @throws {errors.InvalidArgumentError} If the remote path points to a folder instead of a file.
 */
export async function pullFile(
  this: AndroidDriver,
  remotePath: string,
): Promise<string> {
  if (remotePath.endsWith('/')) {
    throw new errors.InvalidArgumentError(
      `It is expected that remote path points to a file and not to a folder. ` +
        `'${remotePath}' is given instead`,
    );
  }
  let tmpDestination: string | null = null;
  if (remotePath.startsWith(CONTAINER_PATH_MARKER)) {
    const [packageId, pathInContainer] = parseContainerPath(remotePath);
    this.log.debug(
      `Parsed package identifier '${packageId}' from '${remotePath}'. Will get the data from '${pathInContainer}'`,
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
      throw this.log.errorWithException(
        `Cannot access the container of '${packageId}' application. ` +
          `Is the application installed and has 'debuggable' build option set to true? ` +
          `Original error: ${(e as Error).message}`,
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
}

/**
 * Pushes a file to the remote device.
 *
 * The full path to the remote file or a specially formatted path, which
 * points to an item inside an app bundle, for example `@my.app.id/my/path`.
 * It is mandatory for the app bundle to have debugging enabled in order to
 * use the latter `remotePath` format.
 *
 * @param remotePath The full path to the remote file or a specially formatted path, which
 * points to an item inside an app bundle, for example `@my.app.id/my/path`.
 * It is mandatory for the app bundle to have debugging enabled in order to
 * use the latter `remotePath` format.
 * @param base64Data Base64-encoded content of the file to be pushed.
 * Can be a string or an array of numbers (for Java clients that send byte arrays).
 * @returns Promise that resolves when the file is pushed.
 * @throws {errors.InvalidArgumentError} If the remote path points to a folder instead of a file.
 */
export async function pushFile(
  this: AndroidDriver,
  remotePath: string,
  base64Data: string | number[],
): Promise<void> {
  if (remotePath.endsWith('/')) {
    throw new errors.InvalidArgumentError(
      `It is expected that remote path points to a file and not to a folder. ` +
        `'${remotePath}' is given instead`,
    );
  }
  const localFile = await tempDir.path({prefix: 'appium', suffix: '.tmp'});
  let base64String: string;
  if (_.isArray(base64Data)) {
    // some clients (ahem) java, send a byte array encoding utf8 characters
    // instead of a string, which would be infinitely better!
    base64String = Buffer.from(base64Data).toString('utf8');
  } else {
    base64String = base64Data;
  }
  const content = Buffer.from(base64String, 'base64');
  let tmpDestination: string | null = null;
  try {
    await fs.writeFile(localFile, content.toString('binary'), 'binary');
    if (remotePath.startsWith(CONTAINER_PATH_MARKER)) {
      const [packageId, pathInContainer] = parseContainerPath(remotePath);
      this.log.debug(
        `Parsed package identifier '${packageId}' from '${remotePath}'. ` +
          `Will put the data into '${pathInContainer}'`,
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
        throw this.log.errorWithException(
          `Cannot access the container of '${packageId}' application. ` +
            `Is the application installed and has 'debuggable' build option set to true? ` +
            `Original error: ${(e as Error).message}`,
        );
      }
    } else {
      // adb push creates folders and overwrites existing files.
      await this.adb.push(localFile, remotePath);

      // if we have pushed a file, it might be a media file, so ensure that
      // apps know about it
      await scanMedia.bind(this)(remotePath);
    }
  } finally {
    if (await fs.exists(localFile)) {
      await fs.unlink(localFile);
    }
    if (tmpDestination) {
      await this.adb.shell(['rm', '-f', tmpDestination]);
    }
  }
}

/**
 * Pulls a folder from the remote device.
 *
 * @param remotePath The full path to the remote folder.
 * @returns Promise that resolves to the folder content as a base64-encoded zip file string.
 */
export async function pullFolder(
  this: AndroidDriver,
  remotePath: string,
): Promise<string> {
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
}

/**
 * Deletes a file from the remote device.
 *
 * @param remotePath The full path to the remote file or a file inside an application bundle
 * (for example `@my.app.id/path/in/bundle`).
 * @returns Promise that resolves to `true` if the file was successfully deleted, `false` if it doesn't exist.
 * @throws {errors.InvalidArgumentError} If the remote path points to a folder instead of a file.
 */
export async function mobileDeleteFile(
  this: AndroidDriver,
  remotePath: string,
): Promise<boolean> {
  if (remotePath.endsWith('/')) {
    throw new errors.InvalidArgumentError(
      `It is expected that remote path points to a folder and not to a file. ` +
        `'${remotePath}' is given instead`,
    );
  }
  return await deleteFileOrFolder.call(this, this.adb, remotePath);
}

/**
 * Deletes the given folder or file from the remote device
 *
 * @throws {Error} If the provided remote path is invalid or
 * the package content cannot be accessed
 * @returns `true` if the remote item has been successfully deleted.
 * If the remote path is valid, but the remote path does not exist
 * this function return `false`.
 */
async function deleteFileOrFolder(
  this: AndroidDriver,
  adb: ADB,
  remotePath: string,
): Promise<boolean> {
  const {isDir, isPresent, isFile} = createFSTests(adb);
  let dstPath = remotePath;
  let pkgId: string | undefined;
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
      throw this.log.errorWithException(
        `Cannot access the container of '${pkgId}' application. ` +
          `Is the application installed and has 'debuggable' build option set to true? ` +
          `Original error: ${(e as Error).message}`,
      );
    }
  }

  if (!(await isPresent(dstPath, pkgId))) {
    this.log.info(`The item at '${dstPath}' does not exist. Perhaps, already deleted?`);
    return false;
  }

  const expectsFile = !remotePath.endsWith('/');
  if (expectsFile && !(await isFile(dstPath, pkgId))) {
    throw this.log.errorWithException(`The item at '${dstPath}' is not a file`);
  } else if (!expectsFile && !(await isDir(dstPath, pkgId))) {
    throw this.log.errorWithException(`The item at '${dstPath}' is not a folder`);
  }

  if (pkgId) {
    await adb.shell(['run-as', pkgId, `rm -f${expectsFile ? '' : 'r'} '${escapePath(dstPath)}'`]);
  } else {
    await adb.shell(['rm', `-f${expectsFile ? '' : 'r'}`, dstPath]);
  }
  if (await isPresent(dstPath, pkgId)) {
    throw this.log.errorWithException(
      `The item at '${dstPath}' still exists after being deleted. Is it writable?`,
    );
  }
  return true;
}

// #region Internal helpers

/**
 * Parses the actual destination path from the given value
 *
 * @returns An array, where the first item is the parsed package
 * identifier and the second one is the actual destination path inside the package.
 * @throws {Error} If the given string cannot be parsed
 */
function parseContainerPath(remotePath: string): [string, string] {
  const match = CONTAINER_PATH_PATTERN.exec(remotePath);
  if (!match) {
    throw new Error(
      `It is expected that package identifier is separated from the relative path with a single slash. ` +
        `'${remotePath}' is given instead`,
    );
  }
  return [match[1], path.posix.resolve(`/data/data/${match[1]}`, match[2])];
}

/**
 * Scans the given file/folder on the remote device
 * and adds matching items to the device's media library.
 * Exceptions are ignored and written into the log.
 */
async function scanMedia(
  this: AndroidDriver,
  remotePath: string,
): Promise<void> {
  this.log.debug(`Performing media scan of '${remotePath}'`);
  try {
    // https://github.com/appium/appium/issues/16184
    if ((await this.adb.getApiLevel()) >= 29) {
      await this.settingsApp.scanMedia(remotePath);
    } else {
      await this.adb.shell([
        'am',
        'broadcast',
        '-a',
        ANDROID_MEDIA_RESCAN_INTENT,
        '-d',
        `file://${remotePath}`,
      ]);
    }
  } catch (e) {
    const err = e as {stderr?: string; message?: string};
    // FIXME: what has a `stderr` prop?
    this.log.warn(
      `Ignoring an unexpected error upon media scanning of '${remotePath}': ${
        err.stderr ?? err.message
      }`,
    );
  }
}

/**
 * A small helper, which escapes single quotes in paths,
 * so they are safe to be passed as arguments of shell commands
 */
function escapePath(p: string): string {
  return p.replace(/'/g, `\\'`);
}

/**
 * Factory providing filesystem test functions using ADB
 */
function createFSTests(adb: ADB) {
  const performRemoteFsCheck = async (
    p: string,
    op: 'd' | 'f' | 'e',
    runAs?: string,
  ): Promise<boolean> => {
    const passFlag = '__PASS__';
    const checkCmd = `[ -${op} '${escapePath(p)}' ] && echo ${passFlag}`;
    const fullCmd = runAs ? `run-as ${runAs} ${checkCmd}` : checkCmd;
    try {
      return _.includes(await adb.shell([fullCmd]), passFlag);
    } catch {
      return false;
    }
  };

  const isFile = async (p: string, runAs?: string): Promise<boolean> =>
    await performRemoteFsCheck(p, 'f', runAs);
  const isDir = async (p: string, runAs?: string): Promise<boolean> =>
    await performRemoteFsCheck(p, 'd', runAs);
  const isPresent = async (p: string, runAs?: string): Promise<boolean> =>
    await performRemoteFsCheck(p, 'e', runAs);

  return {isFile, isDir, isPresent};
}

// #endregion

