import _ from 'lodash';

/**
 * @param {import('@appium/types').AppiumServer} server
 * @param {string?} [sessionId]
 * @returns {Promise<void>}
 */
export async function removeAllSessionWebSocketHandlers(server, sessionId) {
  if (!server || !_.isFunction(server.getWebSocketHandlers)) {
    return;
  }

  const activeHandlers = await server.getWebSocketHandlers(sessionId);
  for (const pathname of _.keys(activeHandlers)) {
    await server.removeWebSocketHandler(pathname);
  }
}
