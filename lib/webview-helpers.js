import _ from 'lodash';
import logger from './logger';
import request from 'request-promise';
import { util } from 'appium-support';
import { asyncfilter } from 'asyncbox';

const NATIVE_WIN = 'NATIVE_APP';
const WEBVIEW_WIN = 'WEBVIEW';
const WEBVIEW_BASE = `${WEBVIEW_WIN}_`;
const WEBVIEW_PID_REGEXP = new RegExp(`^${WEBVIEW_BASE}(\\d+)`);
const WEBVIEW_PKG_REGEXP = new RegExp(`^${WEBVIEW_BASE}([^\\d\\s][\\w.]*)`);
const CHROMIUM_WIN = 'CHROMIUM';
const DEFAULT_WEBVIEW_DEVTOOLS_PORT = 9222;
const DEVTOOLS_SOCKET_PATTERN = /@[\w.]+_devtools_remote_?(\d+)?\b/;
const CROSSWALK_SOCKET_PATTERN = /@([\w.]+)_devtools_remote\b/;
const CHROMIUM_DEVTOOLS_SOCKET = 'chrome_devtools_remote';
const CHROME_PACKAGE_NAME = 'com.android.chrome';


let helpers = {};

/**
 * This function gets a list of android system processes and returns ones
 * that look like webviews
 * See https://cs.chromium.org/chromium/src/chrome/browser/devtools/device/android_device_info_query.cc
 * for more details
 *
 * @param {object} adb - an ADB instance
 *
 * @return {Array.<string>} - a list of matching webview socket names (including the leading '@')
 */
async function getPotentialWebviewProcs (adb) {
  const out = await adb.shell(['cat', '/proc/net/unix']);
  const names = [];
  for (const line of out.split('\n')) {
    // Num RefCount Protocol Flags Type St Inode Path
    const [,,, flags,, st,, sockPath] = line.trim().split(/\s+/);
    if (!sockPath) {
      continue;
    }
    if (flags !== '00010000' || st !== '01') {
      continue;
    }
    if (!DEVTOOLS_SOCKET_PATTERN.test(sockPath)) {
      continue;
    }

    names.push(sockPath);
  }
  if (_.isEmpty(names)) {
    logger.debug('Found no active devtools sockets. Other sockets are:');
    logger.debug(out);
  } else {
    logger.debug(`Parsed ${names.length} active devtools ${util.pluralize('socket', names.length, false)}: ` +
      JSON.stringify(names));
  }
  // sometimes the webview process shows up multiple times per app
  return _.uniq(names);
}

/**
 * @typedef {Object} WebviewProc
 * @property {string} proc - The webview process name (as returned by
 * getPotentialWebviewProcs
 * @property {string} webview - The actual webview context name
 */
/**
 * This function retrieves a list of system processes that look like webviews,
 * and returns them along with the webview context name appropriate for it.
 * If we pass in a deviceSocket, we only attempt to find webviews which match
 * that socket name (this is for apps which embed Chromium, which isn't the
 * same as chrome-backed webviews).
 *
 * @param {object} adb - an ADB instance
 * @param {?string} deviceSocket - the explictly-named device socket to use
 *
 * @return {Array.<WebviewProc>}
 */
async function webviewsFromProcs (adb, deviceSocket = null) {
  const socketNames = await getPotentialWebviewProcs(adb);
  const webviews = [];
  for (const socketName of socketNames) {
    if (deviceSocket === CHROMIUM_DEVTOOLS_SOCKET && socketName === `@${deviceSocket}`) {
      webviews.push({
        proc: socketName,
        webview: CHROMIUM_WIN,
      });
      continue;
    }

    const socketNameMatch = DEVTOOLS_SOCKET_PATTERN.exec(socketName);
    if (!socketNameMatch) {
      continue;
    }
    const crosswalkMatch = CROSSWALK_SOCKET_PATTERN.exec(socketName);
    if (!socketNameMatch[1] && !crosswalkMatch) {
      continue;
    }

    if (deviceSocket && socketName === `@${deviceSocket}` || !deviceSocket) {
      webviews.push({
        proc: socketName,
        webview: socketNameMatch[1]
          ? `${WEBVIEW_BASE}${socketNameMatch[1]}`
          : `${WEBVIEW_BASE}${crosswalkMatch[1]}`,
      });
    }
  }
  return webviews;
}

/**
 * Given a 'webview-proc' object resulting from a call to webviewsFromProcs,
 * check whether we can detect any active pages corresponding to that webview.
 * This is used by getWebviews to filter out any webview-looking processes
 * which have a remote debug port open but which aren't actually running any
 * pages, because such processes can't be automated by chromedriver anyway.
 *
 * @param {object} adb - an ADB instance
 * @param {WebviewProc} wp - the webview to check
 * @param {number} webviewDevtoolsPort - the local port to use for the check
 *
 * @return {boolean} - whether or not the webview has pages
 */
async function webviewHasPages (adb, {proc, webview}, webviewDevtoolsPort) {
  const wvPort = webviewDevtoolsPort || DEFAULT_WEBVIEW_DEVTOOLS_PORT;

  // proc names come with '@', but this should not be a part of the abstract
  // remote port, so remove it
  const remotePort = proc.replace(/^@/, '');

  // we don't want to mess with things if our wvPort is already forwarded,
  // since who knows what is currently going on there. So determine if it is
  // already forwarded, and just short-circuit this whole method if so.
  const portAlreadyForwarded = (await adb.getForwardList())
    .map((line) => line.split(' ')[1]) // the local port is the second field in the line
    .reduce((acc, portSpec) => acc || portSpec === `tcp:${wvPort}`, false);
  if (portAlreadyForwarded) {
    logger.info(`Port ${wvPort} was already forwarded`);
  } else {
    // forward the specified local port to the remote debugger port on the device
    await adb.adbExec(['forward', `tcp:${wvPort}`, `localabstract:${remotePort}`]);
  }

  const remoteDebugger = `http://127.0.0.1:${wvPort}/json/list`;
  logger.debug(`Attempting to get list of pages for webview '${webview}' ` +
    `from the remote debugger at ${remoteDebugger}.`);
  let hasPages = false;
  try {
    // take advantage of the chrome remote debugger REST API just to get
    // a list of pages
    const pages = await request({
      uri: remoteDebugger,
      json: true
    });
    if (pages.length > 0) {
      hasPages = true;
    }
    logger.info(`Webview '${webview}' has ${util.pluralize('page', pages.length, true)}`);
  } catch (e) {
    logger.warn(`Got error when retrieving page list, will assume no pages: ${e}`);
  }
  if (!portAlreadyForwarded) {
    await adb.removePortForward(wvPort); // make sure we clean up
  }
  return hasPages;
}

/**
 * Take a webview name like WEBVIEW_4296 and use 'adb shell ps' to figure out
 * which app package is associated with that webview. One of the reasons we
 * want to do this is to make sure we're listing webviews for the actual AUT,
 * not some other running app
 *
 * @param {object} adb - an ADB instance
 * @param {string} webview - a webview process name
 *
 * @returns {string} - the package name of the app running the webview
 * @throws {Error} If there was a failure while retrieving the process name
 */
helpers.procFromWebview = async function procFromWebview (adb, webview) {
  const pidMatch = WEBVIEW_PID_REGEXP.exec(webview);
  if (!pidMatch) {
    throw new Error(`Could not find PID for webview '${webview}'`);
  }

  const pid = pidMatch[1];
  logger.debug(`${webview} mapped to pid ${pid}`);
  logger.debug(`Getting process name for webview '${webview}'`);
  const pkg = await adb.getNameByPid(pid);
  logger.debug(`Got process name: '${pkg}'`);
  return pkg;
};

/**
 * @typedef {Object} GetWebviewsOpts
 * @property {string} androidDeviceSocket - device socket name
 * @property {boolean} ensureWebviewsHavePages - whether to check for webview
 * page presence
 * @property {number} webviewDevtoolsPort - port to use for webview page
 * presence check (if not the default of 9222).
 */
/**
 * Get a list of available webviews by introspecting processes with adb, where
 * webviews are listed. It's possible to pass in a 'deviceSocket' arg, which
 * limits the webview possibilities to the one running on the Chromium devtools
 * socket we're interested in (see note on webviewsFromProcs). We can also
 * direct this method to verify whether a particular webview process actually
 * has any pages (if a process exists but no pages are found, Chromedriver will
 * not actually be able to connect to it, so this serves as a guard for that
 * strange failure mode). The strategy for checking whether any pages are
 * active involves sending a request to the remote debug server on the device,
 * hence it is also possible to specify the port on the host machine which
 * should be used for this communication.
 *
 * @param {object} adb - an ADB instance
 * @param {GetWebviewOpts} opts
 *
 * @return {Array.<string>} - a list of webview names
 */
helpers.getWebviews = async function getWebviews (adb, {
  androidDeviceSocket = null,
  ensureWebviewsHavePages = null,
  webviewDevtoolsPort = null
} = {}) {
  logger.debug('Getting a list of available webviews');
  let webviewsMapping = await webviewsFromProcs(adb, androidDeviceSocket);
  if (ensureWebviewsHavePages) {
    logger.info('Retrieved potential webviews; will filter out ones with no active pages');
    webviewsMapping = await asyncfilter(webviewsMapping,
      async (wp) => await webviewHasPages(adb, wp, webviewDevtoolsPort),
      false /*ensure serial operation*/);
  } else {
    logger.info('Not checking whether webviews have active pages; use the ' +
                "'ensureWebviewsHavePages' cap to turn this check on");
  }

  // webviewProcs contains procs, which we only care about for ensuring
  // presence of pages above, so we can now discard them and rely on just the
  // webview names
  const webviews = webviewsMapping.map((wp) => wp.webview);
  const result = [];
  if (androidDeviceSocket) {
    result.push(...webviews);
  } else {
    for (const webviewName of webviews) {
      try {
        // web view name could either be suffixed with PID or the package name
        // package names could not start with a digit
        const pkgMatch = WEBVIEW_PKG_REGEXP.exec(webviewName);
        const pkg = pkgMatch ? pkgMatch[1] : await helpers.procFromWebview(adb, webviewName);
        result.push(`${WEBVIEW_BASE}${pkg}`);
      } catch (e) {
        logger.warn(e.message);
      }
    }
  }
  logger.debug(`Found ${util.pluralize('webview', result.length, true)}: ${JSON.stringify(result)}`);
  return result;
};

/**
 * Create Chrome driver capabilities based on the provided
 * Appium capabilities
 *
 * @param {Object} opts User-provided capabilities object
 * @param {string} deviceId The identifier of the Android device under test
 * @returns {Object} The capabilities object.
 * See https://chromedriver.chromium.org/capabilities for more details.
 */
helpers.createChromedriverCaps = function createChromedriverCaps (opts, deviceId) {
  const caps = {
    chromeOptions: {
      androidPackage: opts.chromeOptions?.androidPackage || opts.appPackage,
    }
  };
  if (_.isBoolean(opts.chromeUseRunningApp)) {
    caps.chromeOptions.androidUseRunningApp = opts.chromeUseRunningApp;
  }
  if (opts.chromeAndroidPackage) {
    caps.chromeOptions.androidPackage = opts.chromeAndroidPackage;
  }
  if (opts.chromeAndroidActivity) {
    caps.chromeOptions.androidActivity = opts.chromeAndroidActivity;
  }
  if (opts.chromeAndroidProcess) {
    caps.chromeOptions.androidProcess = opts.chromeAndroidProcess;
  }
  if (_.toLower(opts.browserName) === 'chromium-webview') {
    logger.info(`Automatically setting 'androidActivity' capability ` +
      `to '${opts.appActivity}' for '${opts.browserName}' browser`);
    caps.chromeOptions.androidActivity = opts.appActivity;
  }
  if (opts.pageLoadStrategy) {
    caps.pageLoadStrategy = opts.pageLoadStrategy;
  }
  if (_.toLower(caps.chromeOptions.androidPackage) === 'chrome') {
    // if we have extracted package from context name, it could come in as bare
    // "chrome", and so we should make sure the details are correct, including
    // not using an activity or process id
    logger.info(`'androidPackage' Chromedriver capability has been ` +
      `automatically corrected to '${CHROME_PACKAGE_NAME}'`);
    caps.chromeOptions.androidPackage = CHROME_PACKAGE_NAME;
    delete caps.chromeOptions.androidActivity;
    delete caps.chromeOptions.androidProcess;
  }
  // add device id from adb
  caps.chromeOptions.androidDeviceSerial = deviceId;

  if (opts.loggingPrefs) {
    caps.loggingPrefs = opts.loggingPrefs;
  }
  if (opts.enablePerformanceLogging) {
    logger.warn(`The 'enablePerformanceLogging' cap is deprecated; simply use ` +
      `the 'loggingPrefs' cap instead, with a 'performance' key set to 'ALL'`);
    const newPref = {performance: 'ALL'};
    // don't overwrite other logging prefs that have been sent in if they exist
    caps.loggingPrefs = caps.loggingPrefs ?
      Object.assign({}, caps.loggingPrefs, newPref) :
      newPref;
  }

  if (opts.chromeOptions?.Arguments) {
    // merge `Arguments` and `args`
    opts.chromeOptions.args = [...(opts.chromeOptions.args || []), ...opts.chromeOptions.Arguments];
    delete opts.chromeOptions.Arguments;
  }
  for (const [opt, val] of _.toPairs(opts.chromeOptions)) {
    if (_.isUndefined(caps.chromeOptions[opt])) {
      caps.chromeOptions[opt] = val;
    } else {
      logger.info(`The '${opt}' chromeOption (${caps.chromeOptions[opt]}) ` +
        `won't be applied to Chromedriver capabilities because it has been already assigned before`);
    }
  }
  return caps;
};

export default helpers;
export { helpers, NATIVE_WIN, WEBVIEW_WIN, WEBVIEW_BASE, CHROMIUM_WIN };
