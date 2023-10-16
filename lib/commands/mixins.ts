import type {
  AppiumLogger,
  Element,
  ExternalDriver,
  LogDefRecord,
  Orientation,
  Position,
  Rect,
  Size,
  StringRecord,
  Location,
} from '@appium/types';
import type {
  ADB,
  InstallOptions,
  LogcatListener,
  SmsListResult,
  UninstallOptions,
} from 'appium-adb';
import type Chromedriver from 'appium-chromedriver';
import {AndroidDriverOpts, AndroidDriver} from '../driver';
import type * as types from './types';

export interface ActionsMixin {
  keyevent(keycode: string | number, metastate?: number): Promise<void>;
  pressKeyCode(keycode: string | number, metastate?: number, flags?: any): Promise<void>;
  longPressKeyCode(keycode: string | number, metastate?: number, flags?: any): Promise<void>;
  getOrientation(): Promise<Orientation>;
  setOrientation(orientation: Orientation): Promise<void>;
  fakeFlick(xSpeed: number, ySpeed: number): Promise<void>;
  fakeFlickElement(
    elementId: string,
    xoffset: number,
    yoffset: number,
    speed: number
  ): Promise<void>;
  swipe(
    startX: number | 'null',
    startY: number | 'null',
    endX: number,
    endY: number,
    duration: number,
    touchCount: number,
    elId: string
  ): Promise<void>;
  doSwipe(opts: types.SwipeOpts): Promise<void>;
  pinchClose(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    duration: number,
    percent: number,
    steps: number,
    elId: string
  ): Promise<void>;
  pinchOpen(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    duration: number,
    percent: number,
    steps: number,
    elId: string
  ): Promise<void>;
  flick(
    element: string,
    xSpeed: number,
    ySpeed: number,
    xOffset: number,
    yOffset: number,
    speed: number
  ): Promise<void>;
  drag(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    duration: number,
    touchCount: number,
    elementId?: string | number,
    destElId?: string | number
  ): Promise<void>;
  doDrag(opts: types.DragOpts): Promise<void>;
  lock(seconds?: number): Promise<void>;
  /**
   * Lock the device (and optionally unlock it after a certain amount of time).
   * @throws {Error} if lock or unlock operation fails
   */
  mobileLock(opts: types.LockOpts): Promise<void>;
  unlock(): Promise<void>;
  isLocked(): Promise<boolean>;
  openNotifications(): Promise<void>;
  setLocation(latitude: number, longitude: number): Promise<void>;
  /**
   * @group Emulator Only
   */
  fingerprint(fingerprintId: string | number): Promise<void>;
  /**
   * Emulate fingerprint on Android Emulator.
   * Only works on API 23+
   * @group Emulator Only
   */
  mobileFingerprint(opts: types.FingerprintOpts): Promise<void>;
  /**
   * @group Emulator Only
   */
  sendSMS(phoneNumber: string, message: string): Promise<void>;

  /**
   * Emulate sending an SMS to the given phone number.
   * Only works on emulators.
   *
   * @group Emulator Only
   */
  mobileSendSms(opts: types.SendSMSOpts): Promise<void>;

  /**
   * @group Emulator Only
   */
  gsmCall(phoneNumber: string, action: string): Promise<void>;

  /**
   * Emulate a GSM call to the given phone number.
   * Only works on emulators.
   *
   * @group Emulator Only
   */
  mobileGsmCall(opts: types.GsmCallOpts): Promise<void>;

  /**
   * @group Emulator Only
   */
  gsmSignal(signalStrength: types.GsmSignalStrength): Promise<void>;
  /**
   * Emulate GSM signal strength change event.
   * Only works on emulators.
   *
   * @group Emulator Only
   */
  mobileGsmSignal(opts: types.GsmSignalStrengthOpts): Promise<void>;
  /**
   * @group Emulator Only
   */
  gsmVoice(state: types.GsmVoiceState): Promise<void>;

  /**
   * Emulate GSM voice state change event.
   * Only works on emulators.
   */
  mobileGsmVoice(opts: types.GsmVoiceOpts): Promise<void>;
  /**
   * @group Emulator Only
   */
  powerAC(state: types.PowerACState): Promise<void>;
  /**
   * Emulate AC power state change.
   * Only works on emulators.
   *
   * @group Emulator Only
   */
  mobilePowerAc(opts: types.PowerACOpts): Promise<void>;

  /**
   * @group Emulator Only
   */
  powerCapacity(percent: number): Promise<void>;

  /**
   * Emulate power capacity change.
   * Only works on emulators.
   *
   * @group Emulator Only
   */
  mobilePowerCapacity(opts: types.PowerCapacityOpts): Promise<void>;

  /**
   * @group Emulator Only
   */
  networkSpeed(networkSpeed: types.NetworkSpeed): Promise<void>;

  /**
   * Emulate different network connection speed modes.
    Only works on emulators.
   *
   * @group Emulator Only
   */
  mobileNetworkSpeed(opts: types.NetworkSpeedOpts): Promise<void>;

  /**
   * Emulate sensors values on the connected emulator.
   * @group Emulator Only
   * @throws {Error} - If sensorType is not defined
   * @throws {Error} - If value for the sensor is not defined
   * @throws {Error} - If deviceType is not an emulator
   */
  sensorSet(opts: types.SensorSetOpts): Promise<void>;

  getScreenshot(): Promise<string>;
}

export type AlertMixin = Required<
  Pick<ExternalDriver, 'getAlertText' | 'setAlertText' | 'postAcceptAlert' | 'postDismissAlert'>
>;

export interface AppManagementMixin {
  /**
   * Installs the given application to the device under test
   * @throws {Error} if the given apk does not exist or is not reachable
   */
  installApp(appId: string, opts?: Omit<InstallOptions, 'appId'>): Promise<void>;
  /**
   * Terminates the app if it is running.
   *
   * If the given timeout was lower or equal to zero, it returns true after
   * terminating the app without checking the app state.
   * @throws {Error} if the app has not been terminated within the given timeout.
   */
  terminateApp(appId: string, opts?: Omit<types.TerminateAppOpts, 'appId'>): Promise<boolean>;
  /**
   * Remove the corresponding application if is installed.
   *
   * The call is ignored if the app is not installed.
   *
   * @returns `true` if the package was found on the device and
   * successfully uninstalled.
   */
  removeApp(appId: string, opts: Omit<UninstallOptions, 'appId'>): Promise<boolean>;
  /**
   * Activates the given application or launches it if necessary.
   *
   * The action literally simulates clicking the corresponding application
   * icon on the dashboard.
   *
   * @throws {Error} If the app cannot be activated
   */
  activateApp(appId: string): Promise<void>;
  /**
   * Queries the current state of the app.
   * @returns The corresponding constant, which describes the current application state.
   */
  queryAppState(appId: string): Promise<types.AppState>;
  /**
   * Determine whether an app is installed
   */
  isAppInstalled(appId: string): Promise<boolean>;
  /**
   * Installs the given application to the device under test
   * @throws {Error} if the given apk does not exist or is not reachable
   */
  mobileInstallApp(opts: types.InstallAppOpts): Promise<void>;
  /**
   * Terminates the app if it is running.
   *
   * If the given timeout was lower or equal to zero, it returns true after
   * terminating the app without checking the app state.
   * @throws {Error} if the app has not been terminated within the given timeout.
   */
  mobileTerminateApp(opts: types.TerminateAppOpts): Promise<boolean>;
  /**
   * Remove the corresponding application if is installed.
   *
   * The call is ignored if the app is not installed.
   *
   * @returns `true` if the package was found on the device and
   * successfully uninstalled.
   */
  mobileRemoveApp(opts: types.RemoveAppOpts): Promise<boolean>;
  /**
   *
   * Activates the given application or launches it if necessary.
   *
   * The action literally simulates clicking the corresponding application
   * icon on the dashboard.
   *
   * @throws {Error} If the app cannot be activated
   */
  mobileActivateApp(opts: types.ActivateAppOpts): Promise<void>;
  /**
   * Queries the current state of the app.
   * @returns The corresponding constant, which describes the current application state.
   */
  mobileQueryAppState(opts: types.QueryAppStateOpts): Promise<types.AppState>;
  /**
   * Determine whether an app is installed
   */
  mobileIsAppInstalled(opts: types.IsAppInstalledOpts): Promise<boolean>;
  /**
   * Deletes all data associated with a package.
   *
   * @throws {Error} If cleaning of the app data fails
   */
  mobileClearApp(opts: types.ClearAppOpts): Promise<void>;
}

export interface ContextMixin {
  getCurrentContext(): Promise<string>;
  getContexts(): Promise<string[]>;
  setContext(name?: string): Promise<void>;
  defaultContextName(): string;
  defaultWebviewName(): string;
  assignContexts(mappings: types.WebviewsMapping[]): string[];
  /**
   * Returns a webviewsMapping based on CDP endpoints
   */
  mobileGetContexts(): Promise<types.WebviewsMapping[]>;

  switchContext(name: string, mappings: types.WebviewsMapping[]): Promise<void>;

  isWebContext(): boolean;

  startChromedriverProxy(context: string, mappings: types.WebviewsMapping[]): Promise<void>;
  onChromedriverStop(context: string): Promise<void>;

  isChromedriverContext(viewName: string): boolean;
  shouldDismissChromeWelcome(): boolean;
  dismissChromeWelcome(): Promise<void>;
  startChromeSession(): Promise<void>;
  /**
   * @internal
   */
  setupExistingChromedriver(log: AppiumLogger, chromedriver: Chromedriver): Promise<Chromedriver>;
  /**
   * Find a free port to have Chromedriver listen on.
   *
   * @param portSpec - List of ports.
   * @param log Logger instance
   * @internal
   * @returns free port
   */
  getChromedriverPort(portSpec?: types.PortSpec, log?: AppiumLogger): Promise<number>;

  /**
   * @internal
   */
  isChromedriverAutodownloadEnabled(): boolean;

  /**
   * @internal
   * @param opts
   * @param curDeviceId
   * @param adb
   * @param context
   */
  setupNewChromedriver(
    opts: AndroidDriverOpts,
    curDeviceId: string,
    adb: ADB,
    context?: string
  ): Promise<Chromedriver>;

  suspendChromedriverProxy(): void;

  stopChromedriverProxies(): Promise<void>;
}

export interface ElementMixin {
  getAttribute(attribute: string, elementId: string): Promise<string>;
  getName(elementId: string): Promise<string>;
  elementDisplayed(elementId: string): Promise<boolean>;
  elementEnabled(elementId: string): Promise<boolean>;
  elementSelected(elementId: string): Promise<boolean>;
  setElementValue(keys: string | string[], elementId: string, replace?: boolean): Promise<void>;
  doSetElementValue(opts: types.DoSetElementValueOpts): Promise<void>;
  setValue(keys: string | string[], elementId: string): Promise<void>;
  replaceValue(keys: string | string[], elementId: string): Promise<void>;
  setValueImmediate(keys: string | string[], elementId: string): Promise<void>;
  getText(elementId: string): Promise<string>;
  clear(elementId: string): Promise<void>;

  click(elementId: string): Promise<void>;
  getLocation(elementId: string): Promise<Position>;
  getLocationInView(elementId: string): Promise<Position>;

  getSize(elementId: string): Promise<Size>;
  getElementRect(elementId: string): Promise<Rect>;

  touchLongClick(elementId: string, x: number, y: number, duration: number): Promise<void>;
  touchDown(elementId: string, x: number, y: number): Promise<void>;
  touchUp(elementId: string, x: number, y: number): Promise<void>;
  touchMove(elementId: string, x: number, y: number): Promise<void>;
  complexTap(
    tapCount: number,
    touchCount: number,
    duration: number,
    x: number,
    y: number
  ): Promise<void>;
  tap(
    elementId?: string | null,
    x?: number | null,
    y?: number | null,
    count?: number
  ): Promise<void>;
}

export interface EmulatorConsoleMixin {
  /**
   * Executes a command through emulator telnet console interface and returns its output.
   * The `emulator_console` server feature must be enabled in order to use this method.
   *
   * @returns The command output
   * @throws {Error} If there was an error while connecting to the Telnet console
   * or if the given command returned non-OK response
   */
  mobileExecEmuConsoleCommand(opts: types.ExecOptions): Promise<string>;
}

export interface ExecuteMixin {
  execute(script: string, args?: unknown[]): Promise<unknown>;
  executeMobile(mobileCommand: string, opts?: StringRecord): Promise<unknown>;
}

export interface FileActionsMixin {
  /**
   * Pulls a remote file from the device.
   *
   * It is required that a package has debugging flag enabled in order to access its files.
   *
   * @param remotePath The full path to the remote file or a specially formatted path, which points to an item inside app bundle
   * @returns Base64 encoded content of the pulled file
   * @throws {Error} If the pull operation failed
   */
  pullFile(remotePath: string): Promise<string>;

  /**
   * Pulls a remote file from the device.
   *
   * @param opts
   * @returns The same as {@linkcode pullFile}
   */
  mobilePullFile(opts: types.PullFileOpts): Promise<string>;
  /**
   * Pushes the given data to a file on the remote device
   *
   * It is required that a package has debugging flag enabled in order to access
   * its files.
   *
   * After a file is pushed, it gets automatically scanned for possible media
   * occurrences. The file is added to the media library if the scan succeeds.
   *
   * @param remotePath The full path to the remote file or a file
   * inside a package bundle
   * @param base64Data Base64 encoded data to be written to the remote
   * file. The remote file will be silently overridden if it already exists.
   * @throws {Error} If there was an error while pushing the data
   */
  pushFile(remotePath: string, base64Data: string): Promise<void>;

  /**
   * Pushes the given data to a file on the remote device.
   */
  mobilePushFile(opts: types.PushFileOpts): Promise<void>;
  /**
   * Pulls the whole folder from the remote device
   *
   * @param remotePath The full path to a folder on the remote device or a folder inside an application bundle
   * @returns Base64-encoded and zipped content of the folder
   * @throws {Error} If there was a failure while getting the folder content
   */
  pullFolder(remotePath: string): Promise<string>;

  /**
   * Pulls the whole folder from the device under test.
   *
   * @returns The same as {@linkcode pullFolder}
   */
  mobilePullFolder(opts: types.PullFolderOpts): Promise<string>;

  /**
   * Deletes a file on the remote device
   *
   * @returns `true` if the remote file has been successfully deleted.  If the
   * path to a remote file is valid, but the file itself does not exist then
   * `false` is returned.
   * @throws {Error} If the argument is invalid or there was an error while
   * deleting the file
   */
  mobileDeleteFile(opts: types.DeleteFileOpts): Promise<boolean>;
}

export interface FindMixin {
  /**
   * @remarks The reason for isolating `doFindElementOrEls` from {@linkcode findElOrEls} is for reusing `findElOrEls`
   * across android-drivers (like `appium-uiautomator2-driver`) to avoid code duplication.
   * Other android-drivers (like `appium-uiautomator2-driver`) need to override `doFindElementOrEls`
   * to facilitate `findElOrEls`.
   */
  doFindElementOrEls(opts: types.FindElementOpts): Promise<Element | Element[]>;

  /**
   * Find an element or elements
   * @param strategy locator strategy
   * @param selector actual selector for finding an element
   * @param mult multiple elements or just one?
   * @param context finding an element from the root context? or starting from another element
   */
  findElOrEls(strategy: string, selector: string, mult: true, context?: any): Promise<Element[]>;
  findElOrEls(strategy: string, selector: string, mult: false, context?: any): Promise<Element>;
}

export interface GeneralMixin {
  keys(keys: string | string[]): Promise<void>;
  doSendKeys(opts: types.SendKeysOpts): Promise<void>;
  /**
   * Retrieves the current device's timestamp.
   *
   * @param format - The set of format specifiers. Read {@link https://momentjs.com/docs/} to get the full list of supported format specifiers. The default format is `YYYY-MM-DDTHH:mm:ssZ`, which complies to ISO-8601
   * @return Formatted datetime string or the raw command output if formatting fails
   */
  getDeviceTime(format?: string): Promise<string>;
  /**
   * Retrieves the current device time
   *
   * @return Formatted datetime string or the raw command output if formatting fails
   */
  mobileGetDeviceTime(opts: types.DeviceTimeOpts): Promise<string>;

  getPageSource(): Promise<string>;

  openSettingsActivity(setting: string): Promise<void>;

  getWindowSize(): Promise<Size>;

  back(): Promise<void>;

  getWindowRect(): Promise<Rect>;
  getCurrentActivity(): Promise<string>;

  getCurrentPackage(): Promise<string>;

  background(seconds: number): Promise<string | true>;

  getStrings(language?: string | null): Promise<StringRecord>;

  launchApp(): Promise<void>;

  startActivity(
    appPackage: string,
    appActivity?: string,
    appWaitPackage?: string,
    appWaitActivity?: string,
    intentAction?: string,
    intentCategory?: string,
    intentFlags?: string,
    optionalIntentArguments?: string,
    dontStopAppOnReset?: boolean
  ): Promise<void>;

  _cachedActivityArgs: StringRecord;

  reset(): Promise<void>;

  startAUT(): Promise<void>;

  setUrl(uri: string): Promise<void>;

  closeApp(): Promise<void>;

  getDisplayDensity(): Promise<number>;

  mobilePerformEditorAction(opts: types.PerformEditorActionOpts): Promise<void>;
  /**
   * Retrieves the list of recent system notifications.
   *
   * @returns See the documentation on `adb.getNotifications` for more details
   */
  mobileGetNotifications(): Promise<StringRecord>;

  /**
   * Retrieves the list of recent SMS messages with their properties.
   * @returns See the documentation on `adb.getSmsList` for more details
   */
  mobileListSms(opts: types.ListSmsOpts): Promise<SmsListResult>;

  /**
   * Unlocks the device if it is locked. Noop if the device's screen is not locked.
   *
   * @throws {Error} if unlock operation fails or the provided arguments are not valid
   */
  mobileUnlock(opts: types.UnlockOptions): Promise<void>;
}

export interface IMEMixin {
  isIMEActivated: () => Promise<boolean>;
  availableIMEEngines: () => Promise<string[]>;
  getActiveIMEEngine: () => Promise<string>;
  activateIMEEngine: (imeId: string) => Promise<void>;
  deactivateIMEEngine: () => Promise<void>;
}

export interface ActivityMixin {
  /**
   * Starts the given activity intent.
   *
   * @param opts
   * @returns The command output
   * @throws {Error} If there was a failure while starting the activity
   * or required options are missing
   */
  mobileStartActivity(opts?: types.StartActivityOpts): Promise<string>;
  /**
   * Send a broadcast intent.
   *
   * @returns The command output
   * @throws {Error} If there was a failure while starting the activity
   * or required options are missing
   */
  mobileBroadcast(opts?: types.BroadcastOpts): Promise<string>;
  /**
   * Starts the given service intent.
   *
   * @returns The command output
   * @throws {Error} If there was a failure while starting the service
   * or required options are missing
   */
  mobileStartService(opts?: types.StartServiceOpts): Promise<string>;
  /**
   * Stops the given service intent.
   *
   * @returns The command output
   * @throws {Error} If there was a failure while stopping the service
   * or required options are missing
   */
  mobileStopService(opts?: types.StopServiceOpts): Promise<string>;
}

export interface KeyboardMixin {
  hideKeyboard(): Promise<boolean>;
  isKeyboardShown(): Promise<boolean>;
}

export interface LogMixin {
  supportedLogTypes: Readonly<LogDefRecord>;
  mobileStartLogsBroadcast(): Promise<void>;
  mobileStopLogsBroadcast(): Promise<void>;
  getLogTypes(): Promise<string[]>;
  getLog(logType: string): Promise<any>;
  _logcatWebsocketListener?: LogcatListener;
}

export interface MediaProjectionMixin {
  /**
   * Record the display of a real devices running Android 10 (API level 29) and higher.
   * The screen activity is recorded to a MPEG-4 file. Audio is also recorded by default
   * (only for apps that allow it in their manifests).
   * If another recording has been already started then the command will exit silently.
   * The previously recorded video file is deleted when a new recording session is started.
   * Recording continues it is stopped explicitly or until the timeout happens.
   *
   * @param opts Available options.
   * @returns `true` if a new recording has successfully started.
   * @throws {Error} If recording has failed to start or is not supported on the device under test.
   */
  mobileStartMediaProjectionRecording(
    opts?: types.StartMediaProjectionRecordingOpts
  ): Promise<boolean>;
  /**
   * Checks if a media projection-based recording is currently running.
   *
   * @returns `true` if a recording is in progress.
   * @throws {Error} If a recording is not supported on the device under test.
   */
  mobileIsMediaProjectionRecordingRunning(): Promise<boolean>;
  /**
   * Stop a media projection-based recording.
   * If no recording has been started before then an error is thrown.
   * If the recording has been already finished before this API has been called
   * then the most recent recorded file is returned.
   *
   * @param opts Available options.
   * @returns Base64-encoded content of the recorded media file if 'remotePath'
   * parameter is falsy or an empty string.
   * @throws {Error} If there was an error while stopping a recording,
   * fetching the content of the remote media file,
   * or if a recording is not supported on the device under test.
   */
  mobileStopMediaProjectionRecording(
    opts?: types.StopMediaProjectionRecordingOpts
  ): Promise<string>;
}

export interface NetworkMixin {
  getNetworkConnection(): Promise<number>;
  /**
   * decoupling to override the behaviour in other drivers like UiAutomator2.
   */
  isWifiOn(): Promise<boolean>;
  /**
   * Set the connectivity state for different services
   *
   * @throws {Error} If none of known properties were provided or there was an error
   * while changing connectivity states
   */
  mobileSetConnectivity(opts?: types.SetConnectivityOpts): Promise<void>;
  /**
   * Retrieves the connectivity properties from the device under test
   *
   * @param opts If no service names are provided then the connectivity state is
   * returned for all of them.
   */
  mobileGetConnectivity(opts?: types.GetConnectivityOpts): Promise<types.GetConnectivityResult>;
  setNetworkConnection(type: number): Promise<number>;
  /**
   * decoupling to override behaviour in other drivers like UiAutomator2.
   */
  setWifiState(state: boolean): Promise<void>;
  toggleData(): Promise<void>;
  toggleWiFi(): Promise<void>;
  toggleFlightMode(): Promise<void>;
  setGeoLocation(location: Location): Promise<Location>;
  getGeoLocation(): Promise<Location>;
  /**
   * Sends an async request to refresh the GPS cache.
   *
   * This feature only works if the device under test has Google Play Services
   * installed. In case the vanilla LocationManager is used the device API level
   * must be at version 30 (Android R) or higher.
   *
   */
  mobileRefreshGpsCache(opts: types.GpsCacheRefreshOpts): Promise<void>;
  /**
   * Checks if GPS is enabled
   *
   * @returns True if yes
   */
  isLocationServicesEnabled(): Promise<boolean>;
  /**
   * Toggles GPS state
   */
  toggleLocationServices(): Promise<void>;
}

export interface PerformanceMixin {
  getPerformanceDataTypes(): Promise<types.PerformanceDataType[]>;

  /**
   * @returns The information type of the system state which is supported to read as like cpu, memory, network traffic, and battery.
   * input - (packageName) the package name of the application
   *        (dataType) the type of system state which wants to read. It should be one of the keys of the SUPPORTED_PERFORMANCE_DATA_TYPES
   *        (dataReadTimeout) the number of attempts to read
   * output - table of the performance data, The first line of the table represents the type of data. The remaining lines represent the values of the data.
   *
   * in case of battery info : [[power], [23]]
   * in case of memory info :  [[totalPrivateDirty, nativePrivateDirty, dalvikPrivateDirty, eglPrivateDirty, glPrivateDirty, totalPss,
   *   nativePss, dalvikPss, eglPss, glPss, nativeHeapAllocatedSize, nativeHeapSize], [18360, 8296, 6132, null, null, 42588, 8406, 7024, null, null, 26519, 10344]]
   * in case of network info : [[bucketStart, activeTime, rxBytes, rxPackets, txBytes, txPackets, operations, bucketDuration,],
   *   [1478091600000, null, 1099075, 610947, 928, 114362, 769, 0, 3600000], [1478095200000, null, 1306300, 405997, 509, 46359, 370, 0, 3600000]]
   * in case of network info : [[st, activeTime, rb, rp, tb, tp, op, bucketDuration], [1478088000, null, null, 32115296, 34291, 2956805, 25705, 0, 3600],
   *   [1478091600, null, null, 2714683, 11821, 1420564, 12650, 0, 3600], [1478095200, null, null, 10079213, 19962, 2487705, 20015, 0, 3600],
   *   [1478098800, null, null, 4444433, 10227, 1430356, 10493, 0, 3600]]
   * in case of cpu info : [[user, kernel], [0.9, 1.3]]
   *
   * @privateRemarks XXX: type the result
   */
  getPerformanceData(
    packageName: string,
    dataType: types.PerformanceDataType,
    retries?: number
  ): Promise<any[][]>;
  /**
   * Retrieves performance data about the given Android subsystem.
   * The data is parsed from the output of the dumpsys utility.
   *
   * @returns The output depends on the selected subsystem.
   * It is orginized into a table, where the first row represent column names
   * and the following rows represent the sampled data for each column.
   * Example output for different data types:
   * - batteryinfo: [[power], [23]]
   * - memory info: [[totalPrivateDirty, nativePrivateDirty, dalvikPrivateDirty, eglPrivateDirty, glPrivateDirty, totalPss,
   *   nativePss, dalvikPss, eglPss, glPss, nativeHeapAllocatedSize, nativeHeapSize], [18360, 8296, 6132, null, null, 42588, 8406, 7024, null, null, 26519, 10344]]
   * - networkinfo: [[bucketStart, activeTime, rxBytes, rxPackets, txBytes, txPackets, operations, bucketDuration,],
   *   [1478091600000, null, 1099075, 610947, 928, 114362, 769, 0, 3600000], [1478095200000, null, 1306300, 405997, 509, 46359, 370, 0, 3600000]]
   *
   *   [[st, activeTime, rb, rp, tb, tp, op, bucketDuration], [1478088000, null, null, 32115296, 34291, 2956805, 25705, 0, 3600],
   *   [1478091600, null, null, 2714683, 11821, 1420564, 12650, 0, 3600], [1478095200, null, null, 10079213, 19962, 2487705, 20015, 0, 3600],
   *   [1478098800, null, null, 4444433, 10227, 1430356, 10493, 0, 3600]]
   * - cpuinfo: [[user, kernel], [0.9, 1.3]]
   */
  mobileGetPerformanceData(opts: types.PerformanceDataOpts): Promise<any[][]>;
}

export interface PermissionsMixin {
  /**
   * Changes package permissions in runtime.
   *
   * @param opts - Available options mapping.
   * @throws {Error} if there was a failure while changing permissions
   */
  mobileChangePermissions(opts: types.ChangePermissionsOpts): Promise<void>;
  /**
   * Gets runtime permissions list for the given application package.
   *
   * opts - Available options mapping.
   * @returns The list of retrieved permissions for the given type
   * (can also be empty).
   * @throws {Error} if there was an error while getting permissions.
   */
  mobileGetPermissions(opts: types.GetPermissionsOpts): Promise<string[]>;
}

export interface RecordScreenMixin {
  /**
   * @privateRemarks FIXME: type this properly
   */
  _screenRecordingProperties?: StringRecord;
  /**
   * Record the display of a real devices running Android 4.4 (API level 19) and
   * higher.
   *
   * Emulators are supported since API level 27 (Android P). It records screen
   * activity to an MPEG-4 file. Audio is not recorded with the video file. If
   * screen recording has been already started then the command will stop it
   * forcefully and start a new one. The previously recorded video file will be
   * deleted.
   *
   * @param opts - The available options.
   * @returns Base64-encoded content of the recorded media file if any screen
   * recording is currently running or an empty string.
   * @throws {Error} If screen recording has failed to start or is not supported
   * on the device under test.
   */
  startRecordingScreen(opts?: types.StartScreenRecordingOpts): Promise<string>;
  /**
   * Stop recording the screen.
   *
   * If no screen recording has been started before then the method returns an
   * empty string.
   *
   * @param opts - The available options.
   * @returns Base64-encoded content of the recorded media file if `remotePath`
   * option is falsy or an empty string.
   * @throws {Error} If there was an error while getting the name of a media
   * file or the file content cannot be uploaded to the remote location or
   * screen recording is not supported on the device under test.
   */
  stopRecordingScreen(opts?: types.StopScreenRecordingOpts): Promise<string>;
}

export interface ShellMixin {
  mobileShell(opts?: types.ShellOpts): Promise<string | {stderr: string; stdout: string}>;
}

export interface StreamScreenMixin {
  _screenStreamingProps?: StringRecord;
  /**
   * Starts device screen broadcast by creating MJPEG server. Multiple calls to
   * this method have no effect unless the previous streaming session is stopped.
   * This method only works if the `adb_screen_streaming` feature is enabled on
   * the server side.
   *
   * @param opts - The available options.
   * @throws {Error} If screen streaming has failed to start or is not
   * supported on the host system or the corresponding server feature is not
   * enabled.
   */
  mobileStartScreenStreaming(opts?: types.StartScreenStreamingOpts): Promise<void>;

  /**
   * Stop screen streaming.
   *
   * If no screen streaming server has been started then nothing is done.
   */
  mobileStopScreenStreaming(): Promise<void>;
}

export interface SystemBarsMixin {
  getSystemBars(): Promise<StringRecord>;
  /**
   * Performs commands on the system status bar.
   *
   * A thin wrapper over `adb shell cmd statusbar` CLI. Works on Android Oreo and newer.
   *
   * @returns The actual output of the downstream console command.
   */
  mobilePerformStatusBarCommand(opts?: types.StatusBarCommandOpts): Promise<string>;
}

export interface TouchMixin {
  /**
   * @privateRemarks the shape of opts is dependent on the value of action, and
   * this can be further narrowed to avoid all of the type assertions below.
   */
  doTouchAction(action: types.TouchActionKind, opts?: types.TouchActionOpts): Promise<void>;

  /**
   * @privateRemarks drag is *not* press-move-release, so we need to translate.
   * drag works fine for scroll, as well
   */
  doTouchDrag(gestures: types.TouchDragAction): Promise<void>;

  /**
   * @privateRemarks Release gesture needs element or co-ordinates to release it
   * from that position or else release gesture is performed from center of the
   * screen, so to fix it This method sets co-ordinates/element to release
   * gesture if it has no options set already.
   */
  fixRelease(gestures: types.TouchAction[]): Promise<types.TouchAction | undefined>;

  /**
   * Performs a single gesture
   */
  performGesture(gesture: types.TouchAction): Promise<void>;

  getSwipeOptions(gestures: types.SwipeAction, touchCount?: number): Promise<types.TouchSwipeOpts>;

  performTouch(gestures: types.TouchAction[]): Promise<void>;
  parseTouch(gestures: types.TouchAction[], mult?: boolean): Promise<types.TouchState[]>;
  performMultiAction(actions: types.TouchAction[], elementId: string): Promise<void>;
  /**
   * @privateRemarks Reason for isolating `doPerformMultiAction` from
   * {@link performMultiAction} is for reusing `performMultiAction` across android-drivers
   * (like `appium-uiautomator2-driver`) and to avoid code duplication. Other
   * android-drivers (like `appium-uiautomator2-driver`) need to override
   * `doPerformMultiAction` to facilitate `performMultiAction`.
   */
  doPerformMultiAction(elementId: string, states: types.TouchState[]): Promise<void>;
}

export interface DeviceidleMixin {
  mobileDeviceidle(opts: types.DeviceidleOpts): Promise<void>;
}

declare module '../driver' {
  interface AndroidDriver
    extends ActionsMixin,
      AlertMixin,
      AppManagementMixin,
      ContextMixin,
      ElementMixin,
      EmulatorConsoleMixin,
      ExecuteMixin,
      FileActionsMixin,
      FindMixin,
      GeneralMixin,
      IMEMixin,
      ActivityMixin,
      KeyboardMixin,
      LogMixin,
      MediaProjectionMixin,
      NetworkMixin,
      PerformanceMixin,
      PermissionsMixin,
      RecordScreenMixin,
      ShellMixin,
      StreamScreenMixin,
      SystemBarsMixin,
      DeviceidleMixin,
      TouchMixin {}
}

/**
 * This function assigns a mixin `T` to the `AndroidDriver` class' prototype.
 *
 * While each mixin has its own interface which is (in isolation) unrelated to
 * `AndroidDriver`, the constraint on this generic type `T` is that it must be a
 * partial of `AndroidDriver`'s interface. This enforces that it does not
 * conflict with the existing interface of `AndroidDriver`.  In that way, you
 * can think of it as a type guard.
 * @param mixin Mixin implementation
 */
export function mixin<T extends Partial<AndroidDriver>>(mixin: T): void {
  Object.assign(AndroidDriver.prototype, mixin);
}
