import {fs} from '@appium/support';

/**
 * @param {string} message
 */
export function ok(message) {
  return {ok: true, optional: false, message};
}

/**
 * @param {string} message
 */
export function nok(message) {
  return {ok: false, optional: false, message};
}

/**
 * @param {string} message
 */
export function okOptional(message) {
  return {ok: true, optional: true, message};
}

/**
 * @param {string} message
 */
export function nokOptional(message) {
  return {ok: false, optional: true, message};
}

/**
 * Return an executable path of cmd
 *
 * @param {string} cmd Standard output by command
 * @return {Promise<string?>} The full path of cmd. `null` if the cmd is not found.
 */
export async function resolveExecutablePath(cmd) {
  try {
    const executablePath = await fs.which(cmd);
    if (executablePath && (await fs.exists(executablePath))) {
      return executablePath;
    }
  } catch (err) {}
  return null;
}
