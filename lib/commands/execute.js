import _ from 'lodash';
import {errors, PROTOCOLS} from 'appium/driver';

/**
 * @this {import('../driver').AndroidDriver}
 * @returns {import('@appium/types').StringRecord<string>}
 */
export function mobileCommandsMapping() {
  return {
    shell: 'mobileShell',

    execEmuConsoleCommand: 'mobileExecEmuConsoleCommand',

    startLogsBroadcast: 'mobileStartLogsBroadcast',
    stopLogsBroadcast: 'mobileStopLogsBroadcast',

    changePermissions: 'mobileChangePermissions',
    getPermissions: 'mobileGetPermissions',

    performEditorAction: 'mobilePerformEditorAction',

    getDeviceTime: 'mobileGetDeviceTime',

    startScreenStreaming: 'mobileStartScreenStreaming',
    stopScreenStreaming: 'mobileStopScreenStreaming',

    getNotifications: 'mobileGetNotifications',

    listSms: 'mobileListSms',

    pushFile: 'mobilePushFile',
    pullFile: 'mobilePullFile',
    pullFolder: 'mobilePullFolder',
    deleteFile: 'mobileDeleteFile',

    isAppInstalled: 'mobileIsAppInstalled',
    queryAppState: 'mobileQueryAppState',
    activateApp: 'mobileActivateApp',
    removeApp: 'mobileRemoveApp',
    terminateApp: 'mobileTerminateApp',
    installApp: 'mobileInstallApp',
    clearApp: 'mobileClearApp',

    startService: 'mobileStartService',
    stopService: 'mobileStopService',
    startActivity: 'mobileStartActivity',
    broadcast: 'mobileBroadcast',

    getContexts: 'mobileGetContexts',

    lock: 'mobileLock',
    unlock: 'mobileUnlock',
    isLocked: 'isLocked',

    refreshGpsCache: 'mobileRefreshGpsCache',

    startMediaProjectionRecording: 'mobileStartMediaProjectionRecording',
    isMediaProjectionRecordingRunning: 'mobileIsMediaProjectionRecordingRunning',
    stopMediaProjectionRecording: 'mobileStopMediaProjectionRecording',

    getConnectivity: 'mobileGetConnectivity',
    setConnectivity: 'mobileSetConnectivity',

    hideKeyboard: 'hideKeyboard',
    isKeyboardShown: 'isKeyboardShown',

    deviceidle: 'mobileDeviceidle',

    bluetooth: 'mobileBluetooth',

    nfc: 'mobileNfc',

    setUiMode: 'mobileSetUiMode',
    getUiMode: 'mobileGetUiMode',

    injectEmulatorCameraImage: 'mobileInjectEmulatorCameraImage',

    sendTrimMemory: 'mobileSendTrimMemory',

    getPerformanceData: 'mobileGetPerformanceData',
    getPerformanceDataTypes: 'getPerformanceDataTypes',

    toggleGps: 'toggleLocationServices',
    isGpsEnabled: 'isLocationServicesEnabled',

    getDisplayDensity: 'getDisplayDensity',
    getSystemBars: 'getSystemBars',
    statusBar: 'mobilePerformStatusBarCommand',

    fingerprint: 'mobileFingerprint',
    sendSms: 'mobileSendSms',
    gsmCall: 'mobileGsmCall',
    gsmSignal: 'mobileGsmSignal',
    gsmVoice: 'mobileGsmVoice',
    powerAc: 'mobilePowerAc',
    powerCapacity: 'mobilePowerCapacity',
    networkSpeed: 'mobileNetworkSpeed',
    sensorSet: 'sensorSet',

    getCurrentActivity: 'getCurrentActivity',
    getCurrentPackage: 'getCurrentPackage',

    setGeolocation: 'mobileSetGeolocation',
    getGeolocation: 'mobileGetGeolocation',
    resetGeolocation: 'mobileResetGeolocation',
  };
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {string} script
 * @param {import('@appium/types').StringRecord[]|import('@appium/types').StringRecord} [args]
 * @returns {Promise<any>}
 */
export async function execute(script, args) {
  if (script.match(/^mobile:/)) {
    this.log.info(`Executing native command '${script}'`);
    script = script.replace(/^mobile:/, '').trim();
    return await this.executeMobile(
      script,
      Array.isArray(args) ? (args[0]) : args,
    );
  }
  if (!this.isWebContext()) {
    throw new errors.NotImplementedError();
  }
  const endpoint =
    /** @type {import('appium-chromedriver').Chromedriver} */ (this.chromedriver).jwproxy
      .downstreamProtocol === PROTOCOLS.MJSONWP
      ? '/execute'
      : '/execute/sync';
  return await /** @type {import('appium-chromedriver').Chromedriver} */ (
    this.chromedriver
  ).jwproxy.command(endpoint, 'POST', {
    script,
    args,
  });
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {string} mobileCommand
 * @param {import('@appium/types').StringRecord} [opts={}]
 * @returns {Promise<any>}
 */
export async function executeMobile(mobileCommand, opts = {}) {
  const mobileCommandsMapping = this.mobileCommandsMapping();
  if (!(mobileCommand in mobileCommandsMapping)) {
    throw new errors.UnknownCommandError(
      `Unknown mobile command "${mobileCommand}". ` +
      `Only ${_.keys(mobileCommandsMapping)} commands are supported.`,
    );
  }
  return await this[mobileCommandsMapping[mobileCommand]](opts);
}
