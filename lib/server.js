import log from './logger';
import { server as baseServer, routeConfiguringFunction as makeRouter } from 'appium-base-driver';
import AndroidDriver from './driver';

async function startServer (port, host) {
  let d = new AndroidDriver();
  let routeConfiguringFunction = makeRouter(d);
  let server = await baseServer({routeConfiguringFunction, port, hostname: host});
  log.info(`AndroidDriver server listening on http://${host}:${port}`);
  d.server = server;
  return server;
}

export { startServer };
