let commonCapConstraints = {
  platformName: {
    isString: true,
    inclusionCaseInsensitive: ['Android'],
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
  appWaitDuration: {
    isNumber: true
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
  androidInstallTimeout: {
    isNumber: true
  },
  adbPort: {
    isNumber: true
  },
  remoteAdbHost: {
    isString: true
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
  chromeDriverPort : {
    isNumber: true
  },
  chromedriverExecutable: {
    isString: true
  },
  chromedriverExecutableDir: {
    isString: true
  },
  chromedriverChromeMappingFile: {
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
  },
  nativeWebScreenshot: {
    isBoolean: true
  },
  androidScreenshotPath: {
    isString: true
  },
  androidInstallPath: {
    isString: true
  },
  clearSystemFiles: {
    isBoolean: true
  },
  extractChromeAndroidPackageFromContextName : {
    isBoolean: true
  },
  autoGrantPermissions: {
    isBoolean: true
  },
  sharedPreferences: {
    isObject: true
  },
  networkSpeed: {
    isString: true
  },
  gpsEnabled: {
    isBoolean: true
  },
  isHeadless: {
    isBoolean: true
  },
  showChromedriverLog: {
    isBoolean: true
  },
  skipUnlock: {
    isBoolean: true
  },
  clearDeviceLogsOnStart: {
    isBoolean: true
  },
  unlockType: {
    isString: true
  },
  unlockKey: {
    isString: true
  },
  otherApps: {
    isString: true
  },
};

let uiautomatorCapConstraints = {
  browserName: {
    isString: true
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
  androidNaturalOrientation: {
    isBoolean: true
  },
};

let desiredCapConstraints = {};

Object.assign(desiredCapConstraints, commonCapConstraints,
              uiautomatorCapConstraints);

export default desiredCapConstraints;
export { commonCapConstraints };
