#!/usr/bin/env node
// transpile:main

import yargs from 'yargs';
import { asyncify } from 'asyncbox';
import * as server from './lib/server';


const { startServer } = server;

const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT = 4723;

async function main () {
  let port = yargs.argv.port || DEFAULT_PORT;
  let host = yargs.argv.host || DEFAULT_HOST;
  return await startServer(port, host);
}

if (require.main === module) {
  asyncify(main);
}


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
  androidHelpers, androidCommands, AndroidDriver, startServer,
  commonCapConstraints, webviewHelpers, NATIVE_WIN, WEBVIEW_WIN,
  WEBVIEW_BASE, CHROMIUM_WIN, SETTINGS_HELPER_PKG_ID,
};
