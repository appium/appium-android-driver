import path from 'path';
import _ from 'lodash';


const app = require.resolve('android-apidemos');

const DEFAULT_CAPS = {
  app,
  deviceName: 'Android',
  platformName: 'Android',
};

const CONTACT_MANAGER_CAPS = _.defaults({
  app: path.resolve(__dirname, '..', '..', '..', 'test', 'assets', 'ContactManager.apk'),
}, DEFAULT_CAPS);

const CHROME_CAPS = _.defaults({
  browserName: 'chrome'
}, DEFAULT_CAPS);

export { app, DEFAULT_CAPS, CONTACT_MANAGER_CAPS, CHROME_CAPS };
export default DEFAULT_CAPS;
