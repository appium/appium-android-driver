import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import _ from 'lodash';
import { AndroidDriver, startServer } from '../..';
import { util } from 'appium-support';
import DEFAULT_CAPS from './desired';
import WebSocket from 'ws';
import B from 'bluebird';


chai.should();
chai.use(chaiAsPromised);

const HOST = util.localIp();
const PORT = 4723;

let defaultCaps = _.defaults({
  androidInstallTimeout: 90000
}, DEFAULT_CAPS);

describe('logs', function () {
  let driver;
  let server;

  before(async function () {
    driver = new AndroidDriver();
    await driver.createSession(defaultCaps);
    server = await startServer(PORT, HOST);
    driver.server = server;
  });
  after(async function () {
    if (driver) {
      await driver.deleteSession();
    }
    if (server) {
      await server.close();
    }
  });

  it('should be able to receieve logcat output via web socket', async function () {
    const endpoint = `/ws/session/${driver.sessionId}/appium/device/logcat`;
    const timeout = 5000;
    await driver.execute('mobile: startLogsBroadcast', {});
    try {
      await new B((resolve, reject) => {
        const client = new WebSocket(`ws://${HOST}:${PORT}${endpoint}`);
        client.on('message', (data) => {
          data.should.not.be.empty;
          resolve();
        });
        client.on('error', reject);
        setTimeout(() => reject(new Error('No websocket messages have been received after the timeout')),
                  timeout);
      });
    } finally {
      await driver.execute('mobile: stopLogsBroadcast', {});
    }
  });
});
