import {util, timing} from '@appium/support';
import _ from 'lodash';
import axios from 'axios';
import net from 'node:net';
import {findAPortNotInUse} from 'portscanner';
import {sleep} from 'asyncbox';
import B from 'bluebird';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import Chromedriver from 'appium-chromedriver';
import {toDetailsCacheKey, getWebviewDetails, WEBVIEWS_DETAILS_CACHE} from './cache';

// https://cs.chromium.org/chromium/src/chrome/browser/devtools/device/android_device_info_query.cc
export const CHROME_BROWSER_PACKAGE_ACTIVITY = /** @type {const} */ ({
  chrome: {
    pkg: 'com.android.chrome',
    activity: 'com.google.android.apps.chrome.Main',
  },
  chromium: {
    pkg: 'org.chromium.chrome.shell',
    activity: '.ChromeShellActivity',
  },
  chromebeta: {
    pkg: 'com.chrome.beta',
    activity: 'com.google.android.apps.chrome.Main',
  },
  browser: {
    pkg: 'com.android.browser',
    activity: 'com.android.browser.BrowserActivity',
  },
  'chromium-browser': {
    pkg: 'org.chromium.chrome',
    activity: 'com.google.android.apps.chrome.Main',
  },
  'chromium-webview': {
    pkg: 'org.chromium.webview_shell',
    activity: 'org.chromium.webview_shell.WebViewBrowserActivity',
  },
  default: {
    pkg: 'com.android.chrome',
    activity: 'com.google.android.apps.chrome.Main',
  },
});
export const CHROME_PACKAGE_NAME = 'com.android.chrome';
export const KNOWN_CHROME_PACKAGE_NAMES = [
  CHROME_PACKAGE_NAME,
  'com.chrome.beta',
  'com.chrome.dev',
  'com.chrome.canary',
];
const CHROMEDRIVER_AUTODOWNLOAD_FEATURE = 'chromedriver_autodownload';
const CROSSWALK_SOCKET_PATTERN = /@([\w.]+)_devtools_remote\b/;
const CHROMIUM_DEVTOOLS_SOCKET = 'chrome_devtools_remote';
export const NATIVE_WIN = 'NATIVE_APP';
export const WEBVIEW_WIN = 'WEBVIEW';
export const CHROMIUM_WIN = 'CHROMIUM';
export const WEBVIEW_BASE = `${WEBVIEW_WIN}_`;
export const DEVTOOLS_SOCKET_PATTERN = /@[\w.]+_devtools_remote_?([\w.]+_)?(\d+)?\b/;
const WEBVIEW_PID_PATTERN = new RegExp(`^${WEBVIEW_BASE}(\\d+)`);
const WEBVIEW_PKG_PATTERN = new RegExp(`^${WEBVIEW_BASE}([^\\d\\s][\\w.]*)`);
const WEBVIEW_WAIT_INTERVAL_MS = 200;
const CDP_REQ_TIMEOUT = 2000; // ms
const DEVTOOLS_PORTS_RANGE = [10900, 11000];
const DEVTOOLS_PORT_ALLOCATION_GUARD = util.getLockFileGuard(
  path.resolve(os.tmpdir(), 'android_devtools_port_guard'),
  {timeout: 7, tryRecovery: true},
);

/**
 * @returns {Promise<number>}
 */
async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const address = srv.address();
      let port;
      if (_.has(address, 'port')) {
        // @ts-ignore The above condition covers possible errors
        port = address.port;
      } else {
        reject(new Error('Cannot determine any free port number'));
      }
      srv.close(() => resolve(port));
    });
  });
}

/**
 * https://chromedevtools.github.io/devtools-protocol/
 *
 * @param {string} host
 * @param {number} port
 * @param {string} endpoint
 * @returns {Promise<object[]>}
 */
async function cdpGetRequest(host, port, endpoint) {
  return (
    await axios({
      url: `http://${host}:${port}${endpoint}`,
      timeout: CDP_REQ_TIMEOUT,
      // We need to set this from Node.js v19 onwards.
      // Otherwise, in situation with multiple webviews,
      // the preceding webview pages will be incorrectly retrieved as the current ones.
      // https://nodejs.org/en/blog/announcements/v19-release-announce#https11-keepalive-by-default
      httpAgent: new http.Agent({keepAlive: false}),
    })
  ).data;
}

/**
 * @param {string} host
 * @param {number} port
 * @returns {Promise<object[]>}
 */
async function cdpList(host, port) {
  return cdpGetRequest(host, port, '/json/list');
}

/**
 * @param {string} host
 * @param {number} port
 * @returns {Promise<object[]>}
 */
async function cdpInfo(host, port) {
  return cdpGetRequest(host, port, '/json/version');
}

/**
 *
 * @param {string} browser
 * @returns {import('type-fest').ValueOf<typeof CHROME_BROWSER_PACKAGE_ACTIVITY>}
 */
export function getChromePkg(browser) {
  return (
    CHROME_BROWSER_PACKAGE_ACTIVITY[browser.toLowerCase()] ||
    CHROME_BROWSER_PACKAGE_ACTIVITY.default
  );
}

/**
 * Create Chromedriver capabilities based on the provided
 * Appium capabilities
 *
 * @this {import('../../driver').AndroidDriver}
 * @param {any} opts
 * @param {string} deviceId
 * @param {import('../types').WebViewDetails | null} [webViewDetails]
 * @returns {import('@appium/types').StringRecord}
 */
function createChromedriverCaps(opts, deviceId, webViewDetails) {
  const caps = {chromeOptions: {}};

  const androidPackage =
    opts.chromeOptions?.androidPackage ||
    opts.appPackage ||
    webViewDetails?.info?.['Android-Package'];
  if (androidPackage) {
    // chromedriver raises an invalid argument error when androidPackage is 'null'

    caps.chromeOptions.androidPackage = androidPackage;
  }
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
  } else if (webViewDetails?.process?.name && webViewDetails?.process?.id) {
    caps.chromeOptions.androidProcess = webViewDetails.process.name;
  }
  if (_.toLower(opts.browserName) === 'chromium-webview') {
    caps.chromeOptions.androidActivity = opts.appActivity;
  }
  if (opts.pageLoadStrategy) {
    caps.pageLoadStrategy = opts.pageLoadStrategy;
  }
  const isChrome = _.toLower(caps.chromeOptions.androidPackage) === 'chrome';
  if (_.includes(KNOWN_CHROME_PACKAGE_NAMES, caps.chromeOptions.androidPackage) || isChrome) {
    // if we have extracted package from context name, it could come in as bare
    // "chrome", and so we should make sure the details are correct, including
    // not using an activity or process id
    if (isChrome) {
      caps.chromeOptions.androidPackage = CHROME_PACKAGE_NAME;
    }
    delete caps.chromeOptions.androidActivity;
    delete caps.chromeOptions.androidProcess;
  }
  // add device id from adb
  caps.chromeOptions.androidDeviceSerial = deviceId;

  if (_.isPlainObject(opts.loggingPrefs) || _.isPlainObject(opts.chromeLoggingPrefs)) {
    if (opts.loggingPrefs) {
      this.log.warn(
        `The 'loggingPrefs' cap is deprecated; use the 'chromeLoggingPrefs' cap instead`,
      );
    }
    caps.loggingPrefs = opts.chromeLoggingPrefs || opts.loggingPrefs;
  }
  if (opts.enablePerformanceLogging) {
    this.log.warn(
      `The 'enablePerformanceLogging' cap is deprecated; simply use ` +
        `the 'chromeLoggingPrefs' cap instead, with a 'performance' key set to 'ALL'`,
    );
    const newPref = {performance: 'ALL'};
    // don't overwrite other logging prefs that have been sent in if they exist
    caps.loggingPrefs = caps.loggingPrefs ? Object.assign({}, caps.loggingPrefs, newPref) : newPref;
  }

  if (opts.chromeOptions?.Arguments) {
    // merge `Arguments` and `args`
    opts.chromeOptions.args = [...(opts.chromeOptions.args || []), ...opts.chromeOptions.Arguments];
    delete opts.chromeOptions.Arguments;
  }

  this.log.debug(
    'Precalculated Chromedriver capabilities: ' + JSON.stringify(caps.chromeOptions, null, 2),
  );

  /** @type {string[]} */
  const protectedCapNames = [];
  for (const [opt, val] of _.toPairs(opts.chromeOptions)) {
    if (_.isUndefined(caps.chromeOptions[opt])) {
      caps.chromeOptions[opt] = val;
    } else {
      protectedCapNames.push(opt);
    }
  }
  if (!_.isEmpty(protectedCapNames)) {
    this.log.info(
      'The following Chromedriver capabilities cannot be overridden ' +
        'by the provided chromeOptions:',
    );
    for (const optName of protectedCapNames) {
      this.log.info(`  ${optName} (${JSON.stringify(opts.chromeOptions[optName])})`);
    }
  }

  return caps;
}

/**
 * Parse webview names for getContexts
 *
 * @this {import('../../driver').AndroidDriver}
 * @param {import('../types').WebviewsMapping[]} webviewsMapping
 * @param {import('../types').GetWebviewsOpts} options
 * @returns {string[]}
 */
export function parseWebviewNames(
  webviewsMapping,
  {ensureWebviewsHavePages = true, isChromeSession = false} = {},
) {
  if (isChromeSession) {
    return [CHROMIUM_WIN];
  }

  /** @type {string[]} */
  const result = [];
  for (const {webview, pages, proc, webviewName} of webviewsMapping) {
    if (ensureWebviewsHavePages && !pages?.length) {
      this.log.info(
        `Skipping the webview '${webview}' at '${proc}' ` +
          `since it has reported having zero pages`,
      );
      continue;
    }
    if (webviewName) {
      result.push(webviewName);
    }
  }
  this.log.debug(
    `Found ${util.pluralize('webview', result.length, true)}: ${JSON.stringify(result)}`,
  );
  return result;
}

/**
 * Allocates a local port for devtools communication
 *
 * @this {import('../../driver').AndroidDriver}
 * @param {string} socketName - The remote Unix socket name
 * @param {number?} [webviewDevtoolsPort=null] - The local port number or null to apply
 * autodetection
 * @returns {Promise<[string, number]>} The host name and the port number to connect to if the
 * remote socket has been forwarded successfully
 * @throws {Error} If there was an error while allocating the local port
 */
async function allocateDevtoolsChannel(socketName, webviewDevtoolsPort = null) {
  // socket names come with '@', but this should not be a part of the abstract
  // remote port, so remove it
  const remotePort = socketName.replace(/^@/, '');
  let [startPort, endPort] = DEVTOOLS_PORTS_RANGE;
  if (webviewDevtoolsPort) {
    endPort = webviewDevtoolsPort + (endPort - startPort);
    startPort = webviewDevtoolsPort;
  }
  this.log.debug(
    `Forwarding remote port ${remotePort} to a local ` + `port in range ${startPort}..${endPort}`,
  );
  if (!webviewDevtoolsPort) {
    this.log.debug(
      `You could use the 'webviewDevtoolsPort' capability to customize ` +
        `the starting port number`,
    );
  }
  const port = await DEVTOOLS_PORT_ALLOCATION_GUARD(async () => {
    let localPort;
    try {
      localPort = await findAPortNotInUse(startPort, endPort);
    } catch (e) {
      throw new Error(
        `Cannot find any free port to forward the Devtools socket ` +
          `in range ${startPort}..${endPort}. You could set the starting port number ` +
          `manually by providing the 'webviewDevtoolsPort' capability`,
      );
    }
    await this.adb.adbExec(['forward', `tcp:${localPort}`, `localabstract:${remotePort}`]);
    return localPort;
  });
  return [this.adb.adbHost ?? '127.0.0.1', port];
}

/**
 * This is a wrapper for Chrome Debugger Protocol data collection.
 * No error is thrown if CDP request fails - in such case no data will be
 * recorded into the corresponding `webviewsMapping` item.
 *
 * @this {import('../../driver').AndroidDriver}
 * @param {import('../types').WebviewProps[]} webviewsMapping The current webviews mapping
 * !!! Each item of this array gets mutated (`info`/`pages` properties get added
 * based on the provided `opts`) if the requested details have been
 * successfully retrieved for it !!!
 * @param {import('../types').DetailCollectionOptions} [opts={}] If both `ensureWebviewsHavePages` and
 * `enableWebviewDetailsCollection` properties are falsy then no details collection
 * is performed
 * @returns {Promise<void>}
 */
async function collectWebviewsDetails(webviewsMapping, opts = {}) {
  if (_.isEmpty(webviewsMapping)) {
    return;
  }

  const {
    webviewDevtoolsPort = null,
    ensureWebviewsHavePages = null,
    enableWebviewDetailsCollection = null,
  } = opts;

  if (!ensureWebviewsHavePages) {
    this.log.info(
      `Not checking whether webviews have active pages; use the ` +
        `'ensureWebviewsHavePages' cap to turn this check on`,
    );
  }

  if (!enableWebviewDetailsCollection) {
    this.log.info(
      `Not collecting web view details. Details collection might help ` +
        `to make Chromedriver initialization more precise. Use the 'enableWebviewDetailsCollection' ` +
        `cap to turn it on`,
    );
  }

  if (!ensureWebviewsHavePages && !enableWebviewDetailsCollection) {
    return;
  }

  // Connect to each devtools socket and retrieve web view details
  this.log.debug(
    `Collecting CDP data of ${util.pluralize('webview', webviewsMapping.length, true)}`,
  );
  const detailCollectors = [];
  for (const item of webviewsMapping) {
    detailCollectors.push(
      (async () => {
        let port;
        let host;
        try {
          [host, port] = await allocateDevtoolsChannel.bind(this)(item.proc, webviewDevtoolsPort);
          if (enableWebviewDetailsCollection) {
            item.info = await cdpInfo(host, port);
          }
          if (ensureWebviewsHavePages) {
            item.pages = await cdpList(host, port);
          }
        } catch (e) {
          this.log.debug(e);
        } finally {
          if (port) {
            try {
              await this.adb.removePortForward(port);
            } catch (e) {
              this.log.debug(e);
            }
          }
        }
      })(),
    );
  }
  await B.all(detailCollectors);
  this.log.debug(`CDP data collection completed`);
}

/**
 * Get a list of available webviews mapping by introspecting processes with adb,
 * where webviews are listed. It's possible to pass in a 'deviceSocket' arg, which
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
 * @this {import('../../driver').AndroidDriver}
 * @param {import('../types').GetWebviewsOpts} [opts={}]
 * @returns {Promise<import('../types').WebviewsMapping[]>}
 */
export async function getWebViewsMapping({
  androidDeviceSocket = null,
  ensureWebviewsHavePages = true,
  webviewDevtoolsPort = null,
  enableWebviewDetailsCollection = true,
  waitForWebviewMs = 0,
} = {}) {
  this.log.debug(`Getting a list of available webviews`);

  if (!_.isNumber(waitForWebviewMs)) {
    waitForWebviewMs = parseInt(`${waitForWebviewMs}`, 10) || 0;
  }

  /** @type {import('../types').WebviewsMapping[]} */
  let webviewsMapping;
  const timer = new timing.Timer().start();
  do {
    webviewsMapping = await webviewsFromProcs.bind(this)(androidDeviceSocket);

    if (webviewsMapping.length > 0) {
      break;
    }

    this.log.debug(`No webviews found in ${timer.getDuration().asMilliSeconds.toFixed(0)}ms`);
    await sleep(WEBVIEW_WAIT_INTERVAL_MS);
  } while (timer.getDuration().asMilliSeconds < waitForWebviewMs);

  await collectWebviewsDetails.bind(this)(webviewsMapping, {
    ensureWebviewsHavePages,
    enableWebviewDetailsCollection,
    webviewDevtoolsPort,
  });

  for (const webviewMapping of webviewsMapping) {
    const {webview, info} = webviewMapping;
    webviewMapping.webviewName = null;

    let wvName = webview;
    /** @type {{name: string; id: string | null} | undefined} */
    let process;
    if (!androidDeviceSocket) {
      const pkgMatch = WEBVIEW_PKG_PATTERN.exec(webview);
      try {
        // web view name could either be suffixed with PID or the package name
        // package names could not start with a digit
        const pkg = pkgMatch ? pkgMatch[1] : await procFromWebview.bind(this)(webview);
        wvName = `${WEBVIEW_BASE}${pkg}`;
        const pidMatch = WEBVIEW_PID_PATTERN.exec(webview);
        process = {
          name: pkg,
          id: pidMatch ? pidMatch[1] : null,
        };
      } catch (e) {
        this.log.debug(e.stack);
        this.log.warn(e.message);
        continue;
      }
    }

    webviewMapping.webviewName = wvName;
    const key = toDetailsCacheKey(this.adb, wvName);
    if (info || process) {
      WEBVIEWS_DETAILS_CACHE.set(key, {info, process});
    } else if (WEBVIEWS_DETAILS_CACHE.has(key)) {
      WEBVIEWS_DETAILS_CACHE.delete(key);
    }
  }
  return webviewsMapping;
}

/**
 * Take a webview name like WEBVIEW_4296 and use 'adb shell ps' to figure out
 * which app package is associated with that webview. One of the reasons we
 * want to do this is to make sure we're listing webviews for the actual AUT,
 * not some other running app
 *
 * @this {import('../../driver').AndroidDriver}
 * @param {string} webview
 * @returns {Promise<string>}
 */
async function procFromWebview(webview) {
  const pidMatch = WEBVIEW_PID_PATTERN.exec(webview);
  if (!pidMatch) {
    throw new Error(`Could not find PID for webview '${webview}'`);
  }

  const pid = pidMatch[1];
  this.log.debug(`${webview} mapped to pid ${pid}`);
  this.log.debug(`Getting process name for webview '${webview}'`);
  const pkg = await this.adb.getNameByPid(pid);
  this.log.debug(`Got process name: '${pkg}'`);
  return pkg;
}

/**
 * This function gets a list of android system processes and returns ones
 * that look like webviews
 * See https://cs.chromium.org/chromium/src/chrome/browser/devtools/device/android_device_info_query.cc
 * for more details
 *
 * @this {import('../../driver').AndroidDriver}
 * @returns {Promise<string[]>} a list of matching webview socket names (including the leading '@')
 */
async function getPotentialWebviewProcs() {
  const out = await this.adb.shell(['cat', '/proc/net/unix']);
  /** @type {string[]} */
  const names = [];
  /** @type {string[]} */
  const allMatches = [];
  for (const line of out.split('\n')) {
    // Num RefCount Protocol Flags Type St Inode Path
    const [, , , flags, , st, , sockPath] = line.trim().split(/\s+/);
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
    this.log.debug('Found no active devtools sockets');
    if (!_.isEmpty(allMatches)) {
      this.log.debug(`Other sockets are: ${JSON.stringify(allMatches, null, 2)}`);
    }
  } else {
    this.log.debug(
      `Parsed ${names.length} active devtools ${util.pluralize('socket', names.length, false)}: ` +
        JSON.stringify(names),
    );
  }
  // sometimes the webview process shows up multiple times per app
  return _.uniq(names);
}

/**
 * This function retrieves a list of system processes that look like webviews,
 * and returns them along with the webview context name appropriate for it.
 * If we pass in a deviceSocket, we only attempt to find webviews which match
 * that socket name (this is for apps which embed Chromium, which isn't the
 * same as chrome-backed webviews).
 *
 * @this {import('../../driver').AndroidDriver}
 * @param {string?} [deviceSocket=null] - the explictly-named device socket to use
 * @returns {Promise<import('../types').WebviewProc[]>}
 */
async function webviewsFromProcs(deviceSocket = null) {
  const socketNames = await getPotentialWebviewProcs.bind(this)();
  /** @type {{proc: string; webview: string}[]} */
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
    const matchedSocketName = socketNameMatch[2];
    const crosswalkMatch = CROSSWALK_SOCKET_PATTERN.exec(socketName);
    if (!matchedSocketName && !crosswalkMatch) {
      continue;
    }

    if ((deviceSocket && socketName === `@${deviceSocket}`) || !deviceSocket) {
      webviews.push({
        proc: socketName,
        webview: matchedSocketName
          ? `${WEBVIEW_BASE}${matchedSocketName}`
          : // @ts-expect-error: XXX crosswalkMatch can absolutely be null
            `${WEBVIEW_BASE}${crosswalkMatch[1]}`,
      });
    }
  }
  return webviews;
}

/**
 * @this {import('../../driver').AndroidDriver}
 * @param {import('../types').PortSpec} [portSpec]
 * @returns {Promise<number>}
 */
async function getChromedriverPort(portSpec) {
  // if the user didn't give us any specific information about chromedriver
  // port ranges, just find any free port
  if (!portSpec) {
    const port = await getFreePort();
    this.log.debug(`A port was not given, using random free port: ${port}`);
    return port;
  }

  // otherwise find the free port based on a list or range provided by the user
  this.log.debug(`Finding a free port for chromedriver using spec ${JSON.stringify(portSpec)}`);
  let foundPort = null;
  for (const potentialPort of portSpec) {
    /** @type {number} */
    let port;
    /** @type {number} */
    let stopPort;
    if (Array.isArray(potentialPort)) {
      [port, stopPort] = potentialPort.map((p) => parseInt(String(p), 10));
    } else {
      port = parseInt(String(potentialPort), 10); // ensure we have a number and not a string
      stopPort = port;
    }
    this.log.debug(`Checking port range ${port}:${stopPort}`);
    try {
      foundPort = await findAPortNotInUse(port, stopPort);
      break;
    } catch (e) {
      this.log.debug(`Nothing in port range ${port}:${stopPort} was available`);
    }
  }

  if (foundPort === null) {
    throw new Error(
      `Could not find a free port for chromedriver using ` +
        `chromedriverPorts spec ${JSON.stringify(portSpec)}`,
    );
  }

  this.log.debug(`Using free port ${foundPort} for chromedriver`);
  return foundPort;
}

/**
 * @this {import('../../driver').AndroidDriver}
 * @returns {boolean}
 */
function isChromedriverAutodownloadEnabled() {
  if (this.isFeatureEnabled(CHROMEDRIVER_AUTODOWNLOAD_FEATURE)) {
    return true;
  }
  this.log.debug(
    `Automated Chromedriver download is disabled. ` +
      `Use '${CHROMEDRIVER_AUTODOWNLOAD_FEATURE}' server feature to enable it`,
  );
  return false;
}

/**
 * @this {import('../../driver').AndroidDriver}
 * @param {import('../../driver').AndroidDriverOpts} opts
 * @param {string} curDeviceId
 * @param {string} [context]
 * @returns {Promise<Chromedriver>}
 */
export async function setupNewChromedriver(opts, curDeviceId, context) {
  // @ts-ignore TODO: Remove the legacy
  if (opts.chromeDriverPort) {
    this.log.warn(
      `The 'chromeDriverPort' capability is deprecated. Please use 'chromedriverPort' instead`,
    );
    // @ts-ignore TODO: Remove the legacy
    opts.chromedriverPort = opts.chromeDriverPort;
  }

  if (opts.chromedriverPort) {
    this.log.debug(`Using user-specified port ${opts.chromedriverPort} for chromedriver`);
  } else {
    // if a single port wasn't given, we'll look for a free one
    opts.chromedriverPort = await getChromedriverPort.bind(this)(opts.chromedriverPorts);
  }

  const details = context ? getWebviewDetails(this.adb, context) : undefined;
  if (!_.isEmpty(details)) {
    this.log.debug(
      'Passing web view details to the Chromedriver constructor: ' +
        JSON.stringify(details, null, 2),
    );
  }

  const chromedriver = new Chromedriver({
    port: String(opts.chromedriverPort),
    executable: opts.chromedriverExecutable,
    // eslint-disable-next-line object-shorthand
    adb: /** @type {any} */ (this.adb),
    cmdArgs: /** @type {string[]} */ (opts.chromedriverArgs),
    verbose: !!opts.showChromedriverLog,
    executableDir: opts.chromedriverExecutableDir,
    mappingPath: opts.chromedriverChromeMappingFile,
    // @ts-ignore this property exists
    bundleId: opts.chromeBundleId,
    useSystemExecutable: opts.chromedriverUseSystemExecutable,
    disableBuildCheck: opts.chromedriverDisableBuildCheck,
    // @ts-ignore this is ok
    details,
    isAutodownloadEnabled: isChromedriverAutodownloadEnabled.bind(this)(),
  });

  // make sure there are chromeOptions
  opts.chromeOptions = opts.chromeOptions || {};
  // try out any prefixed chromeOptions,
  // and strip the prefix
  for (const opt of _.keys(opts)) {
    if (opt.endsWith(':chromeOptions')) {
      this?.log?.warn(`Merging '${opt}' into 'chromeOptions'. This may cause unexpected behavior`);
      _.merge(opts.chromeOptions, opts[opt]);
    }
  }

  const caps = /** @type {any} */ (createChromedriverCaps.bind(this)(opts, curDeviceId, details));
  this.log.debug(
    `Before starting chromedriver, androidPackage is '${caps.chromeOptions.androidPackage}'`,
  );
  await chromedriver.start(caps);
  return chromedriver;
}

/**
 * @this {import('../../driver').AndroidDriver}
 * @template {Chromedriver} T
 * @param {T} chromedriver
 * @returns {Promise<T>}
 */
export async function setupExistingChromedriver(chromedriver) {
  // check the status by sending a simple window-based command to ChromeDriver
  // if there is an error, we want to recreate the ChromeDriver session
  if (!(await chromedriver.hasWorkingWebview())) {
    this.log.debug('ChromeDriver is not associated with a window. Re-initializing the session.');
    await chromedriver.restart();
  }
  return chromedriver;
}

/**
 * @this {import('../../driver').AndroidDriver}
 * @returns {boolean}
 */
export function shouldDismissChromeWelcome() {
  return (
    !!this.opts.chromeOptions &&
    _.isArray(this.opts.chromeOptions.args) &&
    this.opts.chromeOptions.args.includes('--no-first-run')
  );
}

/**
 * @this {import('../../driver').AndroidDriver}
 * @returns {Promise<void>}
 */
export async function dismissChromeWelcome() {
  this.log.info('Trying to dismiss Chrome welcome');
  let activity = await this.getCurrentActivity();
  if (activity !== 'org.chromium.chrome.browser.firstrun.FirstRunActivity') {
    this.log.info('Chrome welcome dialog never showed up! Continuing');
    return;
  }
  let el = await this.findElOrEls('id', 'com.android.chrome:id/terms_accept', false);
  await this.click(/** @type {string} */ (el.ELEMENT));
  try {
    let el = await this.findElOrEls('id', 'com.android.chrome:id/negative_button', false);
    await this.click(/** @type {string} */ (el.ELEMENT));
  } catch (e) {
    // DO NOTHING, THIS DEVICE DIDNT LAUNCH THE SIGNIN DIALOG
    // IT MUST BE A NON GMS DEVICE
    this.log.warn(
      `This device did not show Chrome SignIn dialog, ${/** @type {Error} */ (e).message}`,
    );
  }
}

/**
 * @typedef {import('appium-adb').ADB} ADB
 */
