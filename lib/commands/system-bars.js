import _ from 'lodash';

const WINDOW_TITLE_PATTERN = /^\s+Window\s#\d+\sWindow\{[0-9a-f]+\s\w+\s([\w-]+)\}:$/;
const FRAME_PATTERN = /\bm?[Ff]rame=\[([0-9.-]+),([0-9.-]+)\]\[([0-9.-]+),([0-9.-]+)\]/;
const VIEW_VISIBILITY_PATTERN = /\bmViewVisibility=(0x[0-9a-fA-F]+)/;
// https://developer.android.com/reference/android/view/View#VISIBLE
const VIEW_VISIBLE = 0x0;
const STATUS_BAR_WINDOW_NAME_PREFIX = 'StatusBar';
const NAVIGATION_BAR_WINDOW_NAME_PREFIX = 'NavigationBar';
const DEFAULT_WINDOW_PROPERTIES = {
  visible: false,
  x: 0, y: 0, width: 0, height: 0,
};

const commands = {};

/**
 * @typedef {Object} WindowProperties
 * @property {boolean} visible Whether the window is visible
 * @property {number} x Window x coordinate
 * @property {number} y Window y coordinate
 * @property {number} width Window width
 * @property {number} height Window height
 */

/**
 * Parses window properties from adb dumpsys output
 *
 * @param {string} name The name of the window whose properties are being parsed
 * @param {Array<string>} props The list of particular window property lines.
 * Check the corresponding unit tests for more details on the input format.
 * @param {Object?} log Logger instance
 * @returns {WindowProperties} Parsed properties object
 * @throws {Error} If there was an issue while parsing the properties string
 */
function parseWindowProperties (name, props, log = null) {
  const result = _.cloneDeep(DEFAULT_WINDOW_PROPERTIES);
  const propLines = props.join('\n');
  const frameMatch = FRAME_PATTERN.exec(propLines);
  if (!frameMatch) {
    log?.debug(propLines);
    throw new Error(`Cannot parse the frame size from '${name}' window properties`);
  }
  result.x = parseFloat(frameMatch[1]);
  result.y = parseFloat(frameMatch[2]);
  result.width = parseFloat(frameMatch[3]) - result.x;
  result.height = parseFloat(frameMatch[4]) - result.y;
  const visibilityMatch = VIEW_VISIBILITY_PATTERN.exec(propLines);
  if (!visibilityMatch) {
    log?.debug(propLines);
    throw new Error(`Cannot parse the visibility value from '${name}' window properties`);
  }
  result.visible = parseInt(visibilityMatch[1], 16) === VIEW_VISIBLE;
  return result;
}

/**
 * Extracts status and navigation bar information from the window manager output.
 *
 * @param {Array<string>} lines Output from dumpsys command.
 * Check the corresponding unit tests for more details on the input format.
 * @param {Object?} log Logger instance
 * @return {Object} An object containing two items where keys are statusBar and navigationBar,
 * and values are corresponding WindowProperties objects
 * @throws {Error} If no window properties could be parsed
 */
function parseWindows (lines, log = null) {
  const windows = {};
  let currentWindowName = null;
  for (const line of lines.split('\n').map(_.trimEnd)) {
    const match = WINDOW_TITLE_PATTERN.exec(line);
    if (match) {
      currentWindowName = match[1];
      windows[currentWindowName] = [];
      continue;
    }
    if (_.trim(line).length === 0) {
      currentWindowName = null;
      continue;
    }

    if (currentWindowName && _.isArray(windows[currentWindowName])) {
      windows[currentWindowName].push(line);
    }
  }
  if (_.isEmpty(windows)) {
    log?.debug(lines.join('\n'));
    throw new Error('Cannot parse any window information from the dumpsys output');
  }

  const result = {statusBar: null, navigationBar: null};
  for (const [name, props] of _.toPairs(windows)) {
    if (name.startsWith(STATUS_BAR_WINDOW_NAME_PREFIX)) {
      result.statusBar = parseWindowProperties(name, props, log);
    } else if (name.startsWith(NAVIGATION_BAR_WINDOW_NAME_PREFIX)) {
      result.navigationBar = parseWindowProperties(name, props, log);
    }
  }
  const unmatchedWindows = [
    ['statusBar', STATUS_BAR_WINDOW_NAME_PREFIX],
    ['navigationBar', NAVIGATION_BAR_WINDOW_NAME_PREFIX]
  ].filter(([name]) => _.isNil(result[name]));
  for (const [window, namePrefix] of unmatchedWindows) {
    log?.info(`No windows have been found whose title matches to ` +
      `'${namePrefix}'. Assuming it is invisible. ` +
      `Only the following windows are available: ${_.keys(windows)}`);
    result[window] = _.cloneDeep(DEFAULT_WINDOW_PROPERTIES);
  }
  return result;
}

commands.getSystemBars = async function getSystemBars () {
  let stdout;
  try {
    stdout = await this.adb.shell(['dumpsys', 'window', 'windows']);
  } catch (e) {
    throw new Error(`Cannot retrieve system bars details. Original error: ${e.message}`);
  }
  return parseWindows(stdout, this.log);
};

// for unit tests
export { parseWindows, parseWindowProperties };
export default commands;
