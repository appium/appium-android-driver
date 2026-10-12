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
import {SettingsApp} from 'io.appium.settings';
import {LRUCache} from 'lru-cache';

// oxlint-disable import/no-duplicates -- see the bare imports below
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
import {mobileBluetooth} from './commands/bluetooth.js';
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
import {CHROME_BROWSER_PACKAGE_ACTIVITY} from './commands/context/helpers.js';
import {getDeviceInfoFromCaps, createADB, getLaunchInfo, initDevice} from './commands/device/common.js';
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
import {mobileDeviceidle} from './commands/deviceidle.js';
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
import {mobileInjectEmulatorCameraImage} from './commands/image-injection.js';
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
import {reset, closeApp, launchApp} from './commands/legacy.js';
import {lock, unlock, mobileUnlock, isLocked} from './commands/lock/exports.js';
import {
  supportedLogTypes,
  mobileStartLogsBroadcast,
  mobileStopLogsBroadcast,
  assignBiDiLogListener,
} from './commands/log.js';
import {
  mobileIsMediaProjectionRecordingRunning,
  mobileStartMediaProjectionRecording,
  mobileStopMediaProjectionRecording,
} from './commands/media-projection.js';
import {mobileSendTrimMemory} from './commands/memory.js';
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
import {mobileNfc} from './commands/nfc.js';
import {getPerformanceData, getPerformanceDataTypes, mobileGetPerformanceData} from './commands/performance.js';
import {mobileChangePermissions, mobileGetPermissions} from './commands/permissions.js';
import {startRecordingScreen, stopRecordingScreen} from './commands/recordscreen.js';
import {getStrings, ensureDeviceLocale} from './commands/resources.js';
import {mobileShell} from './commands/shell.js';
import {mobileStartScreenStreaming, mobileStopScreenStreaming} from './commands/streamscreen.js';
import {getSystemBars, mobilePerformStatusBarCommand} from './commands/system-bars.js';
import {getDeviceTime, mobileGetDeviceTime} from './commands/time.js';
import type {ScreenRecordingProperties, ScreenStreamingProps} from './commands/types.js';
import {ANDROID_DRIVER_CONSTRAINTS} from './constraints.js';
import type {AndroidDriverConstraints} from './constraints.js';
import {executeMethodMap} from './execute-method-map.js';
import {newMethodMap} from './method-map.js';
import {parseArray, removeAllSessionWebSocketHandlers} from './utils.js';
// Bare imports make sure `declare module` augmentations in the command modules
// reach the emitted `driver.d.ts` import graph of downstream drivers.
import './commands/app-management.js';
import './commands/appearance.js';
import './commands/bluetooth.js';
import './commands/context/exports.js';
import './commands/device/common.js';
import './commands/device/emulator-actions.js';
import './commands/device/emulator-console.js';
import './commands/deviceidle.js';
import './commands/element.js';
import './commands/execute.js';
import './commands/file-actions.js';
import './commands/find.js';
import './commands/geolocation.js';
import './commands/gestures.js';
import './commands/image-injection.js';
import './commands/ime.js';
import './commands/intent.js';
import './commands/keyboard.js';
import './commands/legacy.js';
import './commands/lock/exports.js';
import './commands/log.js';
import './commands/media-projection.js';
import './commands/memory.js';
import './commands/misc.js';
import './commands/network.js';
import './commands/nfc.js';
import './commands/performance.js';
import './commands/permissions.js';
import './commands/recordscreen.js';
import './commands/resources.js';
import './commands/shell.js';
import './commands/streamscreen.js';
import './commands/system-bars.js';
import './commands/time.js';
// oxlint-enable import/no-duplicates

export type AndroidDriverCaps = DriverCaps<AndroidDriverConstraints>;
export type W3CAndroidDriverCaps = W3CDriverCaps<AndroidDriverConstraints>;
export type AndroidDriverOpts = DriverOpts<AndroidDriverConstraints>;

const EMULATOR_PATTERN = /\bemulator\b/i;

type AndroidExternalDriver = ExternalDriver<AndroidDriverConstraints>;
class AndroidDriver<C extends AndroidDriverConstraints = AndroidDriverConstraints>
  extends BaseDriver<C, StringRecord>
  implements ExternalDriver<C, string, StringRecord>
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
  opts: DriverOpts<C>;

  supportedLogTypes = supportedLogTypes;

  constructor(opts: InitialOpts = {} as InitialOpts, shouldValidateCaps = true) {
    super(opts, shouldValidateCaps);

    this.locatorStrategies = ['xpath', 'id', 'class name', 'accessibility id', '-android uiautomator'];
    this.desiredCapConstraints = structuredClone(ANDROID_DRIVER_CONSTRAINTS) as C;
    this.sessionChromedrivers = {};
    this.jwpProxyActive = false;

    this.curContext = this.defaultContextName();
    this.opts = opts as DriverOpts<C>;
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
    const browserName = (this.opts as AndroidDriverOpts).browserName;
    return Object.keys(CHROME_BROWSER_PACKAGE_ACTIVITY).includes((browserName || '').toLowerCase());
  }

  isEmulator(): boolean {
    const possibleNames = [this.opts?.udid, this.adb?.curDeviceId];
    return !!this.opts?.avd || possibleNames.some((x) => EMULATOR_PATTERN.test(String(x)));
  }

  override validateDesiredCaps(caps: any): caps is DriverCaps<C> {
    if (!super.validateDesiredCaps(caps)) {
      return false;
    }

    const androidCaps = caps as AndroidDriverCaps;
    if (androidCaps.browserName) {
      if (androidCaps.app) {
        // warn if the capabilities have both `app` and `browser, although this is common with selenium grid
        this.log.warn(`The desired capabilities should generally not include both an 'app' and a 'browserName'`);
      }
      if (androidCaps.appPackage) {
        throw this.log.errorWithException(`The desired should not include both of an 'appPackage' and a 'browserName'`);
      }
    }

    if (androidCaps.uninstallOtherPackages) {
      try {
        parseArray(androidCaps.uninstallOtherPackages);
      } catch (e) {
        throw this.log.errorWithException(
          `Could not parse "uninstallOtherPackages" capability: ${(e as Error).message}`,
        );
      }
    }

    return true;
  }

  override async getLogTypes(): Promise<string[]> {
    const nativeLogTypes = await super.getLogTypes();
    if (this.isWebContext() && this.chromedriver) {
      const webLogTypes = (await this.chromedriver.jwproxy.command('/log/types', 'GET')) as string[];
      return [...nativeLogTypes, ...webLogTypes];
    }
    return nativeLogTypes;
  }

  override async getLog(logType: string): Promise<any> {
    if (this.isWebContext() && this.chromedriver && !Object.keys(this.supportedLogTypes).includes(logType)) {
      return await this.chromedriver.jwproxy.command('/log', 'POST', {type: logType});
    }
    return await super.getLog(logType);
  }

  override async deleteSession(sessionId?: string | null) {
    await removeAllSessionWebSocketHandlers.bind(this)();

    try {
      this.adb?.logcat?.removeAllListeners();
      await this.adb?.stopLogcat();
    } catch (e) {
      this.log.warn(`Cannot stop the logcat process. Original error: ${e instanceof Error ? e.message : String(e)}`);
    }

    if (this._bidiServerLogListener) {
      this.log.unwrap().off('log', this._bidiServerLogListener);
    }

    await super.deleteSession(sessionId);
  }
}

Object.assign(AndroidDriver.prototype, {
  // app-management
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
  mobileIsAppInstalled,
  mobileRemoveApp,
  mobileTerminateApp,
  mobileListApps,
  terminateApp,
  removeApp,
  activateApp,
  queryAppState,
  isAppInstalled,
  mobileBackgroundApp,

  // appearance
  mobileGetUiMode,
  mobileSetUiMode,

  // bluetooth
  mobileBluetooth,

  // context/exports
  getContexts,
  getCurrentContext,
  defaultContextName,
  assignContexts,
  switchContext,
  defaultWebviewName,
  isChromedriverContext,
  startChromedriverProxy,
  stopChromedriverProxies,
  suspendChromedriverProxy,
  startChromeSession,
  onChromedriverStop,
  isWebContext,
  mobileGetContexts,
  mobileGetChromeCapabilities,
  setContext,
  setWindow,
  getWindowHandle,
  getWindowHandles,
  notifyBiDiContextChange,

  // device/common
  getDeviceInfoFromCaps,
  createADB,
  getLaunchInfo,
  initDevice,

  // device/emulator-actions
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

  // device/emulator-console
  mobileExecEmuConsoleCommand,

  // deviceidle
  mobileDeviceidle,

  // element
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

  // execute
  execute,

  // file-actions
  pullFile,
  pullFolder,
  pushFile,
  mobileDeleteFile,

  // find
  findElOrEls,
  doFindElementOrEls,

  // geolocation
  setGeoLocation,
  getGeoLocation,
  mobileRefreshGpsCache,
  toggleLocationServices,
  isLocationServicesEnabled,
  mobileGetGeolocation,
  mobileSetGeolocation,
  mobileResetGeolocation,

  // gestures
  performActions,

  // image-injection
  mobileInjectEmulatorCameraImage,

  // ime
  isIMEActivated,
  availableIMEEngines,
  getActiveIMEEngine,
  activateIMEEngine,
  deactivateIMEEngine,
  setStylusHandwriting,

  // intent
  startActivity,
  mobileStartActivity,
  mobileBroadcast,
  mobileStartService,
  mobileStopService,

  // keyboard
  hideKeyboard,
  isKeyboardShown,
  keys,
  doSendKeys,
  pressKeyCode,
  longPressKeyCode,
  mobilePerformEditorAction,

  // legacy
  reset,
  closeApp,
  launchApp,

  // lock/exports
  lock,
  unlock,
  mobileUnlock,
  isLocked,

  // log
  mobileStartLogsBroadcast,
  mobileStopLogsBroadcast,
  assignBiDiLogListener,

  // media-projection
  mobileIsMediaProjectionRecordingRunning,
  mobileStartMediaProjectionRecording,
  mobileStopMediaProjectionRecording,

  // memory
  mobileSendTrimMemory,

  // misc
  getWindowRect,
  getWindowSize,
  getDisplayDensity,
  mobileGetNotifications,
  mobileListSms,
  openNotifications,
  setUrl,

  // network
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

  // nfc
  mobileNfc,

  // performance
  getPerformanceData,
  getPerformanceDataTypes,
  mobileGetPerformanceData,

  // permissions
  mobileChangePermissions,
  mobileGetPermissions,

  // recordscreen
  startRecordingScreen,
  stopRecordingScreen,

  // resources
  getStrings,
  ensureDeviceLocale,

  // shell
  mobileShell,

  // streamscreen
  mobileStartScreenStreaming,
  mobileStopScreenStreaming,

  // system-bars
  getSystemBars,
  mobilePerformStatusBarCommand,

  // time
  getDeviceTime,
  mobileGetDeviceTime,
});

export {AndroidDriver};
