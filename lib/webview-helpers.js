import _ from 'lodash';
import logger from './logger';
import request from 'request-promise';
import { asyncmap, asyncfilter } from 'asyncbox';

const NATIVE_WIN = 'NATIVE_APP';
const WEBVIEW_WIN = 'WEBVIEW';
const WEBVIEW_BASE = `${WEBVIEW_WIN}_`;
const WEBVIEW_REGEXP = new RegExp(`@?webview_devtools_remote_(\\d+)`);
const WEBVIEW_PID_REGEXP = new RegExp(`${WEBVIEW_BASE}(\\d+)`);
const CHROMIUM_WIN = 'CHROMIUM';
const CROSSWALK_SOCKET_SUFFIX = '_devtools_remote';
const CROSSWALK_REGEXP_STRING = `(\\S*)${CROSSWALK_SOCKET_SUFFIX}`;
const CROSSWALK_REGEXP = new RegExp(`@${CROSSWALK_REGEXP_STRING}`);
const CROSSWALK_PROCESS_REGEXP = new RegExp(WEBVIEW_BASE + CROSSWALK_REGEXP_STRING);
const DEFAULT_WEBVIEW_DEVTOOLS_PORT = 9222;


let helpers = {};

// This function gets a list of android system processes and returns ones
// that look like webviews
async function getPotentialWebviewProcs (adb) {
  const procs = [];
  const out = await adb.shell(['cat', '/proc/net/unix']);
  for (let line of out.split('\n')) {
    line = line.trim();
    let regexMatch;
    if ((regexMatch = (line.match(WEBVIEW_REGEXP) || line.match(CROSSWALK_REGEXP)))) {
      procs.push(regexMatch[0]);
    }
  }

  // sometimes the webview process shows up multiple times per app
  return _.uniq(procs);
}

// This function retrieves a list of system processes that look like webviews,
// and returns them along with the webview context name appropriate for it.
// If we pass in a deviceSocket, we only attempt to find webviews which match
// that socket name (this is for apps which embed Chromium, which isn't the
// same as chrome-backed webviews). Returns a list of objects of the form
// {proc: <proc-name>, webview: <webview-name>}
// TODO: some of this function probably belongs in appium-adb?
async function webviewsFromProcs (adb, deviceSocket) {
  const procs = await getPotentialWebviewProcs(adb);
  const webviews = [];
  for (const proc of procs) {
    if (deviceSocket === 'chrome_devtools_remote' && proc === `@${deviceSocket}`) {
      webviews.push({proc, webview: CHROMIUM_WIN});
      continue;
    }

    let webviewPid;
    let crosswalkWebviewSocket;
    if ((webviewPid = proc.match(WEBVIEW_REGEXP))) {
      // for multiple webviews a list of 'WEBVIEW_<index>' will be returned
      // where <index> is zero based (same is in selendroid)
      webviews.push({proc, webview: `${WEBVIEW_BASE}${webviewPid[1]}`});
    } else if ((crosswalkWebviewSocket = proc.match(CROSSWALK_REGEXP))) {
      if (deviceSocket) {
        if (crosswalkWebviewSocket[0] === `@${deviceSocket}`) {
          webviews.push({proc, webview: `${WEBVIEW_BASE}${crosswalkWebviewSocket[1]}`});
        }
      } else {
        webviews.push({proc, webview: `${WEBVIEW_BASE}${crosswalkWebviewSocket[1]}${CROSSWALK_SOCKET_SUFFIX}`});
      }
    }
  }
  return webviews;
}

// given a 'webview-proc' object, check whether we can detect any active pages
// corresponding to that webview. This is used by getWebviews to filter out any
// webview-looking processes which have a remote debug port open but which
// aren't actually running any pages, because such processes can't be automated
// by chromedriver anyway.
async function webviewHasPages (adb, wp, webviewDevtoolsPort) {
  let hasPages = false;
  const wvPort = webviewDevtoolsPort || DEFAULT_WEBVIEW_DEVTOOLS_PORT;

  // proc names come with '@', but this should not be a part of the abstract
  // remote port, so remove it
  const remotePort = wp.proc.replace('@', '');

  // forward the specified local port to the remote debugger port on the device
  await adb.adbExec(['forward', `tcp:${wvPort}`, `localabstract:${remotePort}`]);
  try {
    const remoteDebugger = `http://localhost:${wvPort}/json/list`;
    logger.info(`Attempting to get list of pages for webview '${wp.webview}' ` +
                `from the remote debugger at ${remoteDebugger}.`);
    // take advantage of the chrome remote debugger REST API just to get
    // a list of pages
    const pages = await request({
      uri: remoteDebugger,
      json: true
    });
    if (pages.length > 0) {
      logger.info(`Webview '${wp.webview}' has pages`);
      hasPages = true;
    }
  } catch (e) {
    logger.warn(`Got error when retrieving page list, will assume no pages: ${e}`);
  }
  await adb.removePortForward(wvPort); // make sure we clean up
  return hasPages;
}

// Take a webview name like WEBVIEW_4296 and use 'adb shell ps' to figure out
// which app package is associated with that webview. One of the reasons we
// want to do this is to make sure we're listing webviews for the actual AUT,
// not some other running app
// TODO: this should be called procFromPid and exist in appium-adb
helpers.procFromWebview = async function procFromWebview (adb, webview) {
  if (webview.match(WEBVIEW_PID_REGEXP) === null) {
    let processName = webview.match(CROSSWALK_PROCESS_REGEXP);
    if (processName === null) {
      throw new Error(`Could not find process name for webview ${webview}`);
    }
    return processName[1];
  }

  // webview_devtools_remote_4296 => 4296
  let pid = webview.match(/\d+$/);
  if (!pid) {
    throw new Error(`Could not find PID for webview ${webview}`);
  }
  pid = pid[0];
  logger.debug(`${webview} mapped to pid ${pid}`);
  logger.debug('Getting process name for webview');
  let out = await adb.shell('ps');
  let pkg = 'unknown';
  let lines = out.split(/\r?\n/);

  /* Output of ps is like:
   USER       PID  PPID  VSIZE  RSS   WCHAN    PC         NAME  _or_
   USER       PID  PPID  VSZ    RSS   WCHAN    ADDR     S NAME
   u0_a136   6248  179   946000 48144 ffffffff 4005903e R com.example.test
   u0_a136   6249  179   946000 48144 ffffffff          R com.example.test
  */
  const fullHeader = lines[0].trim();
  const header = fullHeader.split(/\s+/);
  const pidColumn = header.indexOf('PID');

  for (let line of lines) {
    const entries = line.trim().split(/\s+/);
    const pidEntry = entries[pidColumn];
    if (pidEntry === pid) {
      pkg = _.last(entries);
      logger.debug(`Parsed pid: '${pidEntry}' pkg: '${pkg}' from`);
      logger.debug(`    ${fullHeader}`);
      logger.debug(`    ${line}`);

      break;
    }
  }

  logger.debug(`Returning process name: '${pkg}'`);
  return pkg;
};

// Get a list of available webviews by introspecting processes with adb, where
// webviews are listed. It's possible to pass in a 'deviceSocket' arg, which
// limits the webview possibilities to the one running on the Chromium devtools
// socket we're interested in (see note on webviewsFromProcs). We can also
// direct this method to verify whether a particular webview process actually
// has any pages (if a process exists but no pages are found, Chromedriver will
// not actually be able to connect to it, so this serves as a guard for that
// strange failure mode). The strategy for checking whether any pages are
// active involves sending a request to the remote debug server on the device,
// hence it is also possible to specify the port on the host machine which
// should be used for this communication.
helpers.getWebviews = async function getWebviews (adb, deviceSocket,
  ensureWebviewsHavePages, webviewDevtoolsPort) {

  logger.debug('Getting a list of available webviews');
  let webviewProcs = await webviewsFromProcs(adb, deviceSocket);

  if (ensureWebviewsHavePages) {
    logger.info('Retrieved potential webviews; will filter out ones with no active pages');
    webviewProcs = await asyncfilter(webviewProcs, async (wp) => {
      return await webviewHasPages(adb, wp, webviewDevtoolsPort);
    }, false /*ensure serial operation*/);
  } else {
    logger.info('Not checking whether webviews have active pages; use the ' +
                "'ensureWebviewsHavePages' cap to turn this check on");
  }

  // webviewProcs contains procs, which we only care about for ensuring
  // presence of pages above, so we can now discard them and rely on just the
  // webview names
  let webviews = webviewProcs.map((wp) => wp.webview);

  if (deviceSocket) {
    return webviews;
  }

  webviews = await asyncmap(webviews, async (webviewName) => {
    let pkg = await helpers.procFromWebview(adb, webviewName);
    return WEBVIEW_BASE + pkg;
  });
  logger.debug(`Found webviews: ${JSON.stringify(webviews)}`);
  return webviews;
};

helpers.decorateChromeOptions = function decorateChromeOptions (caps, opts, deviceId) {
  // add options from appium session caps
  if (opts.chromeOptions) {
    if (opts.chromeOptions.Arguments) {
      // merge `Arguments` and `args`
      opts.chromeOptions.args = [...(opts.chromeOptions.args || []), ...opts.chromeOptions.Arguments];
      delete opts.chromeOptions.Arguments;
    }
    for (let [opt, val] of _.toPairs(opts.chromeOptions)) {
      if (_.isUndefined(caps.chromeOptions[opt])) {
        caps.chromeOptions[opt] = val;
      } else {
        logger.warn(`Cannot pass option ${caps.chromeOptions[opt]} because ` +
                    'Appium needs it to make chromeDriver work');
      }
    }
  }

  // add device id from adb
  caps.chromeOptions.androidDeviceSerial = deviceId;
  return caps;
};

export default helpers;
export { helpers, NATIVE_WIN, WEBVIEW_WIN, WEBVIEW_BASE, CHROMIUM_WIN };
