import {install} from 'source-map-support';
install();

import {AndroidDriver} from './driver';
export type * from './commands';
export {ANDROID_DRIVER_CONSTRAINTS as commonCapConstraints} from './constraints';
export * from './driver';
export {SETTINGS_HELPER_PKG_ID, default as androidHelpers} from './helpers/android';
export type * from './helpers/types';
export {
  CHROMIUM_WIN,
  NATIVE_WIN,
  WEBVIEW_BASE,
  WEBVIEW_WIN,
  default as webviewHelpers,
} from './helpers/webview';

export default AndroidDriver;
