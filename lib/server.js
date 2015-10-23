import log from './logger';
import { default as baseServer } from 'appium-express';
import { routeConfiguringFunction } from 'mobile-json-wire-protocol';
import AndroidDriver from './driver';

async function startServer (port, host) {
  let d = new AndroidDriver();
  let router = routeConfiguringFunction(d);
  let server = baseServer(router, port, host);
  log.info(`AndroidDriver server listening on http://${host}:${port}`);
  return server;
}

export { startServer };
