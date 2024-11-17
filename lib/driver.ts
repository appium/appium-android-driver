/* eslint-disable @typescript-eslint/no-non-null-assertion */

import type {
  DriverCaps,
  DriverOpts,
  ExternalDriver,
  InitialOpts,
  RouteMatcher,
  StringRecord,
  W3CDriverCaps,
} from '@appium/types';
import _ from 'lodash';
import ADB from 'appium-adb';
import type {LogcatListener} from 'appium-adb';
import type {default as AppiumChromedriver} from 'appium-chromedriver';
import {BaseDriver} from 'appium/driver';
import ANDROID_DRIVER_CONSTRAINTS, {AndroidDriverConstraints} from './constraints';
import {newMethodMap} from './method-map';
import {SettingsApp} from 'io.appium.settings';
import {parseArray, removeAllSessionWebSocketHandlers} from './utils';
import {CHROME_BROWSER_PACKAGE_ACTIVITY} from './commands/context/helpers';
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
  getWindowHandle,
  getWindowHandles,
  setWindow,
  notifyBiDiContextChange,
} from './commands/context/exports';
import {
  getDeviceInfoFromCaps,
  createADB,
  getLaunchInfo,
  initDevice,
} from './commands/device/common';
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
} from './commands/device/emulator-actions';
import {mobileExecEmuConsoleCommand} from './commands/device/emulator-console';
import {
  getThirdPartyPackages,
  uninstallOtherPackages,
  installOtherApks,
  installAUT,
  resetAUT,
  background,
  getCurrentActivity,
  getCurrentPackage,
  mobileClearApp,
  mobileInstallApp,
  installApp,
  mobileActivateApp,
  mobileIsAppInstalled,
  mobileQueryAppState,
  mobileRemoveApp,
  mobileTerminateApp,
  terminateApp,
  removeApp,
  activateApp,
  queryAppState,
  isAppInstalled,
} from './commands/app-management';
import {mobileGetUiMode, mobileSetUiMode} from './commands/appearance';
import {mobileDeviceidle} from './commands/deviceidle';
import { mobileBluetooth } from './commands/bluetooth';
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
} from './commands/element';
import {
  execute,
  executeMobile,
  mobileCommandsMapping,
} from './commands/execute';
import {
  pullFile,
  mobilePullFile,
  pullFolder,
  mobilePullFolder,
  pushFile,
  mobilePushFile,
  mobileDeleteFile,
} from './commands/file-actions';
import {findElOrEls, doFindElementOrEls} from './commands/find';
import {
  setGeoLocation,
  getGeoLocation,
  mobileRefreshGpsCache,
  toggleLocationServices,
  isLocationServicesEnabled,
  mobileGetGeolocation,
  mobileSetGeolocation,
  mobileResetGeolocation,
} from './commands/geolocation';
import {
  performActions,
} from './commands/gestures';
import {
  isIMEActivated,
  availableIMEEngines,
  getActiveIMEEngine,
  activateIMEEngine,
  deactivateIMEEngine,
} from './commands/ime';
import {
  startActivity,
  mobileStartActivity,
  mobileBroadcast,
  mobileStartService,
  mobileStopService,
} from './commands/intent';
import {
  hideKeyboard,
  isKeyboardShown,
  keys,
  doSendKeys,
  pressKeyCode,
  longPressKeyCode,
  mobilePerformEditorAction,
} from './commands/keyboard';
import {lock, unlock, mobileLock, mobileUnlock, isLocked} from './commands/lock/exports';
import {
  supportedLogTypes,
  mobileStartLogsBroadcast,
  mobileStopLogsBroadcast,
  getLogTypes,
  getLog,
  assignBiDiLogListener,
} from './commands/log';
import {
  mobileIsMediaProjectionRecordingRunning,
  mobileStartMediaProjectionRecording,
  mobileStopMediaProjectionRecording,
} from './commands/media-projection';
import {mobileSendTrimMemory} from './commands/memory';
import {mobileNfc} from './commands/nfc';
import {mobileInjectEmulatorCameraImage} from './commands/image-injection';
import {
  getWindowRect,
  getWindowSize,
  getDisplayDensity,
  mobileGetNotifications,
  mobileListSms,
  openNotifications,
  setUrl,
} from './commands/misc';
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
} from './commands/network';
import {
  getPerformanceData,
  getPerformanceDataTypes,
  mobileGetPerformanceData,
} from './commands/performance';
import {
  reset,
  closeApp,
  launchApp,
} from './commands/legacy';
import {mobileChangePermissions, mobileGetPermissions} from './commands/permissions';
import {startRecordingScreen, stopRecordingScreen} from './commands/recordscreen';
import {getStrings, ensureDeviceLocale} from './commands/resources';
import {mobileShell} from './commands/shell';
import {mobileStartScreenStreaming, mobileStopScreenStreaming} from './commands/streamscreen';
import {getSystemBars, mobilePerformStatusBarCommand} from './commands/system-bars';
import {getDeviceTime, mobileGetDeviceTime} from './commands/time';

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
  jwpProxyAvoid: RouteMatcher[];

  adb: ADB;

  _settingsApp: SettingsApp;

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

  _screenStreamingProps?: StringRecord;

  _screenRecordingProperties?: StringRecord;

  _logcatWebsocketListener?: LogcatListener;

  _bidiServerLogListener?: (...args: any[]) => void;

  opts: AndroidDriverOpts;

  constructor(opts: InitialOpts = {} as InitialOpts, shouldValidateCaps = true) {
    super(opts, shouldValidateCaps);

    this.locatorStrategies = [
      'xpath',
      'id',
      'class name',
      'accessibility id',
      '-android uiautomator',
    ];
    this.desiredCapConstraints = _.cloneDeep(ANDROID_DRIVER_CONSTRAINTS);
    this.sessionChromedrivers = {};
    this.jwpProxyActive = false;

    this.curContext = this.defaultContextName();
    this.opts = opts as AndroidDriverOpts;
    this._cachedActivityArgs = {};
    this.doesSupportBidi = true;
  }

  get settingsApp(): SettingsApp {
    if (!this._settingsApp || this._settingsApp.adb !== this.adb) {
      this._settingsApp = new SettingsApp({adb: this.adb});
    }
    return this._settingsApp;
  }

  isEmulator(): boolean {
    const possibleNames = [this.opts?.udid, this.adb?.curDeviceId];
    return !!this.opts?.avd || possibleNames.some((x) => EMULATOR_PATTERN.test(String(x)));
  }

  get isChromeSession(): boolean {
    return _.includes(
      Object.keys(CHROME_BROWSER_PACKAGE_ACTIVITY),
      (this.opts.browserName || '').toLowerCase(),
    );
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
        throw this.log.errorAndThrow(
          `The desired should not include both of an 'appPackage' and a 'browserName'`,
        );
      }
    }

    if (caps.uninstallOtherPackages) {
      try {
        parseArray(caps.uninstallOtherPackages);
      } catch (e) {
        throw this.log.errorAndThrow(
          `Could not parse "uninstallOtherPackages" capability: ${(e as Error).message}`,
        );
      }
    }

    return true;
  }

  override async deleteSession(sessionId?: string | null) {
    if (this.server) {
      await removeAllSessionWebSocketHandlers(this.server, sessionId);
    }

    try {
      this.adb?.logcat?.removeAllListeners();
      await this.adb?.stopLogcat();
    } catch (e) {
      this.log.warn(`Cannot stop the logcat process. Original error: ${e.message}`);
    }

    if (this._bidiServerLogListener) {
      this.log.unwrap().off('log', this._bidiServerLogListener);
    }

    await super.deleteSession(sessionId);
  }

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
  mobileActivateApp = mobileActivateApp;
  mobileIsAppInstalled = mobileIsAppInstalled;
  mobileQueryAppState = mobileQueryAppState;
  mobileRemoveApp = mobileRemoveApp;
  mobileTerminateApp = mobileTerminateApp;
  terminateApp = terminateApp;
  removeApp = removeApp;
  activateApp = activateApp;
  queryAppState = queryAppState;
  isAppInstalled = isAppInstalled;

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
  executeMobile = executeMobile;
  mobileCommandsMapping = mobileCommandsMapping;

  pullFile = pullFile;
  mobilePullFile = mobilePullFile;
  pullFolder = pullFolder;
  mobilePullFolder = mobilePullFolder;
  pushFile = pushFile;
  mobilePushFile = mobilePushFile;
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
  mobileLock = mobileLock;
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
}

export {AndroidDriver};
