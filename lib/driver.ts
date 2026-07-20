import type {
  DriverCaps,
  DriverOpts,
  ExternalDriver,
  InitialOpts,
  RouteMatcher,
  StringRecord,
  W3CDriverCaps,
} from '@appium/types';
import type {ADB, LogcatListener} from 'appium-adb';
import type {Chromedriver as AppiumChromedriver} from 'appium-chromedriver';
import {BaseDriver} from 'appium/driver.js';
import {ANDROID_DRIVER_CONSTRAINTS} from './constraints.js';
import type {AndroidDriverConstraints} from './constraints.js';
import {newMethodMap} from './method-map.js';
import {SettingsApp} from 'io.appium.settings';
import {parseArray, removeAllSessionWebSocketHandlers} from './utils.js';
import {CHROME_BROWSER_PACKAGE_ACTIVITY} from './commands/context/helpers.js';
import {
  getContexts,
  setContext,
  getCurrentContext,
  defaultContextName,
  assignContexts,
  switchContext,
  defaultWebviewName,
  isWebContext,
  isChromedriverContext,
  startChromedriverProxy,
  onChromedriverStop,
  stopChromedriverProxies,
  suspendChromedriverProxy,
  startChromeSession,
  mobileGetContexts,
  mobileGetChromeCapabilities,
  getWindowHandle,
  getWindowHandles,
  setWindow,
  notifyBiDiContextChange,
} from './commands/context/exports.js';
import {
  getDeviceInfoFromCaps,
  createADB,
  getLaunchInfo,
  initDevice,
} from './commands/device/common.js';
import {
  fingerprint,
  mobileFingerprint,
  sendSMS,
  mobileSendSms,
  gsmCall,
  mobileGsmCall,
  gsmSignal,
  mobileGsmSignal,
  gsmVoice,
  mobileGsmVoice,
  powerAC,
  mobilePowerAc,
  powerCapacity,
  mobilePowerCapacity,
  networkSpeed,
  mobileNetworkSpeed,
  sensorSet,
} from './commands/device/emulator-actions.js';
import {mobileExecEmuConsoleCommand} from './commands/device/emulator-console.js';
import {
  getThirdPartyPackages,
  uninstallOtherPackages,
  installOtherApks,
  installAUT,
  resetAUT,
  background,
  mobileBackgroundApp,
  getCurrentActivity,
  getCurrentPackage,
  mobileClearApp,
  mobileInstallApp,
  installApp,
  mobileIsAppInstalled,
  mobileRemoveApp,
  mobileTerminateApp,
  mobileListApps,
  terminateApp,
  removeApp,
  activateApp,
  queryAppState,
  isAppInstalled,
} from './commands/app-management.js';
import {mobileGetUiMode, mobileSetUiMode} from './commands/appearance.js';
import {mobileDeviceidle} from './commands/deviceidle.js';
import {mobileBluetooth} from './commands/bluetooth.js';
import {
  getAttribute,
  getName,
  elementDisplayed,
  elementEnabled,
  elementSelected,
  setElementValue,
  doSetElementValue,
  replaceValue,
  setValueImmediate,
  setValue,
  click,
  getLocationInView,
  getText,
  getLocation,
  getSize,
} from './commands/element.js';
import {execute} from './commands/execute.js';
import {pullFile, pullFolder, pushFile, mobileDeleteFile} from './commands/file-actions.js';
import {findElOrEls, doFindElementOrEls} from './commands/find.js';
import {
  setGeoLocation,
  getGeoLocation,
  mobileRefreshGpsCache,
  toggleLocationServices,
  isLocationServicesEnabled,
  mobileGetGeolocation,
  mobileSetGeolocation,
  mobileResetGeolocation,
} from './commands/geolocation.js';
import {performActions} from './commands/gestures.js';
import {
  isIMEActivated,
  availableIMEEngines,
  getActiveIMEEngine,
  activateIMEEngine,
  deactivateIMEEngine,
  setStylusHandwriting,
} from './commands/ime.js';
import {
  startActivity,
  mobileStartActivity,
  mobileBroadcast,
  mobileStartService,
  mobileStopService,
} from './commands/intent.js';
import {
  hideKeyboard,
  isKeyboardShown,
  keys,
  doSendKeys,
  pressKeyCode,
  longPressKeyCode,
  mobilePerformEditorAction,
} from './commands/keyboard.js';
import {lock, unlock, mobileUnlock, isLocked} from './commands/lock/exports.js';
import {
  supportedLogTypes,
  mobileStartLogsBroadcast,
  mobileStopLogsBroadcast,
  getLogTypes,
  getLog,
  assignBiDiLogListener,
} from './commands/log.js';
import {
  mobileIsMediaProjectionRecordingRunning,
  mobileStartMediaProjectionRecording,
  mobileStopMediaProjectionRecording,
} from './commands/media-projection.js';
import {mobileSendTrimMemory} from './commands/memory.js';
import {mobileNfc} from './commands/nfc.js';
import {mobileInjectEmulatorCameraImage} from './commands/image-injection.js';
import {
  getWindowRect,
  getWindowSize,
  getDisplayDensity,
  mobileGetNotifications,
  mobileListSms,
  openNotifications,
  setUrl,
} from './commands/misc.js';
import {
  getNetworkConnection,
  isWifiOn,
  mobileGetConnectivity,
  mobileSetConnectivity,
  setNetworkConnection,
  setWifiState,
  setDataState,
  toggleData,
  toggleFlightMode,
  toggleWiFi,
} from './commands/network.js';
import {
  getPerformanceData,
  getPerformanceDataTypes,
  mobileGetPerformanceData,
} from './commands/performance.js';
import {reset, closeApp, launchApp} from './commands/legacy.js';
import {mobileChangePermissions, mobileGetPermissions} from './commands/permissions.js';
import {startRecordingScreen, stopRecordingScreen} from './commands/recordscreen.js';
import {getStrings, ensureDeviceLocale} from './commands/resources.js';
import {mobileShell} from './commands/shell.js';
import {mobileStartScreenStreaming, mobileStopScreenStreaming} from './commands/streamscreen.js';
import {getSystemBars, mobilePerformStatusBarCommand} from './commands/system-bars.js';
import {getDeviceTime, mobileGetDeviceTime} from './commands/time.js';
import {executeMethodMap} from './execute-method-map.js';
import {LRUCache} from 'lru-cache';
import type {ScreenRecordingProperties, ScreenStreamingProps} from './commands/types.js';

export type AndroidDriverCaps = DriverCaps<AndroidDriverConstraints>;
export type W3CAndroidDriverCaps = W3CDriverCaps<AndroidDriverConstraints>;
export type AndroidDriverOpts = DriverOpts<AndroidDriverConstraints>;

const EMULATOR_PATTERN = /\bemulator\b/i;

type AndroidExternalDriver = ExternalDriver<AndroidDriverConstraints>;
class AndroidDriver
  extends BaseDriver<AndroidDriverConstraints, StringRecord>
  implements ExternalDriver<AndroidDriverConstraints, string, StringRecord>
{
  static newMethodMap = newMethodMap;
  static executeMethodMap = executeMethodMap;

  jwpProxyAvoid!: RouteMatcher[];
  adb!: ADB;
  _settingsApp!: SettingsApp;
  proxyReqRes?: (...args: any) => any;
  contexts?: string[];
  sessionChromedrivers: StringRecord<AppiumChromedriver>;
  chromedriver?: AppiumChromedriver;
  proxyCommand?: AndroidExternalDriver['proxyCommand'];
  jwpProxyActive: boolean;
  curContext: string;
  useUnlockHelperApp?: boolean;
  defaultIME?: string;
  _wasWindowAnimationDisabled?: boolean;
  _cachedActivityArgs: StringRecord;
  _screenStreamingProps?: ScreenStreamingProps;
  _screenRecordingProperties?: ScreenRecordingProperties;
  _logcatWebsocketListener?: LogcatListener;
  _bidiServerLogListener?: (...args: any[]) => void;
  _bidiProxyUrl: string | null = null;
  _chromedriverCapsCache: LRUCache<string, StringRecord> = new LRUCache({
    max: 20,
    updateAgeOnGet: true,
  });
  opts: AndroidDriverOpts;

  getContexts = getContexts;
  getCurrentContext = getCurrentContext;
  defaultContextName = defaultContextName;
  assignContexts = assignContexts;
  switchContext = switchContext;
  defaultWebviewName = defaultWebviewName;
  isChromedriverContext = isChromedriverContext;
  startChromedriverProxy = startChromedriverProxy;
  stopChromedriverProxies = stopChromedriverProxies;
  suspendChromedriverProxy = suspendChromedriverProxy;
  startChromeSession = startChromeSession;
  onChromedriverStop = onChromedriverStop;
  isWebContext = isWebContext;
  mobileGetContexts = mobileGetContexts;
  mobileGetChromeCapabilities = mobileGetChromeCapabilities;
  setContext = setContext as any as (this: AndroidDriver, name?: string) => Promise<void>;
  setWindow = setWindow;
  getWindowHandle = getWindowHandle;
  getWindowHandles = getWindowHandles;
  notifyBiDiContextChange = notifyBiDiContextChange;

  getDeviceInfoFromCaps = getDeviceInfoFromCaps;
  createADB = createADB;
  getLaunchInfo = getLaunchInfo;
  initDevice = initDevice;

  fingerprint = fingerprint;
  mobileFingerprint = mobileFingerprint;
  sendSMS = sendSMS;
  mobileSendSms = mobileSendSms;
  gsmCall = gsmCall;
  mobileGsmCall = mobileGsmCall;
  gsmSignal = gsmSignal;
  mobileGsmSignal = mobileGsmSignal;
  gsmVoice = gsmVoice;
  mobileGsmVoice = mobileGsmVoice;
  powerAC = powerAC;
  mobilePowerAc = mobilePowerAc;
  powerCapacity = powerCapacity;
  mobilePowerCapacity = mobilePowerCapacity;
  networkSpeed = networkSpeed;
  mobileNetworkSpeed = mobileNetworkSpeed;
  sensorSet = sensorSet;

  mobileExecEmuConsoleCommand = mobileExecEmuConsoleCommand;

  getThirdPartyPackages = getThirdPartyPackages;
  uninstallOtherPackages = uninstallOtherPackages;
  installOtherApks = installOtherApks;
  installAUT = installAUT;
  resetAUT = resetAUT;
  background = background;
  getCurrentActivity = getCurrentActivity;
  getCurrentPackage = getCurrentPackage;
  mobileClearApp = mobileClearApp;
  mobileInstallApp = mobileInstallApp;
  installApp = installApp;
  mobileIsAppInstalled = mobileIsAppInstalled;
  mobileRemoveApp = mobileRemoveApp;
  mobileTerminateApp = mobileTerminateApp;
  mobileListApps = mobileListApps;
  terminateApp = terminateApp;
  removeApp = removeApp;
  activateApp = activateApp;
  queryAppState = queryAppState;
  isAppInstalled = isAppInstalled;
  mobileBackgroundApp = mobileBackgroundApp;

  mobileGetUiMode = mobileGetUiMode;
  mobileSetUiMode = mobileSetUiMode;

  mobileDeviceidle = mobileDeviceidle;

  mobileBluetooth = mobileBluetooth;

  getAttribute = getAttribute;
  getName = getName;
  elementDisplayed = elementDisplayed;
  elementEnabled = elementEnabled;
  elementSelected = elementSelected;
  setElementValue = setElementValue;
  doSetElementValue = doSetElementValue;
  replaceValue = replaceValue;
  setValueImmediate = setValueImmediate;
  setValue = setValue;
  click = click;
  getLocationInView = getLocationInView;
  getText = getText;
  getLocation = getLocation;
  getSize = getSize;

  execute = execute;

  pullFile = pullFile;
  pullFolder = pullFolder;
  pushFile = pushFile;
  mobileDeleteFile = mobileDeleteFile;

  findElOrEls = findElOrEls;
  doFindElementOrEls = doFindElementOrEls;

  setGeoLocation = setGeoLocation;
  getGeoLocation = getGeoLocation;
  mobileRefreshGpsCache = mobileRefreshGpsCache;
  toggleLocationServices = toggleLocationServices;
  isLocationServicesEnabled = isLocationServicesEnabled;
  mobileGetGeolocation = mobileGetGeolocation;
  mobileSetGeolocation = mobileSetGeolocation;
  mobileResetGeolocation = mobileResetGeolocation;

  performActions = performActions;

  isIMEActivated = isIMEActivated;
  availableIMEEngines = availableIMEEngines;
  getActiveIMEEngine = getActiveIMEEngine;
  activateIMEEngine = activateIMEEngine;
  deactivateIMEEngine = deactivateIMEEngine;
  setStylusHandwriting = setStylusHandwriting;

  startActivity = startActivity as unknown as (
    appPackage: string,
    appActivity: string,
    appWaitPackage?: string,
    appWaitActivity?: string,
    intentAction?: string,
    intentCategory?: string,
    intentFlags?: string,
    optionalIntentArguments?: string,
    dontStopAppOnReset?: boolean,
  ) => Promise<void>;
  mobileStartActivity = mobileStartActivity;
  mobileBroadcast = mobileBroadcast;
  mobileStartService = mobileStartService;
  mobileStopService = mobileStopService;

  hideKeyboard = hideKeyboard;
  isKeyboardShown = isKeyboardShown;
  keys = keys;
  doSendKeys = doSendKeys;
  pressKeyCode = pressKeyCode;
  longPressKeyCode = longPressKeyCode;
  mobilePerformEditorAction = mobilePerformEditorAction;

  lock = lock;
  unlock = unlock;
  mobileUnlock = mobileUnlock;
  isLocked = isLocked;

  supportedLogTypes = supportedLogTypes;
  mobileStartLogsBroadcast = mobileStartLogsBroadcast;
  mobileStopLogsBroadcast = mobileStopLogsBroadcast;
  getLogTypes = getLogTypes;
  getLog = getLog;
  assignBiDiLogListener = assignBiDiLogListener;

  mobileIsMediaProjectionRecordingRunning = mobileIsMediaProjectionRecordingRunning;
  mobileStartMediaProjectionRecording = mobileStartMediaProjectionRecording;
  mobileStopMediaProjectionRecording = mobileStopMediaProjectionRecording;

  mobileSendTrimMemory = mobileSendTrimMemory;

  mobileInjectEmulatorCameraImage = mobileInjectEmulatorCameraImage;

  getWindowRect = getWindowRect;
  getWindowSize = getWindowSize;
  getDisplayDensity = getDisplayDensity;
  mobileGetNotifications = mobileGetNotifications;
  mobileListSms = mobileListSms;
  openNotifications = openNotifications;
  setUrl = setUrl;

  getNetworkConnection = getNetworkConnection;
  isWifiOn = isWifiOn;
  mobileGetConnectivity = mobileGetConnectivity;
  mobileSetConnectivity = mobileSetConnectivity;
  setNetworkConnection = setNetworkConnection;
  setWifiState = setWifiState;
  setDataState = setDataState;
  toggleData = toggleData;
  toggleFlightMode = toggleFlightMode;
  toggleWiFi = toggleWiFi;

  getPerformanceData = getPerformanceData;
  getPerformanceDataTypes = getPerformanceDataTypes;
  mobileGetPerformanceData = mobileGetPerformanceData;

  mobileChangePermissions = mobileChangePermissions;
  mobileGetPermissions = mobileGetPermissions;

  startRecordingScreen = startRecordingScreen;
  stopRecordingScreen = stopRecordingScreen;

  getStrings = getStrings;
  ensureDeviceLocale = ensureDeviceLocale;

  mobileShell = mobileShell;

  mobileNfc = mobileNfc;

  mobileStartScreenStreaming = mobileStartScreenStreaming;
  mobileStopScreenStreaming = mobileStopScreenStreaming;

  getSystemBars = getSystemBars;
  mobilePerformStatusBarCommand = mobilePerformStatusBarCommand;

  getDeviceTime = getDeviceTime;
  mobileGetDeviceTime = mobileGetDeviceTime;

  reset = reset;
  closeApp = closeApp;
  launchApp = launchApp;

  constructor(opts: InitialOpts = {} as InitialOpts, shouldValidateCaps = true) {
    super(opts, shouldValidateCaps);

    this.locatorStrategies = [
      'xpath',
      'id',
      'class name',
      'accessibility id',
      '-android uiautomator',
    ];
    this.desiredCapConstraints = structuredClone(ANDROID_DRIVER_CONSTRAINTS);
    this.sessionChromedrivers = {};
    this.jwpProxyActive = false;

    this.curContext = this.defaultContextName();
    this.opts = opts as AndroidDriverOpts;
    this._cachedActivityArgs = {};
  }

  get bidiProxyUrl(): string | null {
    return this.opts.chromedriverForwardBiDi ? this._bidiProxyUrl : null;
  }

  get settingsApp(): SettingsApp {
    if (!this._settingsApp || this._settingsApp.adb !== this.adb) {
      this._settingsApp = new SettingsApp({adb: this.adb});
    }
    return this._settingsApp;
  }

  get isChromeSession(): boolean {
    return Object.keys(CHROME_BROWSER_PACKAGE_ACTIVITY).includes(
      (this.opts.browserName || '').toLowerCase(),
    );
  }

  isEmulator(): boolean {
    const possibleNames = [this.opts?.udid, this.adb?.curDeviceId];
    return !!this.opts?.avd || possibleNames.some((x) => EMULATOR_PATTERN.test(String(x)));
  }

  override validateDesiredCaps(caps: any): caps is AndroidDriverCaps {
    if (!super.validateDesiredCaps(caps)) {
      return false;
    }

    if (caps.browserName) {
      if (caps.app) {
        // warn if the capabilities have both `app` and `browser, although this is common with selenium grid
        this.log.warn(
          `The desired capabilities should generally not include both an 'app' and a 'browserName'`,
        );
      }
      if (caps.appPackage) {
        throw this.log.errorWithException(
          `The desired should not include both of an 'appPackage' and a 'browserName'`,
        );
      }
    }

    if (caps.uninstallOtherPackages) {
      try {
        parseArray(caps.uninstallOtherPackages);
      } catch (e) {
        throw this.log.errorWithException(
          `Could not parse "uninstallOtherPackages" capability: ${(e as Error).message}`,
        );
      }
    }

    return true;
  }

  override async deleteSession(sessionId?: string | null) {
    await removeAllSessionWebSocketHandlers.bind(this)();

    try {
      this.adb?.logcat?.removeAllListeners();
      await this.adb?.stopLogcat();
    } catch (e) {
      this.log.warn(
        `Cannot stop the logcat process. Original error: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    if (this._bidiServerLogListener) {
      this.log.unwrap().off('log', this._bidiServerLogListener);
    }

    await super.deleteSession(sessionId);
  }
}

export {AndroidDriver};
