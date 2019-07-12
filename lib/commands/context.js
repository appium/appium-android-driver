import _ from 'lodash';
import log from '../logger';
import Chromedriver from 'appium-chromedriver';
import PortFinder from 'portfinder';
import B from 'bluebird';
import { util } from 'appium-support';
import { errors } from 'appium-base-driver';
import {
  default as webviewHelpers,
  NATIVE_WIN, WEBVIEW_BASE, WEBVIEW_WIN, CHROMIUM_WIN
} from '../webview-helpers';

const CHROMEDRIVER_AUTODOWNLOAD_FEATURE = 'chromedriver_autodownload';

let commands = {}, helpers = {}, extensions = {};


/* -------------------------------
 * Actual MJSONWP command handlers
 * ------------------------------- */
commands.getCurrentContext = async function getCurrentContext () { // eslint-disable-line require-await
  // if the current context is `null`, indicating no context
  // explicitly set, it is the default context
  return this.curContext || this.defaultContextName();
};

commands.getContexts = async function getContexts () {
  let webviews;
  if (this.isChromeSession) {
    // if we have a Chrome browser session, we only care about the Chrome
    // context and the native context
    webviews = [CHROMIUM_WIN];
  } else {
    // otherwise we use ADB to figure out which webviews are available
    webviews = await webviewHelpers.getWebviews(this.adb, this.opts);
  }
  this.contexts = _.union([NATIVE_WIN], webviews);
  log.debug(`Available contexts: ${JSON.stringify(this.contexts)}`);
  return this.contexts;
};

commands.setContext = async function setContext (name) {
  if (!util.hasValue(name)) {
    name = this.defaultContextName();
  } else if (name === WEBVIEW_WIN) {
    // handle setContext "WEBVIEW"
    name = this.defaultWebviewName();
  }
  // if we're already in the context we want, do nothing
  if (name === this.curContext) {
    return;
  }

  let contexts = await this.getContexts();
  // if the context we want doesn't exist, fail
  if (!_.includes(contexts, name)) {
    throw new errors.NoSuchContextError();
  }

  await this.switchContext(name);
  this.curContext = name;
};

helpers.switchContext = async function switchContext (name) {
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
      log.debug('recreateChromeDriverSessions set to true; killing existing chromedrivers');
      await this.stopChromedriverProxies();
    } else {
      await this.suspendChromedriverProxy();
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
helpers.defaultContextName = function defaultContextName () {
  return NATIVE_WIN;
};

helpers.defaultWebviewName = function defaultWebviewName () {
  return WEBVIEW_BASE + this.opts.appPackage;
};

helpers.isWebContext = function isWebContext () {
  return this.curContext !== null && this.curContext !== NATIVE_WIN;
};

// Turn on proxying to an existing Chromedriver session or a new one
helpers.startChromedriverProxy = async function startChromedriverProxy (context) {
  log.debug(`Connecting to chrome-backed webview context '${context}'`);

  let cd;
  if (this.sessionChromedrivers[context]) {
    // in the case where we've already set up a chromedriver for a context,
    // we want to reconnect to it, not create a whole new one
    log.debug(`Found existing Chromedriver for context '${context}'. Using it.`);
    cd = this.sessionChromedrivers[context];
    await setupExistingChromedriver(cd);
  } else {
    let opts = _.cloneDeep(this.opts);
    opts.chromeUseRunningApp = true;

    // if requested, tell chromedriver to attach to the android package we have
    // associated with the context name, rather than the package of the AUT.
    // And turn this on by default for chrome--if chrome pops up with a webview
    // and someone wants to switch to it, we should let chromedriver connect to
    // chrome rather than staying stuck on the AUT
    if (opts.extractChromeAndroidPackageFromContextName || context === `${WEBVIEW_BASE}chrome`) {
      let androidPackage = context.match(`${WEBVIEW_BASE}(.+)`);
      if (androidPackage && androidPackage.length > 0) {
        opts.chromeAndroidPackage = androidPackage[1];
      }
    }

    cd = await this.setupNewChromedriver(opts, this.adb.curDeviceId, this.adb);
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
helpers.suspendChromedriverProxy = function suspendChromedriverProxy () {
  this.chromedriver = null;
  this.proxyReqRes = null;
  this.jwpProxyActive = false;
};

// Handle an out-of-band Chromedriver stop event
helpers.onChromedriverStop = async function onChromedriverStop (context) {
  log.warn(`Chromedriver for context ${context} stopped unexpectedly`);
  if (context === this.curContext) {
    // we exited unexpectedly while automating the current context and so want
    // to shut down the session and respond with an error
    let err = new Error('Chromedriver quit unexpectedly during session');
    await this.startUnexpectedShutdown(err);
  } else {
    // if a Chromedriver in the non-active context barfs, we don't really
    // care, we'll just make a new one next time we need the context.
    log.warn("Chromedriver quit unexpectedly, but it wasn't the active " +
                'context, ignoring');
    delete this.sessionChromedrivers[context];
  }
};

// Intentionally stop all the chromedrivers currently active, and ignore
// their exit events
helpers.stopChromedriverProxies = async function stopChromedriverProxies () {
  this.suspendChromedriverProxy(); // make sure we turn off the proxy flag
  for (let context of _.keys(this.sessionChromedrivers)) {
    let cd = this.sessionChromedrivers[context];
    log.debug(`Stopping chromedriver for context ${context}`);
    // stop listening for the stopped state event
    cd.removeAllListeners(Chromedriver.EVENT_CHANGED);
    try {
      await cd.stop();
    } catch (err) {
      log.warn(`Error stopping Chromedriver: ${err.message}`);
    }
    delete this.sessionChromedrivers[context];
  }
};

helpers.isChromedriverContext = function isChromedriverContext (viewName) {
  return _.includes(viewName, WEBVIEW_WIN) || viewName === CHROMIUM_WIN;
};

helpers.shouldDismissChromeWelcome = function shouldDismissChromeWelcome () {
  return !!this.opts.chromeOptions &&
         _.isArray(this.opts.chromeOptions.args) &&
         this.opts.chromeOptions.args.includes('--no-first-run');
};

helpers.dismissChromeWelcome = async function dismissChromeWelcome () {
  log.info('Trying to dismiss Chrome welcome');
  let activity = await this.getCurrentActivity();
  if (activity !== 'org.chromium.chrome.browser.firstrun.FirstRunActivity') {
    log.info('Chrome welcome dialog never showed up! Continuing');
    return;
  }
  let el = await this.findElOrEls('id', 'com.android.chrome:id/terms_accept', false);
  await this.click(el.ELEMENT);
  try {
    let el = await this.findElOrEls('id', 'com.android.chrome:id/negative_button', false);
    await this.click(el.ELEMENT);
  } catch (e) {
    // DO NOTHING, THIS DEVICE DIDNT LAUNCH THE SIGNIN DIALOG
    // IT MUST BE A NON GMS DEVICE
    log.warn(`This device did not show Chrome SignIn dialog, ${e.message}`);
  }
};

// extract so sub-classes can decide
helpers.shouldUseChromeRunningApp = function shouldUseChromeRunningApp () {
  return false;
};

helpers.startChromeSession = async function startChromeSession () {
  log.info('Starting a chrome-based browser session');
  let opts = _.cloneDeep(this.opts);

  opts.chromeUseRunningApp = this.shouldUseChromeRunningApp();

  const knownPackages = [
    'org.chromium.chrome.shell',
    'com.android.chrome',
    'com.chrome.beta',
    'org.chromium.chrome',
    'org.chromium.webview_shell',
  ];

  if (_.includes(knownPackages, this.opts.appPackage)) {
    opts.chromeBundleId = this.opts.appPackage;
  } else {
    opts.chromeAndroidActivity = this.opts.appActivity;
  }
  this.chromedriver = await this.setupNewChromedriver(opts, this.adb.curDeviceId, this.adb);
  this.chromedriver.on(Chromedriver.EVENT_CHANGED, (msg) => {
    if (msg.state === Chromedriver.STATE_STOPPED) {
      this.onChromedriverStop(CHROMIUM_WIN);
    }
  });

  // Now that we have a Chrome session, we ensure that the context is
  // appropriately set and that this chromedriver is added to the list
  // of session chromedrivers so we can switch back and forth
  this.curContext = CHROMIUM_WIN;
  this.sessionChromedrivers[CHROMIUM_WIN] = this.chromedriver;
  this.proxyReqRes = this.chromedriver.proxyReq.bind(this.chromedriver);
  this.jwpProxyActive = true;

  if (this.shouldDismissChromeWelcome()) {
    // dismiss Chrome welcome dialog
    await this.dismissChromeWelcome();
  }
};


/* --------------------------
 * Internal library functions
 * -------------------------- */

async function setupExistingChromedriver (chromedriver) {
  // check the status by sending a simple window-based command to ChromeDriver
  // if there is an error, we want to recreate the ChromeDriver session
  if (!await chromedriver.hasWorkingWebview()) {
    log.debug('ChromeDriver is not associated with a window. ' +
                 'Re-initializing the session.');
    await chromedriver.restart();
  }
  return chromedriver;
}

/**
 * Find a free port to have Chromedriver listen on.
 *
 * @param {array} [portSpec] - Array which is a list of ports. A list item may
 * also itself be an array of length 2 specifying a start and end port of
 * a range. Some valid port specs:
 *    - [8000, 8001, 8002]
 *    - [[8000, 8005]]
 *    - [8000, [9000, 9100]]
 *
 * @return {number} A free port
 */
async function getChromedriverPort (portSpec) {
  const getPort = B.promisify(PortFinder.getPort, {context: PortFinder});

  // if the user didn't give us any specific information about chromedriver
  // port ranges, just find any free port
  if (!portSpec) {
    const port = await getPort();
    log.debug(`A port was not given, using random free port: ${port}`);
    return port;
  }

  // otherwise find the free port based on a list or range provided by the user
  log.debug(`Finding a free port for chromedriver using spec ${JSON.stringify(portSpec)}`);
  let foundPort = null;
  for (const potentialPort of portSpec) {
    let port, stopPort;
    if (_.isArray(potentialPort)) {
      ([port, stopPort] = potentialPort);
    } else {
      port = parseInt(potentialPort, 10); // ensure we have a number and not a string
      stopPort = port;
    }
    try {
      log.debug(`Checking port range ${port}:${stopPort}`);
      foundPort = await getPort({port, stopPort});
      break;
    } catch (e) {
      log.debug(`Nothing in port range ${port}:${stopPort} was available`);
    }
  }

  if (foundPort === null) {
    throw new Error(`Could not find a free port for chromedriver using ` +
                    `chromedriverPorts spec ${JSON.stringify(portSpec)}`);
  }

  log.debug(`Using free port ${foundPort} for chromedriver`);
  return foundPort;
}

helpers.isChromedriverAutodownloadEnabled = function isChromedriverAutodownloadEnabled () {
  if (this.isFeatureEnabled(CHROMEDRIVER_AUTODOWNLOAD_FEATURE)) {
    return true;
  }
  log.debug(`Automated Chromedriver download is disabled. ` +
    `Use '${CHROMEDRIVER_AUTODOWNLOAD_FEATURE}' server feature to enable it`);
  return false;
};

helpers.setupNewChromedriver = async function setupNewChromedriver (opts, curDeviceId, adb) {
  if (opts.chromeDriverPort) {
    log.warn(`The 'chromeDriverPort' capability is deprecated. Please use 'chromedriverPort' instead`);
    opts.chromedriverPort = opts.chromeDriverPort;
  }

  if (opts.chromedriverPort) {
    log.debug(`Using user-specified port ${opts.chromedriverPort} for chromedriver`);
  } else {
    // if a single port wasn't given, we'll look for a free one
    opts.chromedriverPort = await getChromedriverPort(opts.chromedriverPorts);
  }

  const chromedriver = new Chromedriver({
    port: opts.chromedriverPort,
    executable: opts.chromedriverExecutable,
    adb,
    cmdArgs: opts.chromedriverArgs,
    verbose: !!opts.showChromedriverLog,
    executableDir: opts.chromedriverExecutableDir,
    mappingPath: opts.chromedriverChromeMappingFile,
    bundleId: opts.chromeBundleId,
    useSystemExecutable: opts.chromedriverUseSystemExecutable,
    disableBuildCheck: opts.chromedriverDisableBuildCheck,
    isAutodownloadEnabled: (this || {}).isChromedriverAutodownloadEnabled
      ? this.isChromedriverAutodownloadEnabled() : undefined,
  });

  // make sure there are chromeOptions
  opts.chromeOptions = opts.chromeOptions || {};
  // try out any prefixed chromeOptions,
  // and strip the prefix
  for (const opt of _.keys(opts)) {
    if (opt.endsWith(':chromeOptions')) {
      log.warn(`Merging '${opt}' into 'chromeOptions'. This may cause unexpected behavior`);
      _.merge(opts.chromeOptions, opts[opt]);
    }
  }

  let caps = {
    chromeOptions: {
      androidPackage: opts.chromeOptions.androidPackage || opts.appPackage,
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
  if (opts.loggingPrefs) {
    caps.loggingPrefs = opts.loggingPrefs;
  }
  if (opts.enablePerformanceLogging) {
    log.warn(`The 'enablePerformanceLogging' cap is deprecated; simply use ` +
             `the 'loggingPrefs' cap instead, with a 'performance' key set to 'ALL'`);
    const newPref = {performance: 'ALL'};

    // don't overwrite other logging prefs that have been sent in if they exist
    caps.loggingPrefs = caps.loggingPrefs ?
      Object.assign({}, caps.loggingPrefs, newPref) :
      newPref;
  }
  if (opts.browserName === 'chromium-webview') {
    caps.chromeOptions.androidActivity = opts.appActivity;
  }
  if (opts.pageLoadStrategy) {
    caps.pageLoadStrategy = opts.pageLoadStrategy;
  }
  const pkg = caps.chromeOptions.androidPackage;
  if ((pkg && pkg.toLowerCase()) === 'chrome') {
    // if we have extracted package from context name, it could come in as bare
    // "chrome", and so we should make sure the details are correct, including
    // not using an activity or process id
    caps.chromeOptions.androidPackage = 'com.android.chrome';
    delete caps.chromeOptions.androidActivity;
    delete caps.chromeOptions.androidProcess;
  }
  caps = webviewHelpers.decorateChromeOptions(caps, opts, curDeviceId);
  log.debug(`Before starting chromedriver, androidPackage is '${caps.chromeOptions.androidPackage}'`);
  await chromedriver.start(caps);
  return chromedriver;
};
const setupNewChromedriver = helpers.setupNewChromedriver;


Object.assign(extensions, commands, helpers);
export { commands, helpers, setupNewChromedriver };
export default extensions;
