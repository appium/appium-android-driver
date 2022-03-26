import path from 'path';
import _ from 'lodash';


const app = require.resolve('android-apidemos');

const DEFAULT_CAPS = {
  'appium:app': app,
  'appium:deviceName': 'Android',
  platformName: 'Android',
};

const CONTACT_MANAGER_CAPS = _.defaults({
  'appium:app': path.resolve(__dirname, '..', '..', '..', 'test', 'assets', 'ContactManager.apk'),
}, DEFAULT_CAPS);

const CHROME_CAPS = _.defaults({
  browserName: 'chrome',
}, DEFAULT_CAPS);
delete CHROME_CAPS.app;

export { app, DEFAULT_CAPS, CONTACT_MANAGER_CAPS, CHROME_CAPS };
export default DEFAULT_CAPS;
