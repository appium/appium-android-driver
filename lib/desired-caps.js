import { CHROME_BROWSERS } from './android-helpers';

let commonCapConstraints = {
  platformName: {
    isString: true,
    inclusion: ['Android'],
    presence: true
  },
  app: {
    isString: true
  },
  appActivity: {
    isString: true
  },
  appPackage: {
    isString: true
  },
  appWaitActivity: {
    isString:  true
  },
  appWaitPackage: {
    isString: true
  },
  deviceReadyTimeout: {
    isNumber: true
  },
  androidCoverage: {
    isString: true
  },
  androidDeviceReadyTimeout: {
    isNumber: true
  },
  androidDeviceSocket: {
    isString: true
  },
  adbPort: {
    isNumber: true
  },
  avd: {
    isString: true
  },
  avdLaunchTimeout: {
    isNumber: true
  },
  avdReadyTimeout: {
    isNumber: true
  },
  avdArgs: {
    isString: true
  },
  useKeystore: {
    isBoolean: true
  },
  keystorePath: {
    isString: true
  },
  keystorePassword: {
    isString: true
  },
  keyAlias: {
    isString: true
  },
  keyPassword: {
    isString: true
  },
  chromedriverExecutable: {
    isString: true
  },
  autoWebviewTimeout: {
    isNumber: true
  },
  intentAction: {
    isString: true
  },
  intentCategory: {
    isString: true
  },
  intentFlags: {
    isString: true
  },
  optionalIntentArguments: {
    isString: true
  },
  dontStopAppOnReset: {
    isBoolean: true
  },
  unicodeKeyboard: {
    isBoolean: true
  },
  resetKeyboard: {
    isBoolean: true
  },
  noSign: {
    isBoolean: true
  },
  recreateChromeDriverSessions: {
    isBoolean: false
  },
  autoLaunch: {
    isBoolean: true
  }
};

let uiautomatorCapConstraints = {
  browserName: {
    isString: true,
    inclusion: CHROME_BROWSERS
  },
  enablePerformanceLogging: {
    isBoolean: true
  },
  ignoreUnimportantViews: {
    isBoolean: true
  },
  disableAndroidWatchers: {
    isBoolean: true
  },
  acceptSslCerts: {
    isBoolean: true
  },
  chromeOptions: {
    isObject: true
  },
};

let desiredCapConstraints = {};

Object.assign(desiredCapConstraints, commonCapConstraints,
              uiautomatorCapConstraints);

export default desiredCapConstraints;
export { commonCapConstraints };
