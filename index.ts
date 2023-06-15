import {install} from 'source-map-support';
install();

import {AndroidDriver} from './lib/driver';
export type * from './lib/commands/types';
export {ANDROID_DRIVER_CONSTRAINTS as commonCapConstraints} from './lib/constraints';
export * from './lib/driver';
export {SETTINGS_HELPER_PKG_ID, default as androidHelpers} from './lib/helpers/android';
export type * from './lib/helpers/types';
export {
  CHROMIUM_WIN,
  NATIVE_WIN,
  WEBVIEW_BASE,
  WEBVIEW_WIN,
  default as webviewHelpers,
} from './lib/helpers/webview';

export default AndroidDriver;
