import log from './logger';
import { server as baseServer, routeConfiguringFunction } from 'appium-base-driver';
import AndroidDriver from './driver';

async function startServer (port, host) {
  let d = new AndroidDriver();
  let router = routeConfiguringFunction(d);
  let server = await baseServer(router, port, host);
  log.info(`AndroidDriver server listening on http://${host}:${port}`);
  d.server = server;
  return server;
}

export { startServer };
