import _ from 'lodash';
import {errors, PROTOCOLS} from 'appium/driver';

/**
 * @this {import('../driver').AndroidDriver}
 * @param {string} script
 * @param {any[]} [args]
 * @returns {Promise<any>}
 */
export async function execute(script, args) {
  if (script.match(/^mobile:/)) {
    this.log.info(`Executing native command '${script}'`);
    script = script.replace(/^mobile:/, '').trim();
    return await this.executeMobile(
      script,
      _.isArray(args) ? /** @type {import('@appium/types').StringRecord} */ (args[0]) : args,
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
  const mobileCommandsMapping = {
    shell: 'mobileShell',

    execEmuConsoleCommand: 'mobileExecEmuConsoleCommand',

    startLogsBroadcast: 'mobileStartLogsBroadcast',
    stopLogsBroadcast: 'mobileStopLogsBroadcast',

    changePermissions: 'mobileChangePermissions',
    getPermissions: 'mobileGetPermissions',

    performEditorAction: 'mobilePerformEditorAction',

    sensorSet: 'sensorSet',

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

    refreshGpsCache: 'mobileRefreshGpsCache',

    startMediaProjectionRecording: 'mobileStartMediaProjectionRecording',
    isMediaProjectionRecordingRunning: 'mobileIsMediaProjectionRecordingRunning',
    stopMediaProjectionRecording: 'mobileStopMediaProjectionRecording',

    getConnectivity: 'mobileGetConnectivity',
    setConnectivity: 'mobileSetConnectivity',

    hideKeyboard: 'hideKeyboard',
    isKeyboardShown: 'isKeyboardShown',

    deviceidle: 'mobileDeviceidle',

    setUiMode: 'mobileSetUiMode',
    getUiMode: 'mobileGetUiMode',
  };

  if (!_.has(mobileCommandsMapping, mobileCommand)) {
    throw new errors.UnknownCommandError(
      `Unknown mobile command "${mobileCommand}". ` +
        `Only ${_.keys(mobileCommandsMapping)} commands are supported.`,
    );
  }
  return await this[mobileCommandsMapping[mobileCommand]](opts);
}
