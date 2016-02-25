import _ from 'lodash';
import logger from './logger';
import { asyncmap } from 'asyncbox';

const NATIVE_WIN = "NATIVE_APP";
const WEBVIEW_WIN = "WEBVIEW";
const WEBVIEW_BASE = `${WEBVIEW_WIN}_`;
const CHROMIUM_WIN = "CHROMIUM";

let helpers = {};

// This function gets a list of android system processes and returns ones
// that look like webviews, with the appropriate webview prefix and their PID.
// If we pass in a deviceSocket, we only attempt to find webviews which match
// that socket name (this is for apps which embed Chromium, which isn't the
// same as chrome-backed webviews)
// TODO: some of this function belongs in appium-adb
async function webviewsFromProcs (adb, deviceSocket) {
  let webviews = [];
  let out = await adb.shell(["cat", "/proc/net/unix"]);
  for (let line of out.split("\n")) {
    line = line.trim();
    let webviewPid = line.match(/@?webview_devtools_remote_(\d+)/);
    if (deviceSocket) {
      if (line.indexOf(`@${deviceSocket}`) === line.length - deviceSocket.length - 1) {
        if (webviewPid) {
          webviews.push(WEBVIEW_BASE + webviewPid[1]);
        } else {
          webviews.push(CHROMIUM_WIN);
        }
      }
    } else if (webviewPid) {
      // for multiple webviews a list of 'WEBVIEW_<index>' will be returned
      // where <index> is zero based (same is in selendroid)
      webviews.push(WEBVIEW_BASE + webviewPid[1]);
    }
  }
  return _.uniq(webviews);
}

// Take a webview name like WEBVIEW_4296 and use 'adb shell ps' to figure out
// which app package is associated with that webview. One of the reasons we
// want to do this is to make sure we're listing webviews for the actual AUT,
// not some other running app
// TODO: this should be called procFromPid and exist in appium-adb
async function procFromWebview (adb, webview) {
  // webview_devtools_remote_4296 => 4296
  let pid = webview.match(/\d+$/);
  if (!pid) {
    throw new Error(`Could not find PID for webview ${webview}`);
  }
  pid = pid[0];
  logger.debug(`${webview} mapped to pid ${pid}`);
  logger.debug("Getting process name for webview");
  let out = await adb.shell("ps");
  let pkg = "unknown";
  let lines = out.split(/\r?\n/);
  /* Output of ps is like:
   USER     PID   PPID  VSIZE  RSS     WCHAN    PC         NAME
   u0_a136   6248  179   946000 48144 ffffffff 4005903e R com.example.test
  */
  let header = lines[0].trim().split(/\s+/);
  // the column order may not be identical on all androids
  // dynamically locate the pid and name column.
  let pidColumn = header.indexOf("PID");
  let pkgColumn = header.indexOf("NAME") + 1;

  for (let line of lines) {
    line = line.trim().split(/\s+/);
    if (line[pidColumn].indexOf(pid) !== -1) {
      // Android 6.0 support (occasionally returns undefined - Appium issue #5689)
      pkg = _.isUndefined(line[pkgColumn]) ? line[pkgColumn-1] : line[pkgColumn];
      logger.debug(`Parsed pid: ${line[pidColumn]} pkg: ${pkg}!`);
      logger.debug(`from: ${line}`);
      break;
    }
  }
  logger.debug(`returning process name: ${pkg}`);
  return pkg;
}

// Get a list of available webviews by introspecting processes with adb, where
// webviews are listed. It's possible to pass in a 'deviceSocket' arg, which
// limits the webview possibilities to the one running on the Chromium devtools
// socket we're interested in (see note on webviewsFromProcs)
helpers.getWebviews = async function (adb, deviceSocket) {
  logger.debug("Getting a list of available webviews");
  let webviews = await webviewsFromProcs(adb, deviceSocket);

  if (deviceSocket) {
    return webviews;
  }

  webviews = await asyncmap(webviews, async (webviewName) => {
    let pkg = await procFromWebview(adb, webviewName);
    return WEBVIEW_BASE + pkg;
  });
  logger.debug(`Found webviews: ${JSON.stringify(webviews)}`);
  return webviews;
};

helpers.decorateChromeOptions = function (caps, opts, deviceId) {
  // add options from appium session caps
  if (opts.chromeOptions) {
    for (let [opt, val] of _.pairs(opts.chromeOptions)) {
      if (_.isUndefined(caps.chromeOptions[opt])) {
        caps.chromeOptions[opt] = val;
      } else {
        logger.warn(`Cannot pass option ${caps.chromeOptions[opt]} because ` +
                    "Appium needs it to make chromeDriver work");
      }
    }
  }

  // add device id from adb
  caps.chromeOptions.androidDeviceSerial = deviceId;
  return caps;
};

export default helpers;
export { helpers, NATIVE_WIN, WEBVIEW_WIN, WEBVIEW_BASE, CHROMIUM_WIN };
