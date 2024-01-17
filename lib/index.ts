import {install} from 'source-map-support';
install();

import {AndroidDriver} from './driver';
export {ANDROID_DRIVER_CONSTRAINTS as commonCapConstraints} from './constraints';
export * from './driver';
export * as doctor from './doctor/checks';
export type * from './helpers/types';
export {
  CHROMIUM_WIN,
  NATIVE_WIN,
  WEBVIEW_BASE,
  WEBVIEW_WIN,
  default as webviewHelpers,
} from './commands/context/helpers';

export default AndroidDriver;
