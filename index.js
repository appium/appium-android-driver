#!/usr/bin/env node
// transpile:main
import * as driver from './lib/driver';
import * as androidHelperIndex from './lib/android-helpers';
import * as commandIndex from './lib/commands/index';
import * as webview from './lib/webview-helpers';
import * as caps from './lib/desired-caps';

const { AndroidDriver } = driver;
const { helpers: webviewHelpers, NATIVE_WIN, WEBVIEW_WIN, WEBVIEW_BASE,
        CHROMIUM_WIN } = webview;
const { commonCapConstraints } = caps;
const { commands: androidCommands } = commandIndex;
const { helpers: androidHelpers, SETTINGS_HELPER_PKG_ID } = androidHelperIndex;


export default AndroidDriver;
export {
  androidHelpers, androidCommands, AndroidDriver,
  commonCapConstraints, webviewHelpers, NATIVE_WIN, WEBVIEW_WIN,
  WEBVIEW_BASE, CHROMIUM_WIN, SETTINGS_HELPER_PKG_ID,
};
