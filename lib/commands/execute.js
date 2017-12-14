import _ from 'lodash';
import { errors } from 'appium-base-driver';

let extensions = {};

extensions.execute = async function (script, args) {
  if (script.match(/^mobile\:/)) {
    script = script.replace(/^mobile\:/, '').trim();
    return await this.executeMobile(script, _.isArray(args) ? args[0] : args);
  }

  throw new errors.NotImplementedError();
};

extensions.executeMobile = async function (mobileCommand, opts = {}) {
  const mobileCommandsMapping = {
    shell: async (x) => await this.mobileShell(x),
  };

  if (!_.has(mobileCommandsMapping, mobileCommand)) {
    throw new errors.UnknownCommandError(`Unknown mobile command "${mobileCommand}". ` +
                                         `Only ${_.keys(mobileCommandsMapping)} commands are supported.`);
  }
  return await mobileCommandsMapping[mobileCommand](opts);
};

export default extensions;
