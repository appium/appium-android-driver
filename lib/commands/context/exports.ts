import {util} from '@appium/support';
import {Chromedriver} from 'appium-chromedriver';
import {errors, PROTOCOLS} from 'appium/driver';
import type {StringRecord} from '@appium/types';
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
import {BIDI_EVENT_NAME} from '../bidi/constants';
import {makeContextUpdatedEvent, makeObsoleteContextUpdatedEvent} from '../bidi/models';
import type {AndroidDriver} from '../../driver';
import type {WebviewsMapping} from '../types';

// https://github.com/appium/appium/issues/20710
const DEFAULT_NATIVE_WINDOW_HANDLE = '1';

/**
 * Gets the current context name. Returns the default context if no context is explicitly set.
 *
 * @returns The current context name
 */
export async function getCurrentContext(this: AndroidDriver): Promise<string> {
  // if the current context is `null`, indicating no context
  // explicitly set, it is the default context
  return this.curContext || this.defaultContextName();
}

/**
 * Gets a list of all available contexts (native and webviews).
 *
 * @returns An array of context names
 */
export async function getContexts(this: AndroidDriver): Promise<string[]> {
  const webviewsMapping = await getWebViewsMapping.bind(this)(this.opts);
  return this.assignContexts(webviewsMapping);
}

/**
 * Sets the current context to the specified context name.
 *
 * @param name - The context name to switch to. If not provided or null, defaults to the native context.
 *               If "WEBVIEW", uses the default webview name.
 * @throws {errors.NoSuchContextError} If the specified context does not exist
 */
export async function setContext(this: AndroidDriver, name?: string | null): Promise<void> {
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
 * Gets a detailed list of all available webview contexts with their mapping information.
 *
 * @param waitForWebviewMs - Optional timeout in milliseconds to wait for webviews to appear
 * @returns An array of webview mapping objects containing detailed information about each webview
 */
export async function mobileGetContexts(
  this: AndroidDriver,
  waitForWebviewMs?: number,
): Promise<WebviewsMapping[]> {
  const _opts = {
    androidDeviceSocket: this.opts.androidDeviceSocket,
    ensureWebviewsHavePages: true,
    webviewDevtoolsPort: this.opts.webviewDevtoolsPort,
    enableWebviewDetailsCollection: true,
    waitForWebviewMs: waitForWebviewMs || 0,
  };
  return await getWebViewsMapping.bind(this)(_opts);
}

/**
 * Assigns and returns a list of available contexts based on the webviews mapping.
 *
 * @param webviewsMapping - Array of webview mapping objects
 * @returns An array of context names (always includes NATIVE_APP as the first element)
 */
export function assignContexts(
  this: AndroidDriver,
  webviewsMapping: WebviewsMapping[],
): string[] {
  const opts = {isChromeSession: this.isChromeSession, ...this.opts};
  const webviews = parseWebviewNames.bind(this)(webviewsMapping, opts);
  this.contexts = [NATIVE_WIN, ...webviews];
  this.log.debug(`Available contexts: ${JSON.stringify(this.contexts)}`);
  return this.contexts;
}

/**
 * Switches to the specified context. Handles Chromedriver proxy setup/teardown as needed.
 *
 * @param name - The context name to switch to
 * @param webviewsMapping - Array of webview mapping objects
 * @throws {Error} If the context cannot be handled
 */
export async function switchContext(
  this: AndroidDriver,
  name: string,
  webviewsMapping: WebviewsMapping[],
): Promise<void> {
  this._bidiProxyUrl = null;
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
 * Returns the default native context name.
 *
 * @returns The native context name ("NATIVE_APP")
 */
export function defaultContextName(this: AndroidDriver): string {
  return NATIVE_WIN;
}

/**
 * Returns the default webview name based on the app package or auto webview name option.
 *
 * @returns The default webview name
 */
export function defaultWebviewName(this: AndroidDriver): string {
  return WEBVIEW_BASE + (this.opts.autoWebviewName || this.opts.appPackage);
}

/**
 * Checks if the current context is a web context (not native).
 *
 * @returns True if the current context is a webview, false otherwise
 */
export function isWebContext(this: AndroidDriver): boolean {
  return this.curContext !== null && this.curContext !== NATIVE_WIN;
}

/**
 * Gets the current window handle. Returns a default handle for native contexts.
 *
 * @returns The current window handle
 */
export async function getWindowHandle(this: AndroidDriver): Promise<string> {
  if (!this.isWebContext()) {
    return DEFAULT_NATIVE_WINDOW_HANDLE;
  }

  const chromedriver = this.chromedriver as Chromedriver;
  const isJwp = chromedriver.jwproxy.downstreamProtocol === PROTOCOLS.MJSONWP;
  const endpoint = isJwp ? '/window_handle' : '/window/handle';
  return (await chromedriver.jwproxy.command(endpoint, 'GET')) as string;
}

/**
 * Gets all available window handles. Returns a default handle for native contexts.
 *
 * @returns An array of window handles
 */
export async function getWindowHandles(this: AndroidDriver): Promise<string[]> {
  if (!this.isWebContext()) {
    return [DEFAULT_NATIVE_WINDOW_HANDLE];
  }

  const chromedriver = this.chromedriver as Chromedriver;
  const isJwp = chromedriver.jwproxy.downstreamProtocol === PROTOCOLS.MJSONWP;
  const endpoint = isJwp ? '/window_handles' : '/window/handles';
  return (await chromedriver.jwproxy.command(endpoint, 'GET')) as string[];
}

/**
 * Sets the current window to the specified handle. Does nothing for native contexts.
 *
 * @param handle - The window handle to switch to
 */
export async function setWindow(this: AndroidDriver, handle: string): Promise<void> {
  if (!this.isWebContext()) {
    return;
  }

  const chromedriver = this.chromedriver as Chromedriver;
  const isJwp = chromedriver.jwproxy.downstreamProtocol === PROTOCOLS.MJSONWP;
  const paramName = isJwp ? 'name' : 'handle';
  await chromedriver.jwproxy.command('/window', 'POST', {[paramName]: handle});
}

/**
 * Turns on proxying to an existing Chromedriver session or creates a new one.
 *
 * @param context - The context name to connect to
 * @param webviewsMapping - Array of webview mapping objects
 */
export async function startChromedriverProxy(
  this: AndroidDriver,
  context: string,
  webviewsMapping: WebviewsMapping[],
): Promise<void> {
  this.log.debug(`Connecting to chrome-backed webview context '${context}'`);

  let cd: Chromedriver;
  if (this.sessionChromedrivers[context]) {
    // in the case where we've already set up a chromedriver for a context,
    // we want to reconnect to it, not create a whole new one
    this.log.debug(`Found existing Chromedriver for context '${context}'. Using it.`);
    cd = this.sessionChromedrivers[context];
    await setupExistingChromedriver.bind(this)(cd, context);
  } else {
    // XXX: this suppresses errors about putting arbitrary stuff on opts
    const opts = _.cloneDeep(this.opts) as any;
    opts.chromeUseRunningApp = true;

    // if requested, tell chromedriver to attach to the android package we have
    // associated with the context name, rather than the package of the AUT.
    // And turn this on by default for chrome--if chrome pops up with a webview
    // and someone wants to switch to it, we should let chromedriver connect to
    // chrome rather than staying stuck on the AUT
    if (opts.extractChromeAndroidPackageFromContextName || context === `${WEBVIEW_BASE}chrome`) {
      const androidPackage = context.match(`${WEBVIEW_BASE}(.+)`);
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
              opts.chromeAndroidPackage = (wm.info as NonNullable<WebviewsMapping['info']>)[
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
      this.adb.curDeviceId as string,
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
  this.proxyReqRes = this.chromedriver.proxyReq.bind(this.chromedriver);
  this.proxyCommand = this.chromedriver.jwproxy.command.bind(
    this.chromedriver.jwproxy,
  ) as typeof this.proxyCommand;
  this.jwpProxyActive = true;
}

/**
 * Stops proxying to any Chromedriver and clears the proxy state.
 */
export function suspendChromedriverProxy(this: AndroidDriver): void {
  this.chromedriver = undefined;
  this.proxyReqRes = undefined;
  this.proxyCommand = undefined;
  this.jwpProxyActive = false;
}

/**
 * Handles an out-of-band Chromedriver stop event.
 * If the stopped context is the current context, triggers an unexpected shutdown.
 * Otherwise, logs a warning and removes the context from the session.
 *
 * @param context - The context name where Chromedriver stopped
 */
export async function onChromedriverStop(this: AndroidDriver, context: string): Promise<void> {
  this.log.warn(`Chromedriver for context ${context} stopped unexpectedly`);
  if (context === this.curContext) {
    // we exited unexpectedly while automating the current context and so want
    // to shut down the session and respond with an error
    const err = new Error('Chromedriver quit unexpectedly during session');
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
 * Intentionally stops all the chromedrivers currently active and ignores their exit events.
 */
export async function stopChromedriverProxies(this: AndroidDriver): Promise<void> {
  this.suspendChromedriverProxy(); // make sure we turn off the proxy flag
  for (const context of _.keys(this.sessionChromedrivers)) {
    const cd = this.sessionChromedrivers[context];
    this.log.debug(`Stopping chromedriver for context ${context}`);
    // stop listening for the stopped state event
    cd.removeAllListeners(Chromedriver.EVENT_CHANGED);
    try {
      await cd.stop();
    } catch (err) {
      this.log.warn(`Error stopping Chromedriver: ${(err as Error).message}`);
    }
    delete this.sessionChromedrivers[context];
  }
}

/**
 * Checks if a context name represents a Chromedriver-backed webview context.
 *
 * @param viewName - The context name to check
 * @returns True if the context is a Chromedriver context, false otherwise
 */
export function isChromedriverContext(this: AndroidDriver, viewName: string): boolean {
  return _.includes(viewName, WEBVIEW_WIN) || viewName === CHROMIUM_WIN;
}

/**
 * Notifies BiDi clients about a context change event.
 * See https://github.com/appium/appium/issues/20741
 */
export async function notifyBiDiContextChange(this: AndroidDriver): Promise<void> {
  const name = await this.getCurrentContext();
  this.eventEmitter.emit(
    BIDI_EVENT_NAME,
    makeContextUpdatedEvent(_.toLower(String(this.opts.automationName)), name),
  );
  this.eventEmitter.emit(BIDI_EVENT_NAME, makeObsoleteContextUpdatedEvent(name));
}

/**
 * Gets the ChromeDriver session capabilities for the current webview context.
 *
 * @returns The ChromeDriver session capabilities
 * @throws {errors.InvalidContextError} If not in a webview context
 * @throws {Error} If no ChromeDriver session capabilities are found
 */
export async function mobileGetChromeCapabilities(this: AndroidDriver): Promise<StringRecord> {
  if (!this.isWebContext()) {
    throw new errors.InvalidContextError(
      'mobile: getChromeCapabilities can only be called in a webview context',
    );
  }

  const currentContext = await this.getCurrentContext();
  const sessionCaps = this._chromedriverCapsCache.get(currentContext);
  if (!sessionCaps) {
    throw new Error(
      `No ChromeDriver session capabilities found for context '${currentContext}'. ` +
        'The ChromeDriver session may not have been initialized yet.',
    );
  }
  return sessionCaps;
}

/**
 * Starts a Chrome-based browser session and sets up the Chromedriver proxy.
 */
export async function startChromeSession(this: AndroidDriver): Promise<void> {
  this.log.info('Starting a chrome-based browser session');
  // XXX: this suppresses errors about putting arbitrary stuff on opts
  const opts = _.cloneDeep(this.opts) as any;

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
  const chromedriver = await setupNewChromedriver.bind(this)(
    opts,
    this.adb.curDeviceId as string,
  );
  this.chromedriver = chromedriver;
  chromedriver.on(Chromedriver.EVENT_CHANGED, (msg) => {
    if (msg.state === Chromedriver.STATE_STOPPED) {
      this.onChromedriverStop(CHROMIUM_WIN);
    }
  });

  // Now that we have a Chrome session, we ensure that the context is
  // appropriately set and that this chromedriver is added to the list
  // of session chromedrivers so we can switch back and forth
  this.curContext = CHROMIUM_WIN;
  this.sessionChromedrivers[CHROMIUM_WIN] = chromedriver;
  this.proxyReqRes = chromedriver.proxyReq.bind(chromedriver);
  this.proxyCommand = chromedriver.jwproxy.command.bind(
    chromedriver.jwproxy,
  ) as typeof this.proxyCommand;
  this.jwpProxyActive = true;

  if (shouldDismissChromeWelcome.bind(this)()) {
    // dismiss Chrome welcome dialog
    await dismissChromeWelcome.bind(this)();
  }
}

