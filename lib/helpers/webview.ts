/**
 * Webview-related helper functions
 * @module
 */

import {util} from '@appium/support';
import {StringRecord} from '@appium/types';
import axios from 'axios';
import B from 'bluebird';
import _ from 'lodash';
import {LRUCache} from 'lru-cache';
import os from 'node:os';
import path from 'node:path';
import {findAPortNotInUse} from 'portscanner';
import type {WebviewsMapping} from '../commands/types';
import type {AndroidDriverCaps} from '../driver';
import logger from '../logger';
import type {
  DetailCollectionOptions,
  GetWebviewsOpts,
  WebViewDetails,
  WebviewProc,
  WebviewProps,
} from './types';
import type {ADB} from 'appium-adb';

const NATIVE_WIN = 'NATIVE_APP';
const WEBVIEW_WIN = 'WEBVIEW';
const CHROMIUM_WIN = 'CHROMIUM';
const WEBVIEW_BASE = `${WEBVIEW_WIN}_`;
const WEBVIEW_PID_PATTERN = new RegExp(`^${WEBVIEW_BASE}(\\d+)`);
const WEBVIEW_PKG_PATTERN = new RegExp(`^${WEBVIEW_BASE}([^\\d\\s][\\w.]*)`);
export const DEVTOOLS_SOCKET_PATTERN = /@[\w.]+_devtools_remote_?([\w.]+_)?(\d+)?\b/;
const CROSSWALK_SOCKET_PATTERN = /@([\w.]+)_devtools_remote\b/;
const CHROMIUM_DEVTOOLS_SOCKET = 'chrome_devtools_remote';
const CHROME_PACKAGE_NAME = 'com.android.chrome';
const KNOWN_CHROME_PACKAGE_NAMES = [
  CHROME_PACKAGE_NAME,
  'com.chrome.beta',
  'com.chrome.dev',
  'com.chrome.canary',
];
const DEVTOOLS_PORTS_RANGE = [10900, 11000];
const WEBVIEWS_DETAILS_CACHE = new LRUCache<string, WebViewDetails>({
  max: 100,
  updateAgeOnGet: true,
});
const CDP_REQ_TIMEOUT = 2000; // ms
const DEVTOOLS_PORT_ALLOCATION_GUARD = util.getLockFileGuard(
  path.resolve(os.tmpdir(), 'android_devtools_port_guard'),
  {timeout: 7, tryRecovery: true}
);

interface WebviewHelpers {
  /**
   * Take a webview name like WEBVIEW_4296 and use 'adb shell ps' to figure out
   * which app package is associated with that webview. One of the reasons we
   * want to do this is to make sure we're listing webviews for the actual AUT,
   * not some other running app
   *
   * @param adb - an ADB instance
   * @param webview - a webview process name
   *
   * @returns {Promise<string>} - the package name of the app running the webview
   * @throws {Error} If there was a failure while retrieving the process name
   */
  procFromWebview: (adb: ADB, webview: string) => Promise<string>;

  /**
   * Parse webview names for getContexts
   *
   * @param webviewsMapping See note on getWebViewsMapping
   * @param opts See note on getWebViewsMapping
   * @returns a list of webview names
   */
  parseWebviewNames: (webviewsMapping: WebviewsMapping[], opts?: GetWebviewsOpts) => string[];

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
   * @param adb - an ADB instance
   */
  getWebViewsMapping: (adb: ADB, opts?: GetWebviewsOpts) => Promise<WebviewsMapping[]>;

  /**
   * Retrieves web view details previously cached by `getWebviews` call
   *
   * @param adb ADB instance
   * @param webview The name of the web view
   * @returns Either `undefined` or the recent web view details
   */
  getWebviewDetails: (adb: ADB, webview: string) => WebViewDetails | undefined;

  /**
   * Create Chrome driver capabilities based on the provided
   * Appium capabilities
   *
   * @param opts User-provided capabilities object
   * @param deviceId The identifier of the Android device under test
   * @returns The capabilities object.
   * @see {@link https://chromedriver.chromium.org/capabilities Chromedriver docs} for more details
   */

  createChromedriverCaps: (
    opts: any,
    deviceId: string,
    webViewDetails?: WebViewDetails | null
  ) => object;
}

function toDetailsCacheKey(adb: ADB, webview: string): string {
  return `${adb?.curDeviceId}:${webview}`;
}

/**
 * This function gets a list of android system processes and returns ones
 * that look like webviews
 * See https://cs.chromium.org/chromium/src/chrome/browser/devtools/device/android_device_info_query.cc
 * for more details
 *
 * @param adb - an ADB instance
 *
 * @returns a list of matching webview socket names (including the leading '@')
 */
async function getPotentialWebviewProcs(adb: ADB): Promise<string[]> {
  const out = (await adb.shell(['cat', '/proc/net/unix'])) as string;
  const names: string[] = [];
  const allMatches: string[] = [];
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
    logger.debug('Found no active devtools sockets');
    if (!_.isEmpty(allMatches)) {
      logger.debug(`Other sockets are: ${JSON.stringify(allMatches, null, 2)}`);
    }
  } else {
    logger.debug(
      `Parsed ${names.length} active devtools ${util.pluralize('socket', names.length, false)}: ` +
        JSON.stringify(names)
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
 * @param adb - an ADB instance
 * @param deviceSocket - the explictly-named device socket to use
 */
async function webviewsFromProcs(
  adb: any,
  deviceSocket: string | null = null
): Promise<WebviewProc[]> {
  const socketNames = await getPotentialWebviewProcs(adb);
  const webviews: {proc: string; webview: string}[] = [];
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
 * Allocates a local port for devtools communication
 *
 * @param adb - ADB instance
 * @param socketName - The remote Unix socket name
 * @param webviewDevtoolsPort - The local port number or null to apply
 * autodetection
 * @returns The local port number if the remote socket has been forwarded
 * successfully or `null` otherwise
 * @throws {Error} If there was an error while allocating the local port
 */
async function allocateDevtoolsPort(
  adb: any,
  socketName: string,
  webviewDevtoolsPort: number | null = null
): Promise<number> {
  // socket names come with '@', but this should not be a part of the abstract
  // remote port, so remove it
  const remotePort = socketName.replace(/^@/, '');
  let [startPort, endPort] = DEVTOOLS_PORTS_RANGE;
  if (webviewDevtoolsPort) {
    endPort = webviewDevtoolsPort + (endPort - startPort);
    startPort = webviewDevtoolsPort;
  }
  logger.debug(
    `Forwarding remote port ${remotePort} to a local ` + `port in range ${startPort}..${endPort}`
  );
  if (!webviewDevtoolsPort) {
    logger.debug(
      `You could use the 'webviewDevtoolsPort' capability to customize ` +
        `the starting port number`
    );
  }
  return (await DEVTOOLS_PORT_ALLOCATION_GUARD(async () => {
    let localPort: number;
    try {
      localPort = await findAPortNotInUse(startPort, endPort);
    } catch (e) {
      throw new Error(
        `Cannot find any free port to forward the Devtools socket ` +
          `in range ${startPort}..${endPort}. You could set the starting port number ` +
          `manually by providing the 'webviewDevtoolsPort' capability`
      );
    }
    await adb.adbExec(['forward', `tcp:${localPort}`, `localabstract:${remotePort}`]);
    return localPort;
  })) as number;
}

/**
 * This is a wrapper for Chrome Debugger Protocol data collection.
 * No error is thrown if CDP request fails - in such case no data will be
 * recorded into the corresponding `webviewsMapping` item.
 *
 * @param adb The ADB instance
 * @param webviewsMapping The current webviews mapping
 * !!! Each item of this array gets mutated (`info`/`pages` properties get added
 * based on the provided `opts`) if the requested details have been
 * successfully retrieved for it !!!
 * @param opts If both `ensureWebviewsHavePages` and
 * `enableWebviewDetailsCollection` properties are falsy then no details collection
 * is performed
 */
async function collectWebviewsDetails(
  adb: ADB,
  webviewsMapping: WebviewProps[],
  opts: DetailCollectionOptions = {}
): Promise<void> {
  if (_.isEmpty(webviewsMapping)) {
    return;
  }

  const {
    webviewDevtoolsPort = null,
    ensureWebviewsHavePages = null,
    enableWebviewDetailsCollection = null,
  } = opts;

  if (!ensureWebviewsHavePages) {
    logger.info(
      `Not checking whether webviews have active pages; use the ` +
        `'ensureWebviewsHavePages' cap to turn this check on`
    );
  }

  if (!enableWebviewDetailsCollection) {
    logger.info(
      `Not collecting web view details. Details collection might help ` +
        `to make Chromedriver initialization more precise. Use the 'enableWebviewDetailsCollection' ` +
        `cap to turn it on`
    );
  }

  if (!ensureWebviewsHavePages && !enableWebviewDetailsCollection) {
    return;
  }

  // Connect to each devtools socket and retrieve web view details
  logger.debug(`Collecting CDP data of ${util.pluralize('webview', webviewsMapping.length, true)}`);
  const detailCollectors: Promise<void>[] = [];
  for (const item of webviewsMapping) {
    detailCollectors.push(
      (async () => {
        let localPort: number | undefined;
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
            try {
              await adb.removePortForward(localPort);
            } catch (e) {
              logger.debug(e);
            }
          }
        }
      })()
    );
  }
  await B.all(detailCollectors);
  logger.debug(`CDP data collection completed`);
}

// https://chromedevtools.github.io/devtools-protocol/
async function cdpList(localPort: number): Promise<object[]> {
  return (
    await axios({
      url: `http://127.0.0.1:${localPort}/json/list`,
      timeout: CDP_REQ_TIMEOUT,
    })
  ).data;
}

// https://chromedevtools.github.io/devtools-protocol/
async function cdpInfo(localPort: number): Promise<object[]> {
  return (
    await axios({
      url: `http://127.0.0.1:${localPort}/json/version`,
      timeout: CDP_REQ_TIMEOUT,
    })
  ).data;
}

const WebviewHelpers: WebviewHelpers = {
  async procFromWebview(adb: ADB, webview: string): Promise<string> {
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
  },

  parseWebviewNames(
    webviewsMapping: WebviewsMapping[],
    {ensureWebviewsHavePages = true, isChromeSession = false}: GetWebviewsOpts = {}
  ): string[] {
    if (isChromeSession) {
      return [CHROMIUM_WIN];
    }

    const result: string[] = [];
    for (const {webview, pages, proc, webviewName} of webviewsMapping) {
      if (ensureWebviewsHavePages && pages?.length === 0) {
        logger.info(
          `Skipping the webview '${webview}' at '${proc}' ` +
            `since it has reported having zero pages`
        );
        continue;
      }
      if (webviewName) {
        result.push(webviewName);
      }
    }
    logger.debug(
      `Found ${util.pluralize('webview', result.length, true)}: ${JSON.stringify(result)}`
    );
    return result;
  },

  async getWebViewsMapping(
    adb: ADB,
    {
      androidDeviceSocket = null,
      ensureWebviewsHavePages = true,
      webviewDevtoolsPort = null,
      enableWebviewDetailsCollection = true,
    }: GetWebviewsOpts = {}
  ): Promise<WebviewsMapping[]> {
    logger.debug('Getting a list of available webviews');
    const webviewsMapping = (await webviewsFromProcs(
      adb,
      androidDeviceSocket
    )) as WebviewsMapping[];

    await collectWebviewsDetails(adb, webviewsMapping, {
      ensureWebviewsHavePages,
      enableWebviewDetailsCollection,
      webviewDevtoolsPort,
    });

    for (const webviewMapping of webviewsMapping) {
      const {webview, info} = webviewMapping;
      webviewMapping.webviewName = null;

      let wvName = webview;
      let process: {name: string; id: string | null} | undefined;
      if (!androidDeviceSocket) {
        const pkgMatch = WEBVIEW_PKG_PATTERN.exec(webview);
        try {
          // web view name could either be suffixed with PID or the package name
          // package names could not start with a digit
          const pkg = pkgMatch ? pkgMatch[1] : await WebviewHelpers.procFromWebview(adb, webview);
          wvName = `${WEBVIEW_BASE}${pkg}`;
          const pidMatch = WEBVIEW_PID_PATTERN.exec(webview);
          process = {
            name: pkg,
            id: pidMatch ? pidMatch[1] : null,
          };
        } catch (e) {
          logger.warn((e as Error).message);
          continue;
        }
      }

      webviewMapping.webviewName = wvName;
      const key = toDetailsCacheKey(adb, wvName);
      if (info || process) {
        WEBVIEWS_DETAILS_CACHE.set(key, {info, process});
      } else if (WEBVIEWS_DETAILS_CACHE.has(key)) {
        WEBVIEWS_DETAILS_CACHE.delete(key);
      }
    }
    return webviewsMapping;
  },

  getWebviewDetails(adb: ADB, webview: string): WebViewDetails | undefined {
    const key = toDetailsCacheKey(adb, webview);
    return WEBVIEWS_DETAILS_CACHE.get(key);
  },

  createChromedriverCaps(
    opts: any,
    deviceId: string,
    webViewDetails?: WebViewDetails | null
  ): object {
    const caps: AndroidDriverCaps & {chromeOptions: StringRecord} = {chromeOptions: {}} as any;

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
        logger.warn(
          `The 'loggingPrefs' cap is deprecated; use the 'chromeLoggingPrefs' cap instead`
        );
      }
      // @ts-expect-error Why are we using this if it's deprecated?
      caps.loggingPrefs = opts.chromeLoggingPrefs || opts.loggingPrefs;
    }
    if (opts.enablePerformanceLogging) {
      logger.warn(
        `The 'enablePerformanceLogging' cap is deprecated; simply use ` +
          `the 'chromeLoggingPrefs' cap instead, with a 'performance' key set to 'ALL'`
      );
      const newPref = {performance: 'ALL'};
      // don't overwrite other logging prefs that have been sent in if they exist
      // @ts-expect-error Why are we using this if it's deprecated?
      caps.loggingPrefs = caps.loggingPrefs
        ? // @ts-expect-error Why are we using this if it's deprecated?
          Object.assign({}, caps.loggingPrefs, newPref)
        : newPref;
    }

    if (opts.chromeOptions?.Arguments) {
      // merge `Arguments` and `args`
      opts.chromeOptions.args = [
        ...(opts.chromeOptions.args || []),
        ...opts.chromeOptions.Arguments,
      ];
      delete opts.chromeOptions.Arguments;
    }

    logger.debug(
      'Precalculated Chromedriver capabilities: ' + JSON.stringify(caps.chromeOptions, null, 2)
    );

    const protectedCapNames: string[] = [];
    for (const [opt, val] of _.toPairs(opts.chromeOptions)) {
      if (_.isUndefined(caps.chromeOptions[opt])) {
        caps.chromeOptions[opt] = val;
      } else {
        protectedCapNames.push(opt);
      }
    }
    if (!_.isEmpty(protectedCapNames)) {
      logger.info(
        'The following Chromedriver capabilities cannot be overridden ' +
          'by the provided chromeOptions:'
      );
      for (const optName of protectedCapNames) {
        logger.info(`  ${optName} (${JSON.stringify(opts.chromeOptions[optName])})`);
      }
    }

    return caps;
  },
};

export {CHROMIUM_WIN, KNOWN_CHROME_PACKAGE_NAMES, NATIVE_WIN, WEBVIEW_BASE, WEBVIEW_WIN};
export default WebviewHelpers;
