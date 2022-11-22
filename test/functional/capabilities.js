import path from 'path';
import _ from 'lodash';
import { node } from '@appium/support';
import { API_DEMOS_APK_PATH } from 'android-apidemos';


function amendCapabilities (baseCaps, ...newCaps) {
  return node.deepFreeze({
    alwaysMatch: _.cloneDeep(Object.assign({}, baseCaps.alwaysMatch, ...newCaps)),
    firstMatch: [{}],
  });
}

const DEFAULT_CAPS = node.deepFreeze({
  alwaysMatch: {
    'appium:app': API_DEMOS_APK_PATH,
    'appium:deviceName': 'Android',
    platformName: 'Android',
  },
  firstMatch: [{}],
});

const CONTACT_MANAGER_CAPS = amendCapabilities(DEFAULT_CAPS, {
  'appium:app': path.resolve(__dirname, '..', 'assets', 'ContactManager.apk'),
});

const CHROME_CAPS = amendCapabilities(_.omit(DEFAULT_CAPS, 'alwaysMatch.appium:app'), {
  browserName: 'chrome',
});

export { API_DEMOS_APK_PATH as app, DEFAULT_CAPS, CONTACT_MANAGER_CAPS, CHROME_CAPS, amendCapabilities };
