#!/usr/bin/env node
// transpile:main

import yargs from 'yargs';
import { asyncify } from 'asyncbox';
import { startServer } from './lib/server';
import AndroidDriver from './lib/driver';
import androidHelpers from './lib/android-helpers';
import androidCommands from './lib/commands/index';
import { default as webviewHelpers, NATIVE_WIN, WEBVIEW_WIN, WEBVIEW_BASE,
         CHROMIUM_WIN } from './lib/webview-helpers';
import { commonCapConstraints } from './lib/desired-caps';

const DEFAULT_HOST = "localhost";
const DEFAULT_PORT = 4723;

async function main () {
  let port = yargs.argv.port || DEFAULT_PORT;
  let host = yargs.argv.host || DEFAULT_HOST;
  return startServer(port, host);
}

if (require.main === module) {
  asyncify(main);
}

export default AndroidDriver;
export { androidHelpers, androidCommands, AndroidDriver, startServer,
         commonCapConstraints, webviewHelpers, NATIVE_WIN, WEBVIEW_WIN,
         WEBVIEW_BASE, CHROMIUM_WIN };
