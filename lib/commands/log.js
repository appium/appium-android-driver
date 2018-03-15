import log from '../logger';
import os from 'os';
import _ from 'lodash';


let commands = {}, helpers = {}, extensions = {};

extensions.supportedLogTypes = {
  logcat: {
    description: 'Logs for Android applications on real device and emulators via ADB',
    getter: async (self) => await self.adb.getLogcatLogs(),
  },
  bugreport: {
    description: `'adb bugreport' output for advanced issues diagnostic`,
    getter: async (self) => (await self.adb.bugreport()).split(os.EOL),
  },
  server: {
    description: 'Appium server logs',
    getter: (self) => {
      if (!self.relaxedSecurityEnabled) {
        throw new Error('Appium server must have relaxed security flag set ' +
                        'in order to be able to get server logs');
      }
      return log.unwrap().record
        .map((x) => {
          return {
            // npmlog does not keep timestamps in the history
            timestamp: Date.now(),
            level: 'ALL',
            message: _.isEmpty(x.prefix) ? x.message : `[${x.prefix}] ${x.message}`,
          };
        });
    },
  },
};

Object.assign(extensions, commands, helpers);
export { commands, helpers };
export default extensions;