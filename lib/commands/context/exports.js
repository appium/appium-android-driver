/* eslint-disable require-await */
import {util} from '@appium/support';
import Chromedriver from 'appium-chromedriver';
import {errors, PROTOCOLS} from 'appium/driver';
import _ from 'lodash';
import {
  CHROMIUM_WIN,
  KNOWN_CHROME_PACKAGE_NAMES,
  NATIVE_WIN,
  WEBVIEW_BASE,
  WEBVIEW_WIN,
  dismissChromeWelcome,
  getWebViewsMapping,
  parseWebviewNames,
  setupExistingChromedriver,
  setupNewChromedriver,
  shouldDismissChromeWelcome,
} from './helpers';
import {APP_STATE} from '../app-management';
import { BIDI_EVENT_NAME } from '../bidi/constants';
import { makeContextUpdatedEvent, makeObsoleteContextUpdatedEvent } from '../bidi/models';

// https://github.com/appium/appium/issues/20710
const DEFAULT_NATIVE_WINDOW_HANDLE = '1';

/**
 * @this {AndroidDriver}
 * @returns {Promise<string>}
 */
export async function getCurrentContext() {
  // if the current context is `null`, indicating no context
  // explicitly set, it is the default context
  return this.curContext || this.defaultContextName();
}

/**
 * @this {AndroidDriver}
 * @returns {Promise<string[]>}
 */
export async function getContexts() {
  const webviewsMapping = await getWebViewsMapping.bind(this)(this.opts);
  return this.assignContexts(webviewsMapping);
}

/**
 * @this {AndroidDriver}
 * @param {string?} name
 * @returns {Promise<void>}
 */
export async function setContext(name) {
  let newContext = name;
  if (!util.hasValue(newContext)) {
    newContext = this.defaultContextName();
  } else if (newContext === WEBVIEW_WIN) {
    // handle setContext "WEBVIEW"
    newContext = this.defaultWebviewName();
  }
  // if we're already in the context we want, do nothing
  if (newContext === this.curContext) {
    return;
  }

  const webviewsMapping = await getWebViewsMapping.bind(this)(this.opts);
  const contexts = this.assignContexts(webviewsMapping);
  // if the context we want doesn't exist, fail
  if (!_.includes(contexts, newContext)) {
    throw new errors.NoSuchContextError();
  }

  await this.switchContext(newContext, webviewsMapping);
  this.curContext = newContext;
  await this.notifyBiDiContextChange();
}

/**
 * @this {AndroidDriver}
 * @param {any} [opts={}]
 * @returns {Promise<import('../types').WebviewsMapping[]>}
 */
export async function mobileGetContexts(opts = {}) {
  const _opts = {
    androidDeviceSocket: this.opts.androidDeviceSocket,
    ensureWebviewsHavePages: true,
    webviewDevtoolsPort: this.opts.webviewDevtoolsPort,
    enableWebviewDetailsCollection: true,
    waitForWebviewMs: opts.waitForWebviewMs || 0,
  };
  return await getWebViewsMapping.bind(this)(_opts);
}

/**
 * @this {AndroidDriver}
 * @param {import('../types').WebviewsMapping[]} webviewsMapping
 * @returns {string[]}
 */
export function assignContexts(webviewsMapping) {
  const opts = Object.assign({isChromeSession: this.isChromeSession}, this.opts);
  const webviews = parseWebviewNames.bind(this)(webviewsMapping, opts);
  this.contexts = [NATIVE_WIN, ...webviews];
  this.log.debug(`Available contexts: ${JSON.stringify(this.contexts)}`);
  return this.contexts;
}

/**
 * @this {AndroidDriver}
 * @param {string} name
 * @param {import('../types').WebviewsMapping[]} webviewsMapping
 * @returns {Promise<void>}
 */
export async function switchContext(name, webviewsMapping) {
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
}

/**
 * @this {AndroidDriver}
 * @returns {string}
 */
export function defaultContextName() {
  return NATIVE_WIN;
}

/**
 * @this {AndroidDriver}
 * @returns {string}
 */
export function defaultWebviewName() {
  return WEBVIEW_BASE + (this.opts.autoWebviewName || this.opts.appPackage);
}

/**
 * @this {AndroidDriver}
 * @returns {boolean}
 */
export function isWebContext() {
  return this.curContext !== null && this.curContext !== NATIVE_WIN;
}

/**
 * @this {AndroidDriver}
 * @returns {Promise<string>}
 */
export async function getWindowHandle() {
  if (!this.isWebContext()) {
    return DEFAULT_NATIVE_WINDOW_HANDLE;
  }

  const chromedriver = /** @type {Chromedriver} */ (this.chromedriver);
  const isJwp = chromedriver.jwproxy.downstreamProtocol === PROTOCOLS.MJSONWP;
  const endpoint = isJwp ? '/window_handle' : '/window/handle';
  return /** @type {string} */ (await chromedriver.jwproxy.command(endpoint, 'GET'));
}

/**
 * @this {AndroidDriver}
 * @returns {Promise<string[]>}
 */
export async function getWindowHandles() {
  if (!this.isWebContext()) {
    return [DEFAULT_NATIVE_WINDOW_HANDLE];
  }

  const chromedriver = /** @type {Chromedriver} */ (this.chromedriver);
  const isJwp = chromedriver.jwproxy.downstreamProtocol === PROTOCOLS.MJSONWP;
  const endpoint = isJwp ? '/window_handles' : '/window/handles';
  return /** @type {string[]} */ (await chromedriver.jwproxy.command(endpoint, 'GET'));
}

/**
 * @this {AndroidDriver}
 * @param {string} handle
 * @returns {Promise<void>}
 */
export async function setWindow(handle) {
  if (!this.isWebContext()) {
    return;
  }

  const chromedriver = /** @type {Chromedriver} */ (this.chromedriver);
  const isJwp = chromedriver.jwproxy.downstreamProtocol === PROTOCOLS.MJSONWP;
  const paramName = isJwp ? 'name' : 'handle';
  await chromedriver.jwproxy.command('/window', 'POST', {[paramName]: handle});
}

/**
 * Turn on proxying to an existing Chromedriver session or a new one
 *
 * @this {AndroidDriver}
 * @param {string} context
 * @param {import('../types').WebviewsMapping[]} webviewsMapping
 * @returns {Promise<void>}
 */
export async function startChromedriverProxy(context, webviewsMapping) {
  this.log.debug(`Connecting to chrome-backed webview context '${context}'`);

  let cd;
  if (this.sessionChromedrivers[context]) {
    // in the case where we've already set up a chromedriver for a context,
    // we want to reconnect to it, not create a whole new one
    this.log.debug(`Found existing Chromedriver for context '${context}'. Using it.`);
    cd = this.sessionChromedrivers[context];
    await setupExistingChromedriver.bind(this)(cd);
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
                appState,
              )
            ) {
              opts.chromeAndroidPackage = knownPackage;
              this.log.debug(
                `Identified chromeAndroidPackage as '${opts.chromeAndroidPackage}' ` +
                  `for context '${context}' by querying states of Chrome app packages`,
              );
              break;
            }
          }
        } else {
          for (const wm of webviewsMapping) {
            if (wm.webviewName === context && _.has(wm?.info, 'Android-Package')) {
              // XXX: should be a type guard here
              opts.chromeAndroidPackage =
                /** @type {NonNullable<import('../types').WebviewsMapping['info']>} */ (wm.info)[
                  'Android-Package'
                ];
              this.log.debug(
                `Identified chromeAndroidPackage as '${opts.chromeAndroidPackage}' ` +
                  `for context '${context}' by CDP`,
              );
              break;
            }
          }
        }
      }
    }

    cd = await setupNewChromedriver.bind(this)(
      opts,
      /** @type {string} */ (this.adb.curDeviceId),
      context,
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
  // @ts-ignore chromedriver is defined
  this.proxyReqRes = this.chromedriver.proxyReq.bind(this.chromedriver);
  this.proxyCommand = /** @type {import('@appium/types').ExternalDriver['proxyCommand']} */ (
    // @ts-ignore chromedriver is defined
    this.chromedriver.jwproxy.command.bind(this.chromedriver.jwproxy)
  );
  this.jwpProxyActive = true;
}

/**
 * Stop proxying to any Chromedriver
 *
 * @this {AndroidDriver}
 * @returns {void}
 */
export function suspendChromedriverProxy() {
  this.chromedriver = undefined;
  this.proxyReqRes = undefined;
  this.proxyCommand = undefined;
  this.jwpProxyActive = false;
}

/**
 * Handle an out-of-band Chromedriver stop event
 *
 * @this {AndroidDriver}
 * @param {string} context
 * @returns {Promise<void>}
 */
export async function onChromedriverStop(context) {
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
      "Chromedriver quit unexpectedly, but it wasn't the active " + 'context, ignoring',
    );
    delete this.sessionChromedrivers[context];
  }
}

/**
 * Intentionally stop all the chromedrivers currently active, and ignore
 * their exit events
 *
 * @this {AndroidDriver}
 * @returns {Promise<void>}
 */
export async function stopChromedriverProxies() {
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
}

/**
 * @this {AndroidDriver}
 * @param {string} viewName
 * @returns {boolean}
 */
export function isChromedriverContext(viewName) {
  return _.includes(viewName, WEBVIEW_WIN) || viewName === CHROMIUM_WIN;
}

/**
 * https://github.com/appium/appium/issues/20741
 *
 * @this {AndroidDriver}
 * @returns {Promise<void>}
 */
export async function notifyBiDiContextChange() {
  const name = await this.getCurrentContext();
  this.eventEmitter.emit(BIDI_EVENT_NAME, makeContextUpdatedEvent(_.toLower(String(this.opts.automationName)), name));
  this.eventEmitter.emit(BIDI_EVENT_NAME, makeObsoleteContextUpdatedEvent(name));
}

/**
 * @this {AndroidDriver}
 * @returns {Promise<void>}
 */
export async function startChromeSession() {
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
  this.chromedriver = await setupNewChromedriver.bind(this)(
    opts,
    /** @type {string} */ (this.adb.curDeviceId),
  );
  // @ts-ignore chromedriver is defined
  this.chromedriver.on(Chromedriver.EVENT_CHANGED, (msg) => {
    if (msg.state === Chromedriver.STATE_STOPPED) {
      this.onChromedriverStop(CHROMIUM_WIN);
    }
  });

  // Now that we have a Chrome session, we ensure that the context is
  // appropriately set and that this chromedriver is added to the list
  // of session chromedrivers so we can switch back and forth
  this.curContext = CHROMIUM_WIN;
  // @ts-ignore chromedriver is defined
  this.sessionChromedrivers[CHROMIUM_WIN] = this.chromedriver;
  // @ts-ignore chromedriver should be defined
  this.proxyReqRes = this.chromedriver.proxyReq.bind(this.chromedriver);
  this.proxyCommand = /** @type {import('@appium/types').ExternalDriver['proxyCommand']} */ (
    // @ts-ignore chromedriver is defined
    this.chromedriver.jwproxy.command.bind(this.chromedriver.jwproxy)
  );
  this.jwpProxyActive = true;

  if (shouldDismissChromeWelcome.bind(this)()) {
    // dismiss Chrome welcome dialog
    await dismissChromeWelcome.bind(this)();
  }
}

/**
 * @typedef {import('appium-adb').ADB} ADB
 * @typedef {import('../../driver').AndroidDriver} AndroidDriver
 */
