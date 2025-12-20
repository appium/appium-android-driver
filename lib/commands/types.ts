import type {HTTPMethod, StringRecord} from '@appium/types';
import type {AndroidDriverCaps} from '../driver';
import type {SubProcess} from 'teen_process';
import {timing} from '@appium/support';

/**
 * @privateRemarks probably better defined in `appium-adb`
 */
export type GsmAction = 'call' | 'accept' | 'cancel' | 'hold';

/**
 * One of possible signal strength values, where 4 is the best signal.
 * @privateRemarks maybe should be an enum?
 */
export type GsmSignalStrength = 0 | 1 | 2 | 3 | 4;

export type GsmVoiceState = 'on' | 'off';

export type PowerACState = 'on' | 'off';

export type NetworkSpeed =
  | 'gsm'
  | 'scsd'
  | 'gprs'
  | 'edge'
  | 'umts'
  | 'hsdpa'
  | 'lte'
  | 'evdo'
  | 'full';

/**
 * Returned by `queryAppState`
 * - `0` - is the app is not installed
 * - `1` - if the app is installed, but is not running
 * - `3` - if the app is running in the background
 * - `4` - if the app is running in the foreground
 */
export type AppState = 0 | 1 | 3 | 4;

export interface TerminateAppOpts {
  /**
   * The count of milliseconds to wait until the app is terminated.
   * @defaultValue 500
   */
  timeout?: number | string;
}

export interface WebviewsMapping {
  /**
   * The name of the Devtools Unix socket
   */
  proc: string;
  /**
   * The web view alias. Looks like `WEBVIEW_` prefix plus PID or package name
   */
  webview: string;
  /**
   * Webview information as it is retrieved by `/json/version` CDP endpoint
   *
   * This value becomes `undefined` when the retrieval failed.
   */
  info?: StringRecord;
  /**
   * Webview pages list as it is retrieved by `/json/list` CDP endpoint
   *
   * This value becomes `undefined` when the retrieval failed.
   */
  pages?: StringRecord[];
  /**
   * An actual webview name for switching context.
   *
   * This value becomes `null` when failing to find a PID for a webview.
   *
   * In the example, `description` in `page` can be an empty string most likely when it comes to Mobile Chrome.
   *
   * @example
   *
   * ```json
   * {
   *   "proc": "@webview_devtools_remote_22138",
   *   "webview": "WEBVIEW_22138",
   *   "info": {
   *     "Android-Package": "io.appium.settings",
   *     "Browser": "Chrome/74.0.3729.185",
   *     "Protocol-Version": "1.3",
   *     "User-Agent": "Mozilla/5.0 (Linux; Android 10; Android SDK built for x86 Build/QSR1.190920.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/74.0.3729.185 Mobile Safari/537.36",
   *     "V8-Version": "7.4.288.28",
   *     "WebKit-Version": "537.36 (@22955682f94ce09336197bfb8dffea991fa32f0d)",
   *     "webSocketDebuggerUrl": "ws://127.0.0.1:10900/devtools/browser"
   *   },
   *   "pages": [
   *     {
   *       "description": "{\"attached\":true,\"empty\":false,\"height\":1458,\"screenX\":0,\"screenY\":336,\"visible\":true,\"width\":1080}",
   *       "devtoolsFrontendUrl": "http://chrome-devtools-frontend.appspot.com/serve_rev/@22955682f94ce09336197bfb8dffea991fa32f0d/inspector.html?ws=127.0.0.1:10900/devtools/page/27325CC50B600D31B233F45E09487B1F",
   *       "id": "27325CC50B600D31B233F45E09487B1F",
   *       "title": "Releases · appium/appium · GitHub",
   *       "type": "page",
   *       "url": "https://github.com/appium/appium/releases",
   *       "webSocketDebuggerUrl": "ws://127.0.0.1:10900/devtools/page/27325CC50B600D31B233F45E09487B1F"
   *     }
   *   ],
   *   "webviewName": "WEBVIEW_com.io.appium.setting"
   * }
   * ```
   */
  webviewName?: string | null;
}

/**
 * A list of ports.
 *
 * Tuples are used to specify a range of ports.  If values are strings, they
 * must be convertable to integers.
 *
 * @example
 * ```js
 * [8000, 8001, 8002]
 * [[8000, 8005]]
 * [8000, [9000, 9100]]
 * ```
 */
export type PortSpec = Array<
  number | string | [startPort: number | string, endPort: number | string]
>;

export interface DoSetElementValueOpts {
  elementId: string;
  text: string;
  replace: boolean;
}

export interface FindElementOpts {
  strategy: string;
  selector: string;
  context: string;
  multiple: boolean;
}

export interface SendKeysOpts {
  text: string;
  // XXX: unclear if this is required
  replace?: boolean;
}

export interface ListSmsOpts {
  /**
   * Maximum count of recent SMS messages
   * @defaultValue 100
   */
  max?: number;
}

export type UnlockType = 'pin' | 'pinWithKeyEvent' | 'password' | 'pattern';

export type UnlockStrategy = 'locksettings' | 'uiautomator';

export interface IntentOpts {
  /**
   * The user ID for which the service is started.
   * The `current` user id is used by default
   * @defaultValue 'current'
   * @example
   */
  user?: string | number;
  /**
   * The name of the activity intent to start, for example
   * `com.some.package.name/.YourServiceSubClassName`
   */
  intent?: string;
  /**
   * Action name
   */
  action?: string;
  /**
   * Package name
   */
  package?: string;
  /**
   * Unified resource identifier
   */
  uri?: string;
  /**
   * Mime type
   */
  mimeType?: string;
  /**
   * Optional identifier
   */
  identifier?: string;
  /**
   * Component name
   */
  component?: string;

  /**
   * One or more category names
   */
  categories?: string | string[];
  /**
   * Optional intent arguments.
   *
   * Must be represented as array of arrays, where each subarray item contains
   * two or three string items:* value type, key name and the value itself.
   *
   * Supported value types are:
   *
   * - s: string. Value must be a valid string
   * - sn: null. Value is ignored for this type
   * - z: boolean. Value must be either `true` or `false`
   * - i: integer. Value must be a valid 4-byte integer number
   * - l: long. Value must be a valid 8-byte long number
   * - f: float: Value must be a valid float number
   * - u: uri. Value must be a valid uniform resource identifier string
   * - cn: component name. Value must be a valid component name string
   * - ia: Integer[]. Value must be a string of comma-separated integers
   * - ial: List<Integer>. Value must be a string of comma-separated integers
   * - la: Long[]. Value must be a string of comma-separated long numbers
   * - lal: List<Long>. Value must be a string of comma-separated long numbers
   * - fa: Float[]. Value must be a string of comma-separated float numbers
   * - fal: List<Float>. Value must be a string of comma-separated float numbers
   * - sa: String[]. Value must be comma-separated strings. To embed a comma
   *   into a string, escape it using "\,"
   * - sal: List<String>. Value must be comma-separated strings. To embed a
   *   comma into a string, escape it using "\," For example: `[['s',
   *   'varName1', 'My String1'], ['s', 'varName2', 'My String2'], ['ia',
   *   'arrName', '1,2,3,4']]`
   */
  extras?: string[][];

  /**
   * Intent startup-specific flags as a hexadecimal string.
   *
   * See https://developer.android.com/reference/android/content/Intent.html for
   * the list of available flag values (constants starting with
   * `FLAG_ACTIVITY_`). Flag values could be merged using the logical 'or'
   * operation. For example, 0x10200000 is the combination of two flags:
   * 0x10000000 `FLAG_ACTIVITY_NEW_TASK` | 0x00200000
   * `FLAG_ACTIVITY_RESET_TASK_IF_NEEDED`
   */
  flags?: string;
}

export type FormFields = StringRecord | [key: string, value: any][];

export interface GetConnectivityResult {
  /**
   * True if wifi is enabled
   */
  wifi?: boolean;
  /**
   * True if mobile data connection is enabled
   */
  data?: boolean;
  /**
   * True if Airplane Mode is enabled
   */
  airplaneMode?: boolean;
}

export type ServiceType = 'wifi' | 'data' | 'airplaneMode';

export type PerformanceDataType = 'batteryinfo' | 'cpuinfo' | 'memoryinfo' | 'networkinfo';

/**
 * NFC actions that can be performed on the default NFC adapter.
 */
export type NfcAction = 'enable' | 'disable';

/**
 * Represents a device locale with language, country, and optional script.
 */
export interface Locale {
  language: string;
  country: string;
  script?: string;
}

/**
 * Memory trim levels for the onTrimMemory() event.
 * See https://developer.android.com/topic/performance/memory for more details.
 */
export type TrimMemoryLevel =
  | 'COMPLETE'
  | 'MODERATE'
  | 'BACKGROUND'
  | 'UI_HIDDEN'
  | 'RUNNING_CRITICAL'
  | 'RUNNING_LOW'
  | 'RUNNING_MODERATE';

export interface StartScreenRecordingOpts {
  /**
   * The path to the remote location, where the captured video should be
   * uploaded.
   *
   * The following protocols are supported: http/https, ftp. Null or empty
   * string value (the default setting) means the content of resulting file
   * should be encoded as Base64 and passed as the endpount response value. An
   * exception will be thrown if the generated media file is too big to fit into
   * the available process memory. This option only has an effect if there is
   * screen recording process in progreess and `forceRestart` parameter is not
   * set to `true`.
   */
  remotePath?: string;
  /**
   * The name of the user for the remote authentication. Only works if
   * `remotePath` is provided.
   */
  user?: string;
  /**
   * The password for the remote authentication. Only works if `remotePath` is
   * provided.
   */
  pass?: string;
  /**
   * The http multipart upload method name. Only works if `remotePath` is provided.
   * @defaultValue 'PUT
   */
  method?: HTTPMethod;
  /**
   * Additional headers mapping for multipart http(s) uploads
   */
  headers?: StringRecord;
  /**
   * The name of the form field, where the file content BLOB should be stored
   * for http(s) uploads
   * @defaultValue 'file'
   */
  fileFieldName?: string;
  /**
   * Additional form fields for multipart http(s) uploads
   */
  formFields?: FormFields;
  /**
   * The format is `<width>x<height>`.
   *
   * The default value is the device's native display resolution (if supported),
   * `1280x720` if not. For best results, use a size supported by your device's
   * Advanced Video Coding (AVC) encoder. For example, `1280x720`
   */
  videoSize?: string;
  /**
   * Set it to `true` in order to display additional information on the video
   * overlay, such as a timestamp, that is helpful in videos captured to
   * illustrate bugs. This option is only supported since API level 27 (Android
   * P).
   */
  bugReport?: boolean;
  /**
   * The maximum recording time, in seconds.
   *
   * The maximum value is 1800 (30 minutes). If the passed value is greater than
   * 180 then the algorithm will try to schedule multiple screen recording
   * chunks and merge the resulting videos into a single media file using
   * `ffmpeg` utility. If the utility is not available in PATH then the most
   * recent screen recording chunk is going to be returned.
   *
   * @defaultValue 180
   */
  timeLimit?: string | number;
  /**
   * The video bit rate for the video, in bits per second.
   *
   * The default value is 4 Mbit/s. You can increase the bit rate to improve
   * video quality, but doing so results in larger movie files.
   *
   * @defaultValue 4000000
   */
  bitRate?: string | number;
  /**
   * Whether to try to catch and upload/return the currently running screen
   * recording
   *
   * Set to `true` top ignore the result of the currently-running screen
   * recording and start a new recording immediately
   */
  forceRestart?: boolean;
}

export interface StopScreenRecordingOpts {
  /**
   * The path to the remote location, where the resulting video should be
   * uploaded.
   *
   * The following protocols are supported: http/https, ftp. Null or empty
   * string value (the default setting) means the content of resulting file
   * should be encoded as Base64 and passed as the endpount response value. An
   * exception will be thrown if the generated media file is too big to fit into
   * the available process memory.
   */
  remotePath?: string;
  /**
   * The name of the user for the remote authentication.
   */
  user?: string;
  /**
   * The password for the remote authentication.
   */
  pass?: string;
  /**
   * The http multipart upload method name. The 'PUT' one is used by default.
   */
  method?: HTTPMethod;
  /**
   * Additional headers mapping for multipart http(s) uploads
   */
  headers?: StringRecord;
  /**
   * The name of the form field, where the file content BLOB should be stored for http(s) uploads
   *
   * @defaultValue 'file'
   */
  fileFieldName?: string;
  /**
   * Additional form fields for multipart http(s) uploads
   */
  formFields?: FormFields;
}

export interface DeviceInfo {
  width: number;
  height: number;
  fps: number;
  udid: string;
}

/**
 * @internal
 */
export interface InitGStreamerPipelineOpts {
  width?: number | string;
  height?: number | string;
  quality: number;
  tcpPort: number;
  considerRotation?: boolean;
  logPipelineDetails?: boolean;
}
export interface WindowProperties {
  /**
   * Whether the window is visible
   */
  visible: boolean;
  /**
   * Window x coordinate
   */
  x: number;
  /**
   * Window y coordinate
   */
  y: number;
  /**
   * Window width
   */
  width: number;
  /**
   * Window height
   */
  height: number;
}

/**
 * Commands for interacting with the Android status bar.
 *
 * - expandNotifications: Open the notifications panel.
 * - expandSettings: Open the notifications panel and expand quick settings if present.
 * - collapse: Collapse the notifications and settings panel.
 * - addTile: Add a TileService of the specified component.
 * - removeTile: Remove a TileService of the specified component.
 * - clickTile: Click on a TileService of the specified component.
 * - getStatusIcons: Print the list of status bar icons and the order they appear in.
 */
export type StatusBarCommand =
  | 'expandNotifications'
  | 'expandSettings'
  | 'collapse'
  | 'addTile'
  | 'removeTile'
  | 'clickTile'
  | 'getStatusIcons';

export interface SmsListResultItem {
  id: string;
  address: string;
  person: string | null;
  date: string;
  read: string;
  status: string;
  type: string;
  subject: string | null;
  body: string;
  serviceCenter: string | null;
}

export interface SmsListResult {
  items: SmsListResultItem[];
  total: number;
}

export interface GetWebviewsOpts {
  /**
   * device socket name
   */
  androidDeviceSocket?: string | null;
  /**
   * whether to check for webview page presence
   */
  ensureWebviewsHavePages?: boolean | null;
  /**
   * port to use for webview page presence check.
   */
  webviewDevtoolsPort?: number | null;
  /**
   * whether to collect web view details and send them to Chromedriver constructor, so it could select a binary more precisely based on this info.
   */
  enableWebviewDetailsCollection?: boolean | null;
  /**
   * @privateRemarks This is referenced but was not previously declared
   */
  isChromeSession?: boolean;

  waitForWebviewMs?: number | string;
}

export interface ProcessInfo {
  /**
   * The process name
   */
  name: string;
  /**
   * The process id (if could be retrieved)
   */
  id?: string | null;
}

export interface WebViewDetails {
  /**
   * Web view process details
   */
  process?: ProcessInfo | null;
  /**
   * Web view details as returned by /json/version CDP endpoint
   * @example
   * {
   *  "Browser": "Chrome/72.0.3601.0",
   *  "Protocol-Version": "1.3",
   *  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3601.0 Safari/537.36",
   *  "V8-Version": "7.2.233",
   *  "WebKit-Version": "537.36 (@cfede9db1d154de0468cb0538479f34c0755a0f4)",
   *  "webSocketDebuggerUrl": "ws://localhost:9222/devtools/browser/b0b8a4fb-bb17-4359-9533-a8d9f3908bd8"
   * }
   */
  info?: StringRecord;
}

export interface DetailCollectionOptions {
  /**
   * The starting port to use for webview page presence check (if not the default of 9222).
   */
  webviewDevtoolsPort?: number | null;
  /**
   * Whether to check for webview pages presence
   */
  ensureWebviewsHavePages?: boolean | null;
  /**
   * Whether to collect web view details and send them to Chromedriver constructor, so it could
   * select a binary more precisely based on this info.
   */
  enableWebviewDetailsCollection?: boolean | null;
}

export interface WebviewProps {
  /**
   * The name of the Devtools Unix socket
   */
  proc: string;
  /**
   * The web view alias. Looks like `WEBVIEW_` prefix plus PID or package name
   */
  webview: string;
  /**
   * Webview information as it is retrieved by /json/version CDP endpoint
   */
  info?: object | null;
  /**
   * Webview pages list as it is retrieved by /json/list CDP endpoint
   */
  pages?: object[] | null;
}

export interface WebviewProc {
  /**
   * The webview process name (as returned by getPotentialWebviewProcs)
   */
  proc: string;
  /**
   * The actual webview context name
   */
  webview: string;
}

export interface FastUnlockOptions {
  credential: string;
  /**
   * @privateRemarks FIXME: narrow this type to whatever `appium-adb` expects
   */
  credentialType: string;
}

export interface ADBDeviceInfo {
  udid: string;
  emPort: number | false;
}

export type ADBLaunchInfo = Pick<
  AndroidDriverCaps,
  'appPackage' | 'appWaitActivity' | 'appActivity' | 'appWaitPackage'
>;

export interface InjectedImageSize {
  /** X scale value in range (0..) */
  scaleX?: number;
  /** Y scale value in range (0..) */
  scaleY?: number;
}

export interface InjectedImagePosition {
  /** Normalized X coordinate, where 0 means the image is centered on the viewport */
  x?: number;
  /** Normalized Y coordinate, where 0 means the image is centered on the viewport */
  y?: number;
  /** Normalized Z coordinate, where 0 means the image is centered on the viewport */
  z?: number;
}

export interface InjectedImageRotation {
  /** X rotation value in degrees */
  x?: number;
  /** Y rotation value in degrees */
  y?: number;
  /** Z rotation value in degrees */
  z?: number;
}

export interface InjectedImageProperties {
  size?: InjectedImageSize;
  position?: InjectedImagePosition;
  rotation?: InjectedImageRotation;
}

/**
 * @internal
 */
export interface ScreenRecordingProperties {
  timer: timing.Timer;
  videoSize?: string;
  timeLimit: string | number;
  currentTimeLimit?: string | number;
  bitRate?: string | number;
  bugReport?: boolean;
  records: string[];
  recordingProcess: SubProcess | null;
  stopped: boolean;
}
