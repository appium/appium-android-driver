import log from '../logger';
import os from 'os';
import _ from 'lodash';


let commands = {}, helpers = {}, extensions = {};

// https://github.com/SeleniumHQ/selenium/blob/0d425676b3c9df261dd641917f867d4d5ce7774d/java/client/src/org/openqa/selenium/logging/LogEntry.java
function toLogRecord (timestamp, level, message) {
  return {
    timestamp,
    level,
    message,
  };
}

extensions.supportedLogTypes = {
  logcat: {
    description: 'Logs for Android applications on real device and emulators via ADB',
    getter: async (self) => await self.adb.getLogcatLogs(),
  },
  bugreport: {
    description: `'adb bugreport' output for advanced issues diagnostic`,
    getter: async (self) => {
      const output = await self.adb.bugreport();
      const timestamp = Date.now();
      return output.split(os.EOL)
        .map((x) => toLogRecord(timestamp, 'ALL', x));
    },
  },
  server: {
    description: 'Appium server logs',
    getter: (self) => {
      if (!self.relaxedSecurityEnabled) {
        throw new Error('Appium server must have relaxed security flag set ' +
                        'in order to be able to get server logs');
      }
      const timestamp = Date.now();
      return log.unwrap().record
        .map((x) => toLogRecord(timestamp,
                                'ALL',
                                _.isEmpty(x.prefix) ? x.message : `[${x.prefix}] ${x.message}`)
        );
    },
  },
};

Object.assign(extensions, commands, helpers);
export { commands, helpers };
export default extensions;