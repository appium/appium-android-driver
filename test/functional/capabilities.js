import path from 'path';
import _ from 'lodash';

function deepFreeze (object) {
  const propNames = Object.getOwnPropertyNames(object);
  for (const name of propNames) {
    const value = object[name];
    if (value && typeof value === 'object') {
      deepFreeze(value);
    }
  }
  return Object.freeze(object);
}

function amendCapabilities (baseCaps, ...newCaps) {
  return deepFreeze({
    alwaysMatch: _.cloneDeep(Object.assign({}, baseCaps.alwaysMatch, ...newCaps)),
    firstMatch: [{}],
  });
}

const app = require.resolve('android-apidemos');

const DEFAULT_CAPS = deepFreeze({
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
