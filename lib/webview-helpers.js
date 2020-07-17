import _ from 'lodash';
import logger from './logger';
import axios from 'axios';
import { util } from 'appium-support';
import { findAPortNotInUse } from 'portscanner';
import AsyncLock from 'async-lock';
import LRU from 'lru-cache';
import B from 'bluebird';

const NATIVE_WIN = 'NATIVE_APP';
const WEBVIEW_WIN = 'WEBVIEW';
const CHROMIUM_WIN = 'CHROMIUM';
const WEBVIEW_BASE = `${WEBVIEW_WIN}_`;
const WEBVIEW_PID_PATTERN = new RegExp(`^${WEBVIEW_BASE}(\\d+)`);
const WEBVIEW_PKG_PATTERN = new RegExp(`^${WEBVIEW_BASE}([^\\d\\s][\\w.]*)`);
const DEVTOOLS_SOCKET_PATTERN = /@[\w.]+_devtools_remote_?(\d+)?\b/;
const CROSSWALK_SOCKET_PATTERN = /@([\w.]+)_devtools_remote\b/;
const CHROMIUM_DEVTOOLS_SOCKET = 'chrome_devtools_remote';
const CHROME_PACKAGE_NAME = 'com.android.chrome';
const DEVTOOLS_PORTS_RANGE = [10900, 11000];
const PORT_ALLOCATION_GUARD = new AsyncLock();
const WEBVIEWS_DETAILS_CACHE = new LRU({
  max: 100,
  updateAgeOnGet: true,
});
const CDP_REQ_TIMEOUT = 2000; // ms

const helpers = {};

function toDetailsCacheKey (adb, webview) {
  return `${adb?.curDeviceId}:${webview}`;
}

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
  const allMatches = [];
  for (const line of out.split('\n')) {
    // Num RefCount Protocol Flags Type St Inode Path
    const [,,, flags,, st,, sockPath] = line.trim().split(/\s+/);
    if (!sockPath) {
      continue;
    }
    if (sockPath.startsWith('@')) {
      allMatches.push(line.trim());
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
    logger.debug('Found no active devtools sockets');
    if (!_.isEmpty(allMatches)) {
      logger.debug(`Other sockets are: ${JSON.stringify(allMatches, null, 2)}`);
    }
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
 * Allocates a local port for devtools communication
 *
 * @param {ADB} adb ADB instance
 * @param {string} socketName The remote Unix socket name
 * @param {?string|number} webviewDevtoolsPort The local port number or null to apply
 * autodetection
 * @returns {number} The local port number if the remote socket has been forwarded
 * successfully or `null` otherwise
 * @throws {Error} If there was an error while allocating the local port
 */
async function allocateDevtoolsPort (adb, socketName, webviewDevtoolsPort = null) {
  return await PORT_ALLOCATION_GUARD.acquire('DevtoolsPortAllocator', async () => {
    const startPort = webviewDevtoolsPort || DEVTOOLS_PORTS_RANGE[0];
    const endPort = startPort + DEVTOOLS_PORTS_RANGE[1] - DEVTOOLS_PORTS_RANGE[0];
    let localPort;
    try {
      localPort = await findAPortNotInUse(startPort, endPort);
    } catch (e) {
      throw new Error(`Cannot find any free port to forward the devtools socket ` +
        `in range ${startPort}..${endPort}}. You can set the starting port number ` +
        `manually by providing the 'webviewDevtoolsPort' capability`);
    }
    // socket names come with '@', but this should not be a part of the abstract
    // remote port, so remove it
    const remotePort = socketName.replace(/^@/, '');
    await adb.adbExec(['forward', `tcp:${localPort}`, `localabstract:${remotePort}`]);
    return localPort;
  });
}

/**
 * @typedef {Object} WebviewProps
 * @property {string} proc The name of the Devtools Unix socket
 * @property {string} webview The web view alias. Looks like `WEBVIEW_`
 * prefix plus PID or package name
 * @property {?Object} info Webview information as it is retrieved by
 * /json/version CDP endpoint
 * @property {?Array<Object>} pages Webview pages list as it is retrieved by
 * /json/list CDP endpoint
 */

/**
 * @typedef {Object} DetailCollectionOptions
 * @property {?string|number} webviewDevtoolsPort The starting port to use for webview page
 * presence check (if not the default of 9222).
 * @property {?boolean} ensureWebviewsHavePages Whether to check for webview
 * pages presence
 * @property {boolean} enableWebviewDetailsCollection Whether to collect
 * web view details and send them to Chromedriver constructor, so it could
 * select a binary more precisely based on this info.
 */

/**
 * This is a wrapper for Chrome Debugger Protocol data collection.
 * No error is thrown if CDP request fails - in such case no data will be
 * recorded into the corresponding `webviewsMapping` item.
 *
 * @param {ADB} adb The ADB instance
 * @param {Array<WebviewProps>} webviewsMapping The current webviews mapping
 * !!! Each item of this array gets mutated (`info`/`pages` properties get added
 * based on the provided `opts`) if the requested details have been
 * successfully retrieved for it !!!
 * @param {DetailCollectionOptions} opts If both `ensureWebviewsHavePages` and
 * `enableWebviewDetailsCollection` properties are falsy then no details collection
 * is performed
 */
async function collectWebviewsDetails (adb, webviewsMapping, opts = {}) {
  if (_.isEmpty(webviewsMapping)) {
    return;
  }

  const {
    webviewDevtoolsPort = null,
    ensureWebviewsHavePages = null,
    enableWebviewDetailsCollection = null,
  } = opts;

  if (!ensureWebviewsHavePages) {
    logger.info(`Not checking whether webviews have active pages; use the ` +
      `'ensureWebviewsHavePages' cap to turn this check on`);
  }

  if (!enableWebviewDetailsCollection) {
    logger.info(`Not collecting web view details. Details collection might help ` +
      `to make Chromedriver initialization more precise. Use the 'enableWebviewDetailsCollection' ` +
      `cap to turn it on`);
  }

  if (!ensureWebviewsHavePages && !enableWebviewDetailsCollection) {
    return;
  }

  // Connect to each devtools socket and retrieve web view details
  logger.debug(`Collecting CDP data of ${util.pluralize('webview', webviewsMapping.length, true)}`);
  const detailCollectors = [];
  for (const item of webviewsMapping) {
    detailCollectors.push((async () => {
      let localPort;
      try {
        localPort = await allocateDevtoolsPort(adb, item.proc, webviewDevtoolsPort);
        if (enableWebviewDetailsCollection) {
          item.info = await cdpInfo(localPort);
        }
        if (ensureWebviewsHavePages) {
          item.pages = await cdpList(localPort);
        }
      } catch (e) {
        logger.debug(e);
      } finally {
        if (localPort) {
          await adb.removePortForward(localPort);
        }
      }
    })());
  }
  await B.all(detailCollectors);
  logger.debug(`CDP data collection completed`);
}

// https://chromedevtools.github.io/devtools-protocol/
async function cdpList (localPort) {
  return (await axios({
    url: `http://127.0.0.1:${localPort}/json/list`,
    timeout: CDP_REQ_TIMEOUT,
  })).data;
}

// https://chromedevtools.github.io/devtools-protocol/
async function cdpInfo (localPort) {
  return (await axios({
    url: `http://127.0.0.1:${localPort}/json/version`,
    timeout: CDP_REQ_TIMEOUT,
  })).data;
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
  const pidMatch = WEBVIEW_PID_PATTERN.exec(webview);
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
 * @property {string} androidDeviceSocket [null] - device socket name
 * @property {boolean} ensureWebviewsHavePages [true] - whether to check for webview
 * page presence
 * @property {number} webviewDevtoolsPort [9222] - port to use for webview page
 * presence check.
 * @property {boolean} enableWebviewDetailsCollection [false] - whether to collect
 * web view details and send them to Chromedriver constructor, so it could
 * select a binary more precisely based on this info.
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
  ensureWebviewsHavePages = true,
  webviewDevtoolsPort = null,
  enableWebviewDetailsCollection = null,
} = {}) {
  logger.debug('Getting a list of available webviews');
  const webviewsMapping = await webviewsFromProcs(adb, androidDeviceSocket);

  await collectWebviewsDetails(adb, webviewsMapping, {
    ensureWebviewsHavePages,
    enableWebviewDetailsCollection,
    webviewDevtoolsPort,
  });

  // webviewProcs contains procs, which we only care about for ensuring
  // presence of pages above, so we can now discard them and rely on just the
  // webview names
  const result = [];
  for (const {webview, pages, info, proc} of webviewsMapping) {
    if (ensureWebviewsHavePages && pages?.length === 0) {
      logger.info(`Skipping the webview '${webview}' at '${proc}' ` +
        `since it has reported having zero pages`);
      continue;
    }

    let wvName = webview;
    if (!androidDeviceSocket) {
      const pkgMatch = WEBVIEW_PKG_PATTERN.exec(webview);
      try {
        // web view name could either be suffixed with PID or the package name
        // package names could not start with a digit
        const pkg = pkgMatch ? pkgMatch[1] : await helpers.procFromWebview(adb, webview);
        wvName = `${WEBVIEW_BASE}${pkg}`;
      } catch (e) {
        logger.warn(e.message);
        continue;
      }
    }

    result.push(wvName);
    const key = toDetailsCacheKey(adb, wvName);
    if (info) {
      WEBVIEWS_DETAILS_CACHE.set(key, { info });
    } else if (WEBVIEWS_DETAILS_CACHE.has(key)) {
      WEBVIEWS_DETAILS_CACHE.del(key);
    }
  }
  logger.debug(`Found ${util.pluralize('webview', result.length, true)}: ${JSON.stringify(result)}`);
  return result;
};

/**
 * @typedef {Object} WebViewDetails
 * @property {Object} info - Web view details as returned by /json/version CDP endpoint, for example:
 * {
 *  "Browser": "Chrome/72.0.3601.0",
 *  "Protocol-Version": "1.3",
 *  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3601.0 Safari/537.36",
 *  "V8-Version": "7.2.233",
 *  "WebKit-Version": "537.36 (@cfede9db1d154de0468cb0538479f34c0755a0f4)",
 *  "webSocketDebuggerUrl": "ws://localhost:9222/devtools/browser/b0b8a4fb-bb17-4359-9533-a8d9f3908bd8"
 * }
 */

/**
 * Retrieves web view details previously cached by `getWebviews` call
 *
 * @param {ADB} adb ADB instance
 * @param {string} webview The name of the web view
 * @returns {?WebViewDetails} Either `undefined` or the recent web view details
 */
helpers.getWebviewDetails = function getWebviewDetails (adb, webview) {
  const key = toDetailsCacheKey(adb, webview);
  return WEBVIEWS_DETAILS_CACHE.get(key);
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
    caps.chromeOptions.androidActivity = opts.appActivity;
  }
  if (opts.pageLoadStrategy) {
    caps.pageLoadStrategy = opts.pageLoadStrategy;
  }
  if (_.toLower(caps.chromeOptions.androidPackage) === 'chrome') {
    // if we have extracted package from context name, it could come in as bare
    // "chrome", and so we should make sure the details are correct, including
    // not using an activity or process id
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

  logger.debug('Precalculated Chromedriver capabilities: ' +
    JSON.stringify(caps.chromeOptions, null, 2));

  const protectedCapNames = [];
  for (const [opt, val] of _.toPairs(opts.chromeOptions)) {
    if (_.isUndefined(caps.chromeOptions[opt])) {
      caps.chromeOptions[opt] = val;
    } else {
      protectedCapNames.push(opt);
    }
  }
  if (!_.isEmpty(protectedCapNames)) {
    logger.info('The following Chromedriver capabilities cannot be overridden ' +
      'by the provided chromeOptions:');
    for (const optName of protectedCapNames) {
      logger.info(`  ${optName} (${JSON.stringify(opts.chromeOptions[optName])})`);
    }
  }

  return caps;
};

export default helpers;
export { helpers, NATIVE_WIN, WEBVIEW_WIN, WEBVIEW_BASE, CHROMIUM_WIN };
