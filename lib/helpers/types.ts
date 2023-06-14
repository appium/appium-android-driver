import type {ADB} from 'appium-adb';
import {AndroidDriverCaps} from '../driver';
import {StringRecord} from '@appium/types';

export interface WebviewProc {
  /**
   * The webview process name (as returned by getPotentialWebviewProcs)
   */
  proc: string;
  /**
   * The actual webview context name
   */
  webview: string;
}

export interface DetailCollectionOptions {
  /**
   * The starting port to use for webview page presence check (if not the default of 9222).
   */
  webviewDevtoolsPort?: number | null;
  /**
   * Whether to check for webview pages presence
   */
  ensureWebviewsHavePages?: boolean | null;
  /**
   * Whether to collect web view details and send them to Chromedriver constructor, so it could
   * select a binary more precisely based on this info.
   */
  enableWebviewDetailsCollection?: boolean | null;
}

export interface WebviewProps {
  /**
   * The name of the Devtools Unix socket
   */
  proc: string;
  /**
   * The web view alias. Looks like `WEBVIEW_` prefix plus PID or package name
   */
  webview: string;
  /**
   * Webview information as it is retrieved by /json/version CDP endpoint
   */
  info?: object | null;
  /**
   * Webview pages list as it is retrieved by /json/list CDP endpoint
   */
  pages?: object[] | null;
}

export interface GetWebviewsOpts {
  /**
   * device socket name
   */
  androidDeviceSocket?: string | null;
  /**
   * whether to check for webview page presence
   */
  ensureWebviewsHavePages?: boolean | null;
  /**
   * port to use for webview page presence check.
   */
  webviewDevtoolsPort?: number | null;
  /**
   * whether to collect web view details and send them to Chromedriver constructor, so it could select a binary more precisely based on this info.
   */
  enableWebviewDetailsCollection?: boolean | null;
  /**
   * @privateRemarks This is referenced but was not previously declared
   */
  isChromeSession?: boolean;
}

export interface ProcessInfo {
  /**
   * The process name
   */
  name: string;
  /**
   * The process id (if could be retrieved)
   */
  id?: string | null;
}

export interface WebViewDetails {
  /**
   * Web view process details
   */
  process?: ProcessInfo | null;
  /**
   * Web view details as returned by /json/version CDP endpoint
   * @example
   * {
   *  "Browser": "Chrome/72.0.3601.0",
   *  "Protocol-Version": "1.3",
   *  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3601.0 Safari/537.36",
   *  "V8-Version": "7.2.233",
   *  "WebKit-Version": "537.36 (@cfede9db1d154de0468cb0538479f34c0755a0f4)",
   *  "webSocketDebuggerUrl": "ws://localhost:9222/devtools/browser/b0b8a4fb-bb17-4359-9533-a8d9f3908bd8"
   * }
   */
  info?: StringRecord;
}

/**
 * @deprecated
 */
export type TADB = ADB;

/**
 * XXX Placeholder for ADB options
 */
export type TADBOptions = any;

export interface FastUnlockOptions {
  credential: string;
  /**
   * @privateRemarks FIXME: narrow this type to whatever `appium-adb` expects
   */
  credentialType: string;
}

/**
 * XXX May be wrong
 */
export interface ADBDeviceInfo {
  udid: string;
  emPort: number | false;
}

export type ADBLaunchInfo = Pick<
  AndroidDriverCaps,
  'appPackage' | 'appWaitActivity' | 'appActivity' | 'appWaitPackage'
>;
