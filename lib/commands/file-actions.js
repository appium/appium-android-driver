import _ from 'lodash';
import { fs, util, zip, tempDir} from 'appium-support';
import log from '../logger';
import path from 'path';


const CONTAINER_PATH_MARKER = '@';
// https://regex101.com/r/PLdB0G/2
const CONTAINER_PATH_PATTERN = new RegExp(`^${CONTAINER_PATH_MARKER}([^/]+)/(.+)`);
const ANDROID_MEDIA_RESCAN_INTENT = 'android.intent.action.MEDIA_SCANNER_SCAN_FILE';


const commands = {};

/**
 * Parses the actual destination path from the given value
 *
 * @param {string} remotePath The preformatted remote path, which looks like
 * `@my.app.id/my/path`
 * @returns {Array<string>} An array, where the first item is the parsed package
 * identifier and the second one is the actual destination path inside the package.
 * @throws {Error} If the given string cannot be parsed
 */
function parseContainerPath (remotePath) {
  const match = CONTAINER_PATH_PATTERN.exec(remotePath);
  if (!match) {
    log.errorAndThrow(`It is expected that package identifier is separated from the relative path with a single slash. ` +
                      `'${remotePath}' is given instead`);
  }
  return [match[1], path.posix.resolve(`/data/data/${match[1]}`, match[2])];
}

/**
 * A small helper, which escapes single quotes in paths,
 * so they are safe to be passed as arguments of shell commands
 *
 * @param {string} p The initial remote path
 * @returns {string} The escaped path value
 */
function escapePath (p) {
  return p.replace(/'/g, `\\'`);
}

/**
 * Pulls a remote file from the device.
 * It is required, that a package has debugging flag enabled
 * in order to access its files.
 *
 * @param {string} remotePath The full path to the remote file
 * or a specially formatted path, which points to an item inside app bundle
 * @returns {string} Base64 encoded content of the pulled file
 * @throws {Error} If the pull operation failed
 */
commands.pullFile = async function pullFile (remotePath) {
  if (remotePath.endsWith('/')) {
    log.errorAndThrow(`It is expected that remote path points to a file and not to a folder. ` +
                      `'${remotePath}' is given instead`);
  }
  let tmpDestination = null;
  if (remotePath.startsWith(CONTAINER_PATH_MARKER)) {
    const [packageId, pathInContainer] = parseContainerPath(remotePath);
    log.debug(`Parsed package identifier '${packageId}' from '${remotePath}'. Will get the data from '${pathInContainer}'`);
    tmpDestination = `/data/local/tmp/${path.posix.basename(pathInContainer)}`;
    try {
      await this.adb.shell(['run-as', packageId, `chmod 777 '${escapePath(pathInContainer)}'`]);
      await this.adb.shell([
        'run-as', packageId,
        `cp -f '${escapePath(pathInContainer)}' '${escapePath(tmpDestination)}'`
      ]);
    } catch (e) {
      log.errorAndThrow(`Cannot access the container of '${packageId}' application. ` +
                        `Is the application installed and has 'debuggable' build option set to true? ` +
                        `Original error: ${e.message}`);
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
};

/**
 * Pushed the given data to a file on the remote device
 * It is required, that a package has debugging flag enabled
 * in order to access its files.
 *
 * @param {string} remotePath The full path to the remote file or
 * a file inside a package bundle
 * @param {string} base64Data Base64 encoded data to be written to the
 * remote file. The remote file will be silently overridden if it already exists.
 * @throws {Error} If there was an error while pushing the data
 */
commands.pushFile = async function pushFile (remotePath, base64Data) {
  if (remotePath.endsWith('/')) {
    log.errorAndThrow(`It is expected that remote path points to a file and not to a folder. ` +
                      `'${remotePath}' is given instead`);
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
      log.debug(`Parsed package identifier '${packageId}' from '${remotePath}'. Will put the data into '${pathInContainer}'`);
      tmpDestination = `/data/local/tmp/${path.posix.basename(pathInContainer)}`;
      try {
        await this.adb.shell(
          ['run-as', packageId, `mkdir -p '${escapePath(path.posix.dirname(pathInContainer))}'`]
        );
        await this.adb.shell(['run-as', packageId, `touch '${escapePath(pathInContainer)}'`]);
        await this.adb.shell(['run-as', packageId, `chmod 777 '${escapePath(pathInContainer)}'`]);
        await this.adb.push(localFile, tmpDestination);
        await this.adb.shell([
          'run-as', packageId,
          `cp -f '${escapePath(tmpDestination)}' '${escapePath(pathInContainer)}'`
        ]);
      } catch (e) {
        log.errorAndThrow(`Cannot access the container of '${packageId}' application. ` +
                          `Is the application installed and has 'debuggable' build option set to true? ` +
                          `Original error: ${e.message}`);
      }
    } else {
      // adb push creates folders and overwrites existing files.
      await this.adb.push(localFile, remotePath);

      // if we have pushed a file, it might be a media file, so ensure that
      // apps know about it
      log.info('After pushing media file, broadcasting media scan intent');
      try {
        await this.adb.shell(['am', 'broadcast', '-a',
          ANDROID_MEDIA_RESCAN_INTENT, '-d', `file://${remotePath}`]);
      } catch (e) {
        log.warn(`Got error broadcasting media scan intent: ${e.message}; ignoring`);
      }
    }
  } finally {
    if (await fs.exists(localFile)) {
      await fs.unlink(localFile);
    }
    if (tmpDestination) {
      await this.adb.shell(['rm', '-f', tmpDestination]);
    }
  }
};

/**
 * Pulls the whole folder from the remote device
 *
 * @param {string} remotePath The full path to a folder on the
 * remote device or a folder inside an application bundle
 * @returns {string} Base64-encoded and zipped content of the folder
 * @throws {Error} If there was a failure while getting the folder content
 */
commands.pullFolder = async function pullFolder (remotePath) {
  let localFolder = await tempDir.path({prefix: 'appium'});
  await this.adb.pull(remotePath, localFolder);
  return (await zip.toInMemoryZip(localFolder, {
    encodeToBase64: true,
  })).toString();
};

/**
 * Deletes the given folder or file from the remote device
 *
 * @param {ADB} adb
 * @param {string} remotePath The full path to the remote folder
 * or file (folder names must end with a single slash)
 * @throws {Error} If the provided remote path is invalid or
 * the package content cannot be accessed
 * @returns {boolean} `true` if the remote item has been successfully deleted.
 * If the remote path is valid, but the remote path does not exist
 * this function return `false`.
 */
async function deleteFileOrFolder (adb, remotePath) {
  const performRemoteFsCheck = async (p, op, runAs = null) => {
    const passFlag = '__PASS__';
    const checkCmd = `[ -${op} '${escapePath(p)}' ] && echo ${passFlag}`;
    const fullCmd = runAs ? `run-as ${runAs} ${checkCmd}` : checkCmd;
    try {
      return _.includes(await adb.shell([fullCmd]), passFlag);
    } catch (ign) {
      return false;
    }
  };
  const isFile = async (p, runAs = null) => await performRemoteFsCheck(p, 'f', runAs);
  const isDir = async (p, runAs = null) => await performRemoteFsCheck(p, 'd', runAs);
  const isPresent = async (p, runAs = null) => await performRemoteFsCheck(p, 'e', runAs);

  let dstPath = remotePath;
  let pkgId = null;
  if (remotePath.startsWith(CONTAINER_PATH_MARKER)) {
    const [packageId, pathInContainer] = parseContainerPath(remotePath);
    log.debug(`Parsed package identifier '${packageId}' from '${remotePath}'`);
    dstPath = pathInContainer;
    pkgId = packageId;
  }

  if (pkgId) {
    try {
      await adb.shell(['run-as', pkgId, 'ls']);
    } catch (e) {
      log.errorAndThrow(`Cannot access the container of '${pkgId}' application. ` +
        `Is the application installed and has 'debuggable' build option set to true? ` +
        `Original error: ${e.message}`);
    }
  }

  if (!await isPresent(dstPath, pkgId)) {
    log.info(`The item at '${dstPath}' does not exist. Perhaps, already deleted?`);
    return false;
  }

  const expectsFile = !remotePath.endsWith('/');
  if (expectsFile && !await isFile(dstPath, pkgId)) {
    log.errorAndThrow(`The item at '${dstPath}' is not a file`);
  } else if (!expectsFile && !await isDir(dstPath, pkgId)) {
    log.errorAndThrow(`The item at '${dstPath}' is not a folder`);
  }

  if (pkgId) {
    await adb.shell(
      ['run-as', pkgId, `rm -f${expectsFile ? '' : 'r'} '${escapePath(dstPath)}'`]);
  } else {
    await adb.shell(['rm', `-f${expectsFile ? '' : 'r'}`, dstPath]);
  }
  if (await isPresent(dstPath, pkgId)) {
    log.errorAndThrow(`The item at '${dstPath}' still exists after being deleted. ` +
      `Is it writable?`);
  }
  return true;
}

/**
 * @typedef {Object} DeleteFileOpts
 * @property {!string} remotePath The full path to the remote file
 * or a file inside an application bundle (for example `@my.app.id/path/in/bundle`)
 */

/**
 * Deletes a file on the remote device
 *
 * @param {DeleteFileOpts} opts
 * @returns {boolean} `true` if the remote file has been successfully deleted.
 * If the path to a remote file is valid, but the file itself does not exist
 * then `false` is returned.
 * @throws {Error} If the argument is invalid or there was an error while
 * deleting the file
 */
commands.mobileDeleteFile = async function mobileDeleteFile (opts = {}) {
  const {remotePath} = opts;
  if (!remotePath) {
    log.errorAndThrow(`The 'remotePath' argument is mandatory`);
  }
  if (remotePath.endsWith('/')) {
    log.errorAndThrow(`It is expected that remote path points to a folder and not to a file. ` +
                      `'${remotePath}' is given instead`);
  }
  return await deleteFileOrFolder(this.adb, remotePath);
};

export { commands };
export default commands;
