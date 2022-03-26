import path from 'path';
import _ from 'lodash';


const app = require.resolve('android-apidemos');

const DEFAULT_CAPS = Object.freeze({
  'appium:app': app,
  'appium:deviceName': 'Android',
  platformName: 'Android',
});

const CONTACT_MANAGER_CAPS = Object.freeze(_.defaults({
  'appium:app': path.resolve(__dirname, '..', '..', '..', 'test', 'assets', 'ContactManager.apk'),
}, DEFAULT_CAPS));

const CHROME_CAPS = Object.freeze(_.omit(_.defaults({
  browserName: 'chrome',
}, DEFAULT_CAPS), 'appium:app'));

export { app, DEFAULT_CAPS, CONTACT_MANAGER_CAPS, CHROME_CAPS };
export default DEFAULT_CAPS;
