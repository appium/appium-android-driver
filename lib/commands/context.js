/* eslint-disable require-await */
// @ts-check
import {util} from '@appium/support';
import Chromedriver from 'appium-chromedriver';
import {errors} from 'appium/driver';
import _ from 'lodash';
import {
  APP_STATE,
  CHROMIUM_WIN,
  KNOWN_CHROME_PACKAGE_NAMES,
  NATIVE_WIN,
  WEBVIEW_BASE,
  WEBVIEW_WIN,
  WebviewHelpers,
} from '../helpers';
import {mixin} from './mixins';
import net from 'node:net';
import {findAPortNotInUse} from 'portscanner';

const CHROMEDRIVER_AUTODOWNLOAD_FEATURE = 'chromedriver_autodownload';

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
 * @type {import('./mixins').ContextMixin & ThisType<import('../driver').AndroidDriver>}
 * @satisfies {import('@appium/types').ExternalDriver}
 */
const ContextMixin = {
  /* -------------------------------
   * Actual MJSONWP command handlers
   * ------------------------------- */
  async getCurrentContext() {
    // if the current context is `null`, indicating no context
    // explicitly set, it is the default context
    return this.curContext || this.defaultContextName();
  },

  async getContexts() {
    const webviewsMapping = await WebviewHelpers.getWebViewsMapping(
      this.adb,
      this.opts
    );
    return this.assignContexts(webviewsMapping);
  },

  async setContext(name) {
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

    const webviewsMapping = await WebviewHelpers.getWebViewsMapping(
      this.adb,
      this.opts
    );
    const contexts = this.assignContexts(webviewsMapping);
    // if the context we want doesn't exist, fail
    if (!_.includes(contexts, name)) {
      throw new errors.NoSuchContextError();
    }

    await this.switchContext(name, webviewsMapping);
    this.curContext = name;
  },

  async mobileGetContexts() {
    const opts = {
      androidDeviceSocket: this.opts.androidDeviceSocket,
      ensureWebviewsHavePages: true,
      webviewDevtoolsPort: this.opts.webviewDevtoolsPort,
      enableWebviewDetailsCollection: true,
    };
    return await WebviewHelpers.getWebViewsMapping(this.adb, opts);
  },

  assignContexts(webviewsMapping) {
    const opts = Object.assign({isChromeSession: this.isChromeSession}, this.opts);
    const webviews = WebviewHelpers.parseWebviewNames(webviewsMapping, opts);
    this.contexts = [NATIVE_WIN, ...webviews];
    this.log.debug(`Available contexts: ${JSON.stringify(this.contexts)}`);
    return this.contexts;
  },

  async switchContext(name, webviewsMapping) {
    // We have some options when it comes to webviews. If we want a
    // Chromedriver webview, we can only control one at a time.
    if (this.isChromedriverContext(name)) {
      // start proxying commands directly to chromedriver
      await this.startChromedriverProxy(name, webviewsMapping);
    } else if (this.isChromedriverContext(this.curContext)) {
      // if we're moving to a non-chromedriver webview, and our current context
      // _is_ a chromedriver webview, if caps recreateChromeDriverSessions is set
      // to true then kill chromedriver session using stopChromedriverProxies or
      // else simply suspend proxying to the latter
      if (this.opts.recreateChromeDriverSessions) {
        this.log.debug('recreateChromeDriverSessions set to true; killing existing chromedrivers');
        await this.stopChromedriverProxies();
      } else {
        this.suspendChromedriverProxy();
      }
    } else {
      throw new Error(`Didn't know how to handle switching to context '${name}'`);
    }
  },

  /* ---------------------------------
   * On-object context-related helpers
   * --------------------------------- */

  // The reason this is a function and not just a constant is that both android-
  // driver and selendroid-driver use this logic, and each one returns
  // a different default context name
  defaultContextName() {
    return NATIVE_WIN;
  },

  defaultWebviewName() {
    return WEBVIEW_BASE + (this.opts.autoWebviewName || this.opts.appPackage);
  },

  isWebContext() {
    return this.curContext !== null && this.curContext !== NATIVE_WIN;
  },

  // Turn on proxying to an existing Chromedriver session or a new one
  async startChromedriverProxy(context, webviewsMapping) {
    this.log.debug(`Connecting to chrome-backed webview context '${context}'`);

    let cd;
    if (this.sessionChromedrivers[context]) {
      // in the case where we've already set up a chromedriver for a context,
      // we want to reconnect to it, not create a whole new one
      this.log.debug(`Found existing Chromedriver for context '${context}'. Using it.`);
      cd = this.sessionChromedrivers[context];
      await this.setupExistingChromedriver(this.log, cd);
    } else {
      // XXX: this suppresses errors about putting arbitrary stuff on opts
      const opts = /** @type {any} */ (_.cloneDeep(this.opts));
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
        if (!opts.extractChromeAndroidPackageFromContextName) {
          if (
            _.has(this.opts, 'enableWebviewDetailsCollection') &&
            !this.opts.enableWebviewDetailsCollection
          ) {
            // When enableWebviewDetailsCollection capability is explicitly disabled, try to identify
            // chromeAndroidPackage based on contexts, known chrome variant packages and queryAppState result
            // since webviewsMapping does not have info object
            const contexts = webviewsMapping.map((wm) => wm.webviewName);
            for (const knownPackage of KNOWN_CHROME_PACKAGE_NAMES) {
              if (_.includes(contexts, `${WEBVIEW_BASE}${knownPackage}`)) {
                continue;
              }
              const appState = await this.queryAppState(knownPackage);
              if (
                _.includes(
                  [APP_STATE.RUNNING_IN_BACKGROUND, APP_STATE.RUNNING_IN_FOREGROUND],
                  appState
                )
              ) {
                opts.chromeAndroidPackage = knownPackage;
                this.log.debug(
                  `Identified chromeAndroidPackage as '${opts.chromeAndroidPackage}' ` +
                    `for context '${context}' by querying states of Chrome app packages`
                );
                break;
              }
            }
          } else {
            for (const wm of webviewsMapping) {
              if (wm.webviewName === context && _.has(wm?.info, 'Android-Package')) {
                // XXX: should be a type guard here
                opts.chromeAndroidPackage =
                  /** @type {NonNullable<import('./types').WebviewsMapping['info']>} */ (wm.info)[
                    'Android-Package'
                  ];
                this.log.debug(
                  `Identified chromeAndroidPackage as '${opts.chromeAndroidPackage}' ` +
                    `for context '${context}' by CDP`
                );
                break;
              }
            }
          }
        }
      }

      cd = await this.setupNewChromedriver(
        opts,
        /** @type {string} */ (this.adb.curDeviceId),
        this.adb,
        context
      );
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
    this.proxyCommand = /** @type {import('@appium/types').ExternalDriver['proxyCommand']} */ (
      this.chromedriver.jwproxy.command.bind(this.chromedriver.jwproxy)
    );
    this.jwpProxyActive = true;
  },

  // Stop proxying to any Chromedriver
  suspendChromedriverProxy() {
    this.chromedriver = undefined;
    this.proxyReqRes = undefined;
    this.proxyCommand = undefined;
    this.jwpProxyActive = false;
  },

  // Handle an out-of-band Chromedriver stop event
  async onChromedriverStop(context) {
    this.log.warn(`Chromedriver for context ${context} stopped unexpectedly`);
    if (context === this.curContext) {
      // we exited unexpectedly while automating the current context and so want
      // to shut down the session and respond with an error
      let err = new Error('Chromedriver quit unexpectedly during session');
      await this.startUnexpectedShutdown(err);
    } else {
      // if a Chromedriver in the non-active context barfs, we don't really
      // care, we'll just make a new one next time we need the context.
      this.log.warn(
        "Chromedriver quit unexpectedly, but it wasn't the active " + 'context, ignoring'
      );
      delete this.sessionChromedrivers[context];
    }
  },

  // Intentionally stop all the chromedrivers currently active, and ignore
  // their exit events
  async stopChromedriverProxies() {
    this.suspendChromedriverProxy(); // make sure we turn off the proxy flag
    for (let context of _.keys(this.sessionChromedrivers)) {
      let cd = this.sessionChromedrivers[context];
      this.log.debug(`Stopping chromedriver for context ${context}`);
      // stop listening for the stopped state event
      cd.removeAllListeners(Chromedriver.EVENT_CHANGED);
      try {
        await cd.stop();
      } catch (err) {
        this.log.warn(`Error stopping Chromedriver: ${/** @type {Error} */ (err).message}`);
      }
      delete this.sessionChromedrivers[context];
    }
  },

  isChromedriverContext(viewName) {
    return _.includes(viewName, WEBVIEW_WIN) || viewName === CHROMIUM_WIN;
  },

  shouldDismissChromeWelcome() {
    return (
      !!this.opts.chromeOptions &&
      _.isArray(this.opts.chromeOptions.args) &&
      this.opts.chromeOptions.args.includes('--no-first-run')
    );
  },

  async dismissChromeWelcome() {
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
        `This device did not show Chrome SignIn dialog, ${/** @type {Error} */ (e).message}`
      );
    }
  },

  async startChromeSession() {
    this.log.info('Starting a chrome-based browser session');
    // XXX: this suppresses errors about putting arbitrary stuff on opts
    const opts = /** @type {any} */ (_.cloneDeep(this.opts));

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
    this.chromedriver = await this.setupNewChromedriver(
      opts,
      /** @type {string} */ (this.adb.curDeviceId),
      this.adb
    );
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
    this.proxyCommand = /** @type {import('@appium/types').ExternalDriver['proxyCommand']} */ (
      this.chromedriver.jwproxy.command.bind(this.chromedriver.jwproxy)
    );
    this.jwpProxyActive = true;

    if (this.shouldDismissChromeWelcome()) {
      // dismiss Chrome welcome dialog
      await this.dismissChromeWelcome();
    }
  },

  /* --------------------------
   * Internal library functions
   * -------------------------- */

  async setupExistingChromedriver(log, chromedriver) {
    // check the status by sending a simple window-based command to ChromeDriver
    // if there is an error, we want to recreate the ChromeDriver session
    if (!(await chromedriver.hasWorkingWebview())) {
      log.debug('ChromeDriver is not associated with a window. ' + 'Re-initializing the session.');
      await chromedriver.restart();
    }
    return chromedriver;
  },

  async getChromedriverPort(portSpec, log) {
    // if the user didn't give us any specific information about chromedriver
    // port ranges, just find any free port
    if (!portSpec) {
      const port = await getFreePort();
      log?.debug(`A port was not given, using random free port: ${port}`);
      return port;
    }

    // otherwise find the free port based on a list or range provided by the user
    log?.debug(`Finding a free port for chromedriver using spec ${JSON.stringify(portSpec)}`);
    let foundPort = null;
    for (const potentialPort of portSpec) {
      /** @type {number} */
      let port;
      /** @type {number} */
      let stopPort;
      if (_.isArray(potentialPort)) {
        [port, stopPort] = potentialPort.map((p) => parseInt(String(p), 10));
      } else {
        port = parseInt(String(potentialPort), 10); // ensure we have a number and not a string
        stopPort = port;
      }
      log?.debug(`Checking port range ${port}:${stopPort}`);
      try {
        foundPort = await findAPortNotInUse(port, stopPort);
        break;
      } catch (e) {
        log?.debug(`Nothing in port range ${port}:${stopPort} was available`);
      }
    }

    if (foundPort === null) {
      throw new Error(
        `Could not find a free port for chromedriver using ` +
          `chromedriverPorts spec ${JSON.stringify(portSpec)}`
      );
    }

    log?.debug(`Using free port ${foundPort} for chromedriver`);
    return foundPort;
  },

  isChromedriverAutodownloadEnabled() {
    if (this.isFeatureEnabled(CHROMEDRIVER_AUTODOWNLOAD_FEATURE)) {
      return true;
    }
    this?.log?.debug(
      `Automated Chromedriver download is disabled. ` +
        `Use '${CHROMEDRIVER_AUTODOWNLOAD_FEATURE}' server feature to enable it`
    );
    return false;
  },

  async setupNewChromedriver(opts, curDeviceId, adb, context) {
    // @ts-ignore TODO: Remove the legacy
    if (opts.chromeDriverPort) {
      this?.log?.warn(
        `The 'chromeDriverPort' capability is deprecated. Please use 'chromedriverPort' instead`
      );
      // @ts-ignore TODO: Remove the legacy
      opts.chromedriverPort = opts.chromeDriverPort;
    }

    if (opts.chromedriverPort) {
      this?.log?.debug(`Using user-specified port ${opts.chromedriverPort} for chromedriver`);
    } else {
      // if a single port wasn't given, we'll look for a free one
      opts.chromedriverPort = await this.getChromedriverPort(opts.chromedriverPorts, this?.log);
    }

    const details = context ? WebviewHelpers.getWebviewDetails(adb, context) : undefined;
    if (!_.isEmpty(details)) {
      this?.log?.debug(
        'Passing web view details to the Chromedriver constructor: ' +
          JSON.stringify(details, null, 2)
      );
    }

    const chromedriver = new Chromedriver({
      port: String(opts.chromedriverPort),
      executable: opts.chromedriverExecutable,
      // eslint-disable-next-line object-shorthand
      adb: /** @type {any} */ (adb),
      cmdArgs: /** @type {string[]} */ (opts.chromedriverArgs),
      verbose: !!opts.showChromedriverLog,
      executableDir: opts.chromedriverExecutableDir,
      mappingPath: opts.chromedriverChromeMappingFile,
      // @ts-expect-error arbitrary value on opts?
      bundleId: opts.chromeBundleId,
      useSystemExecutable: opts.chromedriverUseSystemExecutable,
      disableBuildCheck: opts.chromedriverDisableBuildCheck,
      // @ts-expect-error FIXME: chromedriver typing are probably too strict
      details,
      isAutodownloadEnabled: this?.isChromedriverAutodownloadEnabled?.(),
    });

    // make sure there are chromeOptions
    opts.chromeOptions = opts.chromeOptions || {};
    // try out any prefixed chromeOptions,
    // and strip the prefix
    for (const opt of _.keys(opts)) {
      if (opt.endsWith(':chromeOptions')) {
        this?.log?.warn(
          `Merging '${opt}' into 'chromeOptions'. This may cause unexpected behavior`
        );
        _.merge(opts.chromeOptions, opts[opt]);
      }
    }

    const caps = /** @type {any} */ (
      WebviewHelpers.createChromedriverCaps(opts, curDeviceId, details)
    );
    this?.log?.debug(
      `Before starting chromedriver, androidPackage is '${caps.chromeOptions.androidPackage}'`
    );
    await chromedriver.start(caps);
    return chromedriver;
  },
};

mixin(ContextMixin);

export default ContextMixin;
export const setupNewChromedriver = ContextMixin.setupNewChromedriver;

/**
 * @typedef {import('appium-adb').ADB} ADB
 */
