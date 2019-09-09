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
    isString: true
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
  adbExecTimeout: {
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
  webviewDevtoolsPort: {
    isNumber: true
  },
  ensureWebviewsHavePages: {
    isBoolean: true
  },
  // this one is deprecated
  chromeDriverPort: {
    isNumber: true
  },
  // duplicate of above with better spelling
  chromedriverPort: {
    isNumber: true
  },
  chromedriverPorts: {
    isArray: true
  },
  chromedriverArgs: {
    isObject: true,
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
  chromedriverUseSystemExecutable: {
    isBoolean: true
  },
  chromedriverDisableBuildCheck: {
    isBoolean: true
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
  extractChromeAndroidPackageFromContextName: {
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
  uninstallOtherPackages: {
    isString: true
  },
  allowTestPackages: {
    isBoolean: true
  },
  pageLoadStrategy: {
    isString: true
  },
  localeScript: {
    isString: true
  },
  skipDeviceInitialization: {
    isBoolean: true
  },
  remoteAppsCacheLimit: {
    isNumber: true
  },
  buildToolsVersion: {
    isString: true
  },
  skipLogcatCapture: {
    isBoolean: true
  },
  chromeOptions: {
    isObject: true
  },
  enablePerformanceLogging: {
    isBoolean: true
  },
  userProfile: {
    isNumber: true
  },
  browserName: {
    isString: true
  },
  enforceAppInstall: {
    isBoolean: true
  },
};

let uiautomatorCapConstraints = {
  ignoreUnimportantViews: {
    isBoolean: true
  },
  disableAndroidWatchers: {
    isBoolean: true
  },
  acceptSslCerts: {
    isBoolean: true
  },
  androidNaturalOrientation: {
    isBoolean: true
  },
  disableWindowAnimation: {
    isBoolean: true
  },
  bootstrapPort: {
    isNumber: true
  },
};

let desiredCapConstraints = {};

Object.assign(desiredCapConstraints, commonCapConstraints,
              uiautomatorCapConstraints);

export default desiredCapConstraints;
export { commonCapConstraints };
