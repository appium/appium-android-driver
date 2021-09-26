import _ from 'lodash';
import { errors, PROTOCOLS } from 'appium-base-driver';
import logger from '../logger';

let extensions = {};

extensions.execute = async function execute (script, args) {
  if (script.match(/^mobile:/)) {
    logger.info(`Executing native command '${script}'`);
    script = script.replace(/^mobile:/, '').trim();
    return await this.executeMobile(script, _.isArray(args) ? args[0] : args);
  }
  if (!this.isWebContext()) {
    throw new errors.NotImplementedError();
  }
  const endpoint = this.chromedriver.jwproxy.downstreamProtocol === PROTOCOLS.MJSONWP
    ? '/execute'
    : '/execute/sync';
  return await this.chromedriver.jwproxy.command(endpoint, 'POST', {
    script,
    args,
  });
};

extensions.executeMobile = async function executeMobile (mobileCommand, opts = {}) {
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

    deleteFile: 'mobileDeleteFile',

    clearApp: 'mobileClearApp',

    startService: 'mobileStartService',
    stopService: 'mobileStopService',
    startActivity: 'mobileStartActivity',
    broadcast: 'mobileBroadcast',

    getContexts: 'mobileGetContexts',

    unlock: 'mobileUnlock',
  };

  if (!_.has(mobileCommandsMapping, mobileCommand)) {
    throw new errors.UnknownCommandError(`Unknown mobile command "${mobileCommand}". ` +
      `Only ${_.keys(mobileCommandsMapping)} commands are supported.`);
  }
  return await this[mobileCommandsMapping[mobileCommand]](opts);
};

export default extensions;
