import type {HTTPMethod, StringRecord} from '@appium/types';
import type {InstallOptions, UninstallOptions} from 'appium-adb';
import type {AndroidDriverCaps} from '../driver';

export interface SwipeOpts {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  steps: number;
  elementId?: string | number;
}

export interface DragOpts {
  elementId?: string | number;
  destElId?: string | number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  steps: number;
}

/**
 * @privateRemarks probably better defined in `appium-adb`
 */
export type GsmAction = 'call' | 'accept' | 'cancel' | 'hold';

export interface GsmCallOpts {
  /**
   * The phone number to call to
   */
  phoneNumber: string;
  /**
   * Action to take
   */
  action: GsmAction;
}

/**
 * One of possible signal strength values, where 4 is the best signal.
 * @privateRemarks maybe should be an enum?
 */
export type GsmSignalStrength = 0 | 1 | 2 | 3 | 4;

export interface GsmSignalStrengthOpts {
  /**
   * The signal strength value
   */
  strength: GsmSignalStrength;
}

export interface SendSMSOpts {
  /**
   * The phone number to send SMS to
   */
  phoneNumber: string;
  /**
   * The message payload
   */
  message: string;
}

export interface FingerprintOpts {
  /**
   * The value is the `finger_id` for the finger that was "scanned". It is a
   * unique integer that you assign for each virtual fingerprint. When the app
   * is running you can run this same command each time the emulator prompts you
   * for a fingerprint, you can run the adb command and pass it the `finger_id`
   * to simulate the fingerprint scan.
   */
  fingerprintId: string | number;
}

export type GsmVoiceState = 'on' | 'off';

export type PowerACState = 'on' | 'off';

export interface GsmVoiceOpts {
  state: GsmVoiceState;
}

export interface PowerACOpts {
  state: PowerACState;
}

export interface PowerCapacityOpts {
  /**
   * Percentage value in range `[0, 100]`
   */
  percent: number;
}

export interface SensorSetOpts {
  /**
   * Sensor type as declared in `adb.SENSORS`
   * @privateRemarks what is `adb.SENSORS`?
   *
   */
  sensorType: string;
  /**
   * Value to set to the sensor
   */
  value: string;
}

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

export interface NetworkSpeedOpts {
  speed: NetworkSpeed;
}

export interface IsAppInstalledOpts {
  /**
   * Application package identifier
   */
  appId: string;

  /**
   * The user ID for which the package is installed.
   * The `current` user id is used by default.
   */
  user?: string | number;
}

export interface ClearAppOpts {
  /**
   * Application package identifier
   */
  appId: string;
}

export interface QueryAppStateOpts {
  /**
   * Application package identifier
   */
  appId: string;
}

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
  /**
   * Application package identifier
   */
  appId: string;
}

export interface ActivateAppOpts {
  /**
   * Application package identifier
   */
  appId: string;
}

export interface RemoveAppOpts extends UninstallOptions {
  appId: string;
}

export interface InstallAppOpts extends InstallOptions {
  appPath: string;
  checkVersion: boolean;
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

export interface ExecOptions {
  /**
   * The actual command to execute.
   *
   * @see {@link https://developer.android.com/studio/run/emulator-console}
   */
  command: string | string[];
  /**
   * A timeout used to wait for a server reply to the given command in
   * milliseconds
   * @defaultValue 60000
   */
  execTimeout?: number;
  /**
   * Console connection timeout in milliseconds
   * @defaultValue 5000
   */
  connTimeout?: number;
  /**
   * Telnet console initialization timeout in milliseconds (the time between the
   * connection happens and the command prompt is available)
   */
  initTimeout?: number;
}

export interface PullFileOpts {
  /**
   * The full path to the remote file or a specially formatted path, which
   * points to an item inside an app bundle, for example `@my.app.id/my/path`.
   * It is mandatory for the app bundle to have debugging enabled in order to
   * use the latter `remotePath` format.
   */
  remotePath: string;
}

export interface PushFileOpts {
  /**
   * The full path to the remote file or a specially formatted path, which
   * points to an item inside an app bundle, for example `@my.app.id/my/path`.
   * It is mandatory for the app bundle to have debugging enabled in order to
   * use the latter `remotePath` format.
   */
  remotePath: string;
  /**
   * Base64-encoded content of the file to be pushed.
   */
  payload: string;
}

export interface PullFolderOpts {
  /**
   * The full path to the remote folder
   */
  remotePath: string;
}

export interface DeleteFileOpts {
  /**
   * The full path to the remote file or a file inside an application bundle
   * (for example `@my.app.id/path/in/bundle`)
   */
  remotePath: string;
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

export interface DeviceTimeOpts {
  /**
   * @defaultValue 'YYYY-MM-DDTHH:mm:ssZ'
   */
  format?: string;
}

export interface PerformEditorActionOpts {
  action: string | number;
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

export interface UnlockOptions {
  /**
   * The unlock key. The value of this key depends on the actual unlock type and
   * could be a pin/password/pattern value or a biometric finger id.
   *
   * If not provided then the corresponding value from session capabilities is
   * used.
   */
  key?: string;
  /**
   * The unlock type.
   *
   * If not provided then the corresponding value from session capabilities is
   * used.
   */
  type?: UnlockType;
  /**
   * Setting it to 'uiautomator' will enforce the driver to avoid using special
   * ADB shortcuts in order to speed up the unlock procedure.
   * @defaultValue 'uiautomator'
   */
  strategy?: UnlockStrategy;
  /**
   * The maximum time in milliseconds to wait until the screen gets unlocked
   * @defaultValue 2000
   */
  timeoutMs?: number;
}

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

export interface StartActivityOpts extends IntentOpts {
  /**
   * Set it to `true` if you want to block the method call
   * until the activity manager's process returns the control to the system.
   * @defaultValue false
   */
  wait?: boolean;
  /**
   * Set it to `true` to force stop the target
   * app before starting the activity
   * @defaultValue false
   */
  stop?: boolean;
  /**
   * The windowing mode to launch the activity into.
   *
   * Check
   * https://android.googlesource.com/platform/frameworks/base/+/master/core/java/android/app/WindowConfiguration.java
   * for more details on possible windowing modes (constants starting with
   * `WINDOWING_MODE_`).
   */
  windowingMode?: number | string;
  /**
   * The activity type to launch the activity as.
   *
   * Check https://android.googlesource.com/platform/frameworks/base/+/master/core/java/android/app/WindowConfiguration.java
   * for more details on possible activity types (constants starting with `ACTIVITY_TYPE_`).
   */
  activityType?: number | string;
  /**
   * The display identifier to launch the activity into.
   */
  display?: number | string;
}

export interface BroadcastOpts extends IntentOpts {
  /**
   * The user ID for which the broadcast is sent.
   *
   * The `current` alias assumes the current user ID.
   * @defaultValue `all`
   */
  user?: string | number;
  /**
   * Require receiver to hold the given permission.
   */
  receiverPermission?: string;
  /**
   * Whether the receiver may start activities even if in the background.
   */
  allowBackgroundActivityStarts?: boolean;
}

export interface StartServiceOpts extends IntentOpts {
  /**
   * Set it to `true` if your service must be started as foreground service.
   *
   * This option is ignored if the API level of the device under test is below
   *   26 (Android 8).
   */
  foreground?: boolean;
}

export type StopServiceOpts = IntentOpts;

export interface StartMediaProjectionRecordingOpts {
  /**
   * Maximum supported resolution on-device (Detected automatically by the app
   * itself), which usually equals to Full HD 1920x1080 on most phones however
   * you can change it to following supported resolutions as well: "1920x1080",
   * "1280x720", "720x480", "320x240", "176x144".
   */
  resolution?: string;
  /**
   * Maximum allowed duration is 15 minutes; you can increase it if your test
   * takes longer than that.
   * @defaultValue 900
   */
  maxDurationSec?: number;
  /**
   * Recording thread priority.
   *
   * If you face performance drops during testing with recording enabled, you
   * can reduce recording priority
   *
   * @defaultValue 'high'
   */
  priority?: 'high' | 'normal' | 'low';
  /**
   * You can type recording video file name as you want, but recording currently
   * supports only "mp4" format so your filename must end with ".mp4". An
   * invalid file name will fail to start the recording. If not provided then
   * the current timestamp will be used as file name.
   */
  filename?: string;
}

export interface StopMediaProjectionRecordingOpts {
  /**
   * The path to the remote location, where the resulting video should be
   * uploaded. The following protocols are supported: http/https, ftp. Null or
   * empty string value (the default setting) means the content of resulting
   * file should be encoded as Base64 and passed as the endpoont response value.
   * An exception will be thrown if the generated media file is too big to fit
   * into the available process memory.
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
   * The http multipart upload method name.
   * @defaultValue 'PUT'
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
   * The actual media upload request timeout in milliseconds.
   *
   * Defaults to `@appium/support.net.DEFAULT_TIMEOUT_MS`
   */
  uploadTimeout?: number;
}

export type FormFields = StringRecord | [key: string, value: any][];

export interface GetConnectivityResult {
  /**
   * True if wifi is enabled
   */
  wifi: boolean;
  /**
   * True if mobile data connection is enabled
   */
  data: boolean;
  /**
   * True if Airplane Mode is enabled
   */
  airplaneMode: boolean;
}

export type ServiceType = 'wifi' | 'data' | 'airplaneMode';

export interface GetConnectivityOpts {
  /**
   * one or more services to get the connectivity for.
   */
  services?: ServiceType[] | ServiceType;
}

export interface SetConnectivityOpts {
  /**
   * Either to enable or disable Wi-Fi.
   * An unset value means to not change the state for the given service.
   */
  wifi?: boolean;

  /**
   * Either to enable or disable mobile data connection.
   * An unset value means to not change the state for the given service.
   */
  data?: boolean;

  /**
   * Either to enable to disable the Airplane Mode
   * An unset value means to not change the state for the given service.
   */
  airplaneMode?: boolean;
}

export interface GpsCacheRefreshOpts {
  /**
   * The maximum number of milliseconds
   * to block until GPS cache is refreshed. Providing zero or a negative
   * value to it skips waiting completely.
   * @defaultValue 20000
   */
  timeoutMs?: number;
}

export interface PerformanceDataOpts {
  /**
   * The name of the package identifier to fetch the data for
   */
  packageName: string;
  /**
   * One of supported subsystem to fetch the data for.
   */
  dataType: PerformanceDataType;
}

export type PerformanceDataType = 'batteryinfo' | 'cpuinfo' | 'memoryinfo' | 'networkinfo';

export interface GetPermissionsOpts {
  /**
   * One of possible permission types to get.
   * @defaultValue 'requested'
   */
  type?: string;
  /**
   * The application package to set change permissions on. Defaults to the
   * package name under test
   */
  appPackage?: string;
}

export interface ChangePermissionsOpts {
  /**
   * If `target` is set to 'pm':
   *  The full name of the permission to be changed
   * or a list of permissions. Check https://developer.android.com/reference/android/Manifest.permission
   * to get the full list of standard Android permssion names. Mandatory argument.
   * If 'all' magic string is passed then the chosen action is going to be applied to all
   * permisisons requested/granted by 'appPackage'.
   * If `target` is set to 'appops':
   * The full name of the appops permission to be changed
   * or a list of permissions. Check AppOpsManager.java sources to get the full list of
   * available appops permission names. Mandatory argument.
   * Examples: 'ACTIVITY_RECOGNITION', 'SMS_FINANCIAL_TRANSACTIONS', 'READ_SMS', 'ACCESS_NOTIFICATIONS'.
   * The 'all' magic string is unsupported.
   */
  permissions: string | string[];
  /**
   * The application package to set change permissions on. Defaults to the
   * package name under test
   */
  appPackage?: string;
  /**
   *  One of `PM_ACTION` values if `target` is set to 'pm', otherwise one of `APPOPS_ACTION` values
   */
  action?: string;
  /**
   * Either 'pm' or 'appops'. The 'appops' one requires 'adb_shell' server security option to be enabled.
   * @defaultValue 'pm'
   */
  target?: 'pm' | 'appops';
}

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

/**
 * @privateRemarks inferred from usage
 */
export interface ShellOpts {
  command: string;
  args?: string[];
  timeout?: number;
  includeStderr?: boolean;
}

export interface StartScreenStreamingOpts {
  /**
   * The scaled width of the device's screen.
   *
   * If unset then the script will assign it to the actual screen width measured
   * in pixels.
   */
  width?: number;
  /**
   * The scaled height of the device's screen.
   *
   * If unset then the script will assign it to the actual screen height
   * measured in pixels.
   */
  height?: number;
  /**
   * The video bit rate for the video, in bits per second.
   *
   * The default value is 4 Mb/s. You can increase the bit rate to improve video
   * quality, but doing so results in larger movie files.
   * @defaultValue 4000000
   */
  bitRate?: number;
  /**
   * The IP address/host name to start the MJPEG server on.
   *
   * You can set it to `0.0.0.0` to trigger the broadcast on all available
   * network interfaces.
   *
   * @defaultValue '127.0.0.1'
   */
  host?: string;
  /**
   * The HTTP request path the MJPEG server should be available on.
   *
   * If unset, then any pathname on the given `host`/`port` combination will
   * work. Note that the value should always start with a single slash: `/`
   */
  pathname?: string;
  /**
   * The port number to start the internal TCP MJPEG broadcast on.
   *
   * This type of broadcast always starts on the loopback interface
   * (`127.0.0.1`).
   *
   * @defaultValue 8094
   */
  tcpPort?: number;
  /**
   * The port number to start the MJPEG server on.
   *
   * @defaultValue 8093
   */
  port?: number;
  /**
   * The quality value for the streamed JPEG images.
   *
   * This number should be in range `[1,100]`, where `100` is the best quality.
   *
   * @defaultValue 70
   */
  quality?: number;
  /**
   * If set to `true` then GStreamer pipeline will increase the dimensions of
   * the resulting images to properly fit images in both landscape and portrait
   * orientations.
   *
   * Set it to `true` if the device rotation is not going to be the same during
   * the broadcasting session.
   */
  considerRotation?: boolean;
  /**
   * Whether to log GStreamer pipeline events into the standard log output.
   *
   * Might be useful for debugging purposes.
   */
  logPipelineDetails?: boolean;
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

export interface StatusBarCommandOpts {
  /**
   * Each list item must separated with a new line (`\n`) character.
   */
  command: StatusBarCommand;
  /**
   * The name of the tile component.
   *
   * It is only required for `(add|remove|click)Tile` commands.
   * Example value: `com.package.name/.service.QuickSettingsTileComponent`
   */
  component?: string;
}

export interface LockOpts {
  /**
   * The number to keep the locked.
   * 0 or empty value will keep the device locked.
   */
  seconds?: number;
}

export interface DeviceidleOpts {
  /** The action name to execute */
  action: 'whitelistAdd' | 'whitelistRemove';
  /** Either a single package or multiple packages to add or remove from the idle whitelist */
  packages?: string | string[];
}

export interface SendTrimMemoryOpts {
  /** The package name to send the `trimMemory` event to */
  pkg: string;
  /** The actual memory trim level to be sent */
  level:
    | 'COMPLETE'
    | 'MODERATE'
    | 'BACKGROUND'
    | 'UI_HIDDEN'
    | 'RUNNING_CRITICAL'
    | 'RUNNING_LOW'
    | 'RUNNING_MODERATE';
}

export interface ImageInjectionOpts {
  /** Base64-encoded payload of a .png image to be injected */
  payload: string;
}

export interface SetUiModeOpts {
  /**
   * The UI mode to set the value for.
   * Supported values are: 'night' and 'car'
   */
  mode: string;
  /**
   * The actual mode value to set.
   * Supported value for different UI modes are:
   * - night: yes|no|auto|custom_schedule|custom_bedtime
   * - car: yes|no
   */
  value: string;
}

export interface GetUiModeOpts {
  /**
   * The UI mode to set the value for.
   * Supported values are: 'night' and 'car'
   */
  mode: string;
}

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

export interface BluetoothOptions {
  action: 'enable' | 'disable' | 'unpairAll';
}

export interface NfcOptions {
  action: 'enable' | 'disable';
}

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
