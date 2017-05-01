import _ from 'lodash';
import logger from '../logger';
import Chromedriver from 'appium-chromedriver';
import PortFinder from 'portfinder';
import B from 'bluebird';
import { errors } from 'appium-base-driver';
import { default as webviewHelpers,
         NATIVE_WIN, WEBVIEW_BASE, WEBVIEW_WIN, CHROMIUM_WIN } from '../webview-helpers';

let commands = {}, helpers = {}, extensions = {};


/* -------------------------------
 * Actual MJSONWP command handlers
 * ------------------------------- */
commands.getCurrentContext = async function () {
  return this.curContext;
};

commands.getContexts = async function () {
  let webviews;
  if (this.isChromeSession) {
    // if we have a Chrome browser session, we only care about the Chrome
    // context and the native context
    webviews = [CHROMIUM_WIN];
  } else {
    // otherwise we use ADB to figure out which webviews are available
    webviews = await webviewHelpers.getWebviews(this.adb,
      this.opts.androidDeviceSocket);
  }
  this.contexts = _.union([NATIVE_WIN], webviews);
  logger.debug(`Available contexts: ${JSON.stringify(this.contexts)}`);
  return this.contexts;
};

commands.setContext = async function (name) {
  if (name === null) {
    name = this.defaultContextName();
  } else if (name === WEBVIEW_WIN) {
    // handle setContext "WEBVIEW"
    name = this.defaultWebviewName();
  }
  let contexts = await this.getContexts();
  // if the context we want doesn't exist, fail
  if (!_.contains(contexts, name)) {
    throw new errors.NoSuchContextError();
  }
  // if we're already in the context we want, do nothing
  if (name === this.curContext) {
    return;
  }

  await this.switchContext(name);
  this.curContext = name;
};

helpers.switchContext = async function (name) {
  // We have some options when it comes to webviews. If we want a
  // Chromedriver webview, we can only control one at a time.
  if (this.isChromedriverContext(name)) {
    // start proxying commands directly to chromedriver
    await this.startChromedriverProxy(name);
  } else if (this.isChromedriverContext(this.curContext)) {
    // if we're moving to a non-chromedriver webview, and our current context
    // _is_ a chromedriver webview, if caps recreateChromeDriverSessions is set
    // to true then kill chromedriver session using stopChromedriverProxies or
    // else simply suspend proxying to the latter
    if (this.opts.recreateChromeDriverSessions) {
      logger.debug("recreateChromeDriverSessions set to true; killing existing chromedrivers");
      this.stopChromedriverProxies();
    } else {
      this.suspendChromedriverProxy();
    }
  } else {
    throw new Error(`Didn't know how to handle switching to context '${name}'`);
  }
};


/* ---------------------------------
 * On-object context-related helpers
 * --------------------------------- */

// The reason this is a function and not just a constant is that both android-
// driver and selendroid-driver use this logic, and each one returns
// a different default context name
helpers.defaultContextName = function () {
  return NATIVE_WIN;
};

helpers.defaultWebviewName = function () {
  return WEBVIEW_BASE + this.opts.appPackage;
};

helpers.isWebContext = function () {
  return this.curContext !== null && this.curContext !== NATIVE_WIN;
};

// Turn on proxying to an existing Chromedriver session or a new one
helpers.startChromedriverProxy = async function (context) {
  logger.debug(`Connecting to chrome-backed webview context '${context}'`);
  if (this.chromedriver !== null) {
    throw new Error("We already have a chromedriver instance running");
  }

  let cd;
  if (this.sessionChromedrivers[context]) {
    // in the case where we've already set up a chromedriver for a context,
    // we want to reconnect to it, not create a whole new one
    logger.debug(`Found existing Chromedriver for context '${context}'. Using it.`);
    cd = this.sessionChromedrivers[context];
    await setupExistingChromedriver(cd);
  } else {
    let opts = _.cloneDeep(this.opts);
    opts.chromeUseRunningApp = true;
    if (opts.extractChromeAndroidPackageFromContextName) {
      let androidPackage = context.match(`${WEBVIEW_BASE}(.+)`);
      if (androidPackage && androidPackage.length > 0) {
        opts.chromeAndroidPackage = androidPackage[1];
      }
    }
    cd = await setupNewChromedriver(opts, this.adb.curDeviceId,
                                    this.adb.getAdbServerPort());
    // bind our stop/exit handler, passing in context so we know which
    // one stopped unexpectedly
    cd.on(Chromedriver.EVENT_CHANGED, (msg) => {
      if (msg.state === Chromedriver.STATE_STOPPED) {
        this.onChromedriverStop(context);
      }
    });
    // save the chromedriver object under the context
    this.sessionChromedrivers[context] = cd;
  }
  // hook up the local variables so we can proxy this biz
  this.chromedriver = cd;
  this.proxyReqRes = this.chromedriver.proxyReq.bind(this.chromedriver);
  this.jwpProxyActive = true;
};

// Stop proxying to any Chromedriver
helpers.suspendChromedriverProxy = function () {
  this.chromedriver = null;
  this.proxyReqRes = null;
  this.jwpProxyActive = false;
};

// Handle an out-of-band Chromedriver stop event
helpers.onChromedriverStop = async function (context) {
  logger.warn(`Chromedriver for context ${context} stopped unexpectedly`);
  if (context === this.curContext) {
    // we exited unexpectedly while automating the current context and so want
    // to shut down the session and respond with an error
    let err = new Error("Chromedriver quit unexpectedly during session");
    await this.startUnexpectedShutdown(err);
  } else {
    // if a Chromedriver in the non-active context barfs, we don't really
    // care, we'll just make a new one next time we need the context.
    logger.warn("Chromedriver quit unexpectedly, but it wasn't the active " +
                "context, ignoring");
    delete this.sessionChromedrivers[context];
  }
};

// Intentionally stop all the chromedrivers currently active, and ignore
// their exit events
helpers.stopChromedriverProxies = async function () {
  this.suspendChromedriverProxy(); // make sure we turn off the proxy flag
  for (let context of _.keys(this.sessionChromedrivers)) {
    let cd = this.sessionChromedrivers[context];
    logger.debug(`Stopping chromedriver for context ${context}`);
    // stop listening for the stopped state event
    cd.removeAllListeners(Chromedriver.EVENT_CHANGED);
    try {
      await cd.stop();
    } catch (err) {
      logger.warn(`Error stopping Chromedriver: ${err.message}`);
    }
    delete this.sessionChromedrivers[context];
  }
};

helpers.isChromedriverContext = function (viewName) {
  return viewName.indexOf(WEBVIEW_WIN) !== -1 || viewName === CHROMIUM_WIN;
};


/* --------------------------
 * Internal library functions
 * -------------------------- */

async function setupExistingChromedriver (chromedriver) {
  // check the status by sending a simple window-based command to ChromeDriver
  // if there is an error, we want to recreate the ChromeDriver session
  if (!await chromedriver.hasWorkingWebview()) {
    logger.debug("ChromeDriver is not associated with a window. " +
                 "Re-initializing the session.");
    await chromedriver.restart();
  }
  return chromedriver;
}

async function setupNewChromedriver (opts, curDeviceId, adbPort) {
  // if a port wasn't given, pick a random available one
  if (!opts.chromeDriverPort) {
    let getPort = B.promisify(PortFinder.getPort, {context: PortFinder});
    opts.chromeDriverPort = await getPort();
    logger.debug(`A port was not given, using random port: ${opts.chromeDriverPort}`);
  }
  let chromeArgs = {
    port: opts.chromeDriverPort,
    executable: opts.chromedriverExecutable,
    adbPort
  };
  let chromedriver = new Chromedriver(chromeArgs);
  let caps = {
    chromeOptions: {
      androidPackage: opts.appPackage,
    }
  };
  if (opts.chromeUseRunningApp) {
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
  if (opts.enablePerformanceLogging) {
    caps.loggingPrefs = {performance: 'ALL'};
  }
  if (opts.browserName === 'chromium-webview') {
    caps.chromeOptions.androidActivity = opts.appActivity;
  }
  caps = webviewHelpers.decorateChromeOptions(caps, opts, curDeviceId);
  await chromedriver.start(caps);
  return chromedriver;
}

Object.assign(extensions, commands, helpers);
export { commands, helpers, setupNewChromedriver };
export default extensions;
