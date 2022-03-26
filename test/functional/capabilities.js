import path from 'path';
import _ from 'lodash';

function amendCapabilities (baseCaps, ...newCaps) {
  const capsToAmend = Object.assign({}, ...newCaps);
  const alwaysMatch = Object.assign({}, baseCaps.alwaysMatch, capsToAmend);
  return Object.freeze({
    alwaysMatch: _.cloneDeep(alwaysMatch),
    firstMatch: [{}],
  });
}

const app = require.resolve('android-apidemos');

const DEFAULT_CAPS = Object.freeze({
  alwaysMatch: {
    'appium:app': app,
    'appium:deviceName': 'Android',
    platformName: 'Android',
  },
  firstMatch: [{}],
});

const CONTACT_MANAGER_CAPS = amendCapabilities(DEFAULT_CAPS, {
  'appium:app': path.resolve(__dirname, '..', '..', '..', 'test', 'assets', 'ContactManager.apk'),
});

const CHROME_CAPS = amendCapabilities(_.omit(DEFAULT_CAPS, 'alwaysMatch.appium:app'), {
  browserName: 'chrome',
});

export { app, DEFAULT_CAPS, CONTACT_MANAGER_CAPS, CHROME_CAPS, amendCapabilities };
export default DEFAULT_CAPS;
