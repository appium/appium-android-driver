// @ts-check
import {retryInterval} from 'asyncbox';
import _ from 'lodash';
import {requireArgs} from '../utils';

export const NETWORK_KEYS = [
  [
    'bucketStart',
    'activeTime',
    'rxBytes',
    'rxPackets',
    'txBytes',
    'txPackets',
    'operations',
    'bucketDuration',
  ],
  ['st', 'activeTime', 'rb', 'rp', 'tb', 'tp', 'op', 'bucketDuration'],
];
export const CPU_KEYS = /** @type {const} */ (['user', 'kernel']);
export const BATTERY_KEYS = ['power'];
export const MEMORY_KEYS = [
  'totalPrivateDirty',
  'nativePrivateDirty',
  'dalvikPrivateDirty',
  'eglPrivateDirty',
  'glPrivateDirty',
  'totalPss',
  'nativePss',
  'dalvikPss',
  'eglPss',
  'glPss',
  'nativeHeapAllocatedSize',
  'nativeHeapSize',
  'nativeRss',
  'dalvikRss',
  'totalRss',
];
export const SUPPORTED_PERFORMANCE_DATA_TYPES = Object.freeze({
  cpuinfo:
    'the amount of cpu by user and kernel process - cpu information for applications on real devices and simulators',
  memoryinfo:
    'the amount of memory used by the process - memory information for applications on real devices and simulators',
  batteryinfo:
    'the remaining battery power - battery power information for applications on real devices and simulators',
  networkinfo:
    'the network statistics - network rx/tx information for applications on real devices and simulators',
});
export const MEMINFO_TITLES = Object.freeze({
  NATIVE: 'Native',
  DALVIK: 'Dalvik',
  EGL: 'EGL',
  GL: 'GL',
  MTRACK: 'mtrack',
  TOTAL: 'TOTAL',
  HEAP: 'Heap',
});
const RETRY_PAUSE_MS = 1000;

/**
 * @this {AndroidDriver}
 * @returns {Promise<import('./types').PerformanceDataType[]>}
 */
export async function getPerformanceDataTypes() {
  return /** @type {import('./types').PerformanceDataType[]} */ (
    _.keys(SUPPORTED_PERFORMANCE_DATA_TYPES)
  );
}

/**
 * @this {AndroidDriver}
 * @param {string} packageName
 * @param {string} dataType
 * @param {number} [retries=2]
 * @returns {Promise<any[][]>}
 */
export async function getPerformanceData(packageName, dataType, retries = 2) {
  let result;
  switch (_.toLower(dataType)) {
    case 'batteryinfo':
      result = await getBatteryInfo.call(this, retries);
      break;
    case 'cpuinfo':
      result = await getCPUInfo.call(this, packageName, retries);
      break;
    case 'memoryinfo':
      result = await getMemoryInfo.call(this, packageName, retries);
      break;
    case 'networkinfo':
      result = await getNetworkTrafficInfo.call(this, retries);
      break;
    default:
      throw new Error(
        `No performance data of type '${dataType}' found. ` +
          `Only the following values are supported: ${JSON.stringify(
            SUPPORTED_PERFORMANCE_DATA_TYPES,
            [' '],
            2,
          )}`,
      );
  }
  return /** @type {any[][]} */ (result);
}

/**
 * Retrieves performance data about the given Android subsystem.
 * The data is parsed from the output of the dumpsys utility.
 *
 * The output depends on the selected subsystem.
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
 *
 * @this {AndroidDriver}
 * @param {import('./types').PerformanceDataOpts} opts
 * @returns {Promise<any[][]>}
 */
export async function mobileGetPerformanceData(opts) {
  const {packageName, dataType} = requireArgs(['packageName', 'dataType'], opts);
  return await this.getPerformanceData(packageName, dataType);
}

// #region Internal helpers

/**
 * API level between 18 and 30
 * ['<System Type>', '<Memory Type>', <pss total>, <private dirty>, <private clean>, <swapPss dirty>, <heap size>, <heap alloc>, <heap free>]
 * except 'TOTAL', which skips the second type name
 * !!! valDict gets mutated
 */
function parseMeminfoForApi19To29(entries, valDict) {
  const [type, subType] = entries;
  if (type === MEMINFO_TITLES.NATIVE && subType === MEMINFO_TITLES.HEAP) {
    [
      ,
      ,
      valDict.nativePss,
      valDict.nativePrivateDirty,
      ,
      ,
      valDict.nativeHeapSize,
      valDict.nativeHeapAllocatedSize,
    ] = entries;
  } else if (type === MEMINFO_TITLES.DALVIK && subType === MEMINFO_TITLES.HEAP) {
    [, , valDict.dalvikPss, valDict.dalvikPrivateDirty] = entries;
  } else if (type === MEMINFO_TITLES.EGL && subType === MEMINFO_TITLES.MTRACK) {
    [, , valDict.eglPss, valDict.eglPrivateDirty] = entries;
  } else if (type === MEMINFO_TITLES.GL && subType === MEMINFO_TITLES.MTRACK) {
    [, , valDict.glPss, valDict.glPrivateDirty] = entries;
  } else if (type === MEMINFO_TITLES.TOTAL && entries.length === 8) {
    // there are two totals, and we only want the full listing, which has 8 entries
    [, valDict.totalPss, valDict.totalPrivateDirty] = entries;
  }
}

/**
 * ['<System Type', '<pps>', '<shared dirty>', '<private dirty>', '<heap size>', '<heap alloc>', '<heap free>']
 * !!! valDict gets mutated
 */
function parseMeminfoForApiBelow19(entries, valDict) {
  const type = entries[0];
  if (type === MEMINFO_TITLES.NATIVE) {
    [
      ,
      valDict.nativePss,
      ,
      valDict.nativePrivateDirty,
      valDict.nativeHeapSize,
      valDict.nativeHeapAllocatedSize,
    ] = entries;
  } else if (type === MEMINFO_TITLES.DALVIK) {
    [, valDict.dalvikPss, , valDict.dalvikPrivateDirty] = entries;
  } else if (type === MEMINFO_TITLES.EGL) {
    [, valDict.eglPss, , valDict.eglPrivateDirty] = entries;
  } else if (type === MEMINFO_TITLES.GL) {
    [, valDict.glPss, , valDict.glPrivateDirty] = entries;
  } else if (type === MEMINFO_TITLES.TOTAL) {
    [, valDict.totalPss, , valDict.totalPrivateDirty] = entries;
  }
}

/**
 * API level 30 and above
 * ['<System Type>', '<Memory Type>', <pss total>, <private dirty>, <private clean>, <swapPss dirty>, <rss total>, <heap size>, <heap alloc>, <heap free>]
 * !!! valDict gets mutated
 */
function parseMeminfoForApiAbove29(entries, valDict) {
  const [type, subType] = entries;
  if (type === MEMINFO_TITLES.NATIVE && subType === MEMINFO_TITLES.HEAP) {
    [
      ,
      ,
      valDict.nativePss,
      valDict.nativePrivateDirty,
      ,
      ,
      valDict.nativeRss,
      valDict.nativeHeapSize,
      valDict.nativeHeapAllocatedSize,
    ] = entries;
  } else if (type === MEMINFO_TITLES.DALVIK && subType === MEMINFO_TITLES.HEAP) {
    [, , valDict.dalvikPss, valDict.dalvikPrivateDirty, , , valDict.dalvikRss] = entries;
  } else if (type === MEMINFO_TITLES.EGL && subType === MEMINFO_TITLES.MTRACK) {
    [, , valDict.eglPss, valDict.eglPrivateDirty] = entries;
  } else if (type === MEMINFO_TITLES.GL && subType === MEMINFO_TITLES.MTRACK) {
    [, , valDict.glPss, valDict.glPrivateDirty] = entries;
  } else if (type === MEMINFO_TITLES.TOTAL && entries.length === 9) {
    // has 9 entries
    [, valDict.totalPss, valDict.totalPrivateDirty, , , valDict.totalRss] = entries;
  }
}

/**
 *
 * @this {AndroidDriver}
 * @param {string} packageName
 * @param {number} retries
 */
export async function getMemoryInfo(packageName, retries = 2) {
  return await retryInterval(retries, RETRY_PAUSE_MS, async () => {
    const cmd = [
      'dumpsys',
      'meminfo',
      `'${packageName}'`,
      '|',
      'grep',
      '-E',
      `'${MEMINFO_TITLES.NATIVE}|${MEMINFO_TITLES.DALVIK}|${MEMINFO_TITLES.EGL}` +
        `|${MEMINFO_TITLES.GL}|${MEMINFO_TITLES.TOTAL}'`,
    ];
    const data = await this.adb.shell(cmd);
    if (!data) {
      throw new Error('No data from dumpsys');
    }
    const valDict = {totalPrivateDirty: ''};
    const apiLevel = await this.adb.getApiLevel();
    for (const line of data.split('\n')) {
      const entries = line.trim().split(/\s+/).filter(Boolean);
      if (apiLevel >= 30) {
        parseMeminfoForApiAbove29(entries, valDict);
      } else if (apiLevel > 18 && apiLevel < 30) {
        parseMeminfoForApi19To29(entries, valDict);
      } else {
        parseMeminfoForApiBelow19(entries, valDict);
      }
    }
    if (valDict.totalPrivateDirty && valDict.totalPrivateDirty !== 'nodex') {
      const headers = _.clone(MEMORY_KEYS);
      const values = headers.map((header) => valDict[header]);
      return [headers, values];
    }

    throw new Error(`Unable to parse memory data: '${data}'`);
  });
}

/**
 * @this {AndroidDriver}
 * @param {number} retries
 */
export async function getNetworkTrafficInfo(retries = 2) {
  return await retryInterval(retries, RETRY_PAUSE_MS, async () => {
    let returnValue = [];
    let bucketDuration, bucketStart, activeTime, rxBytes, rxPackets, txBytes, txPackets, operations;

    let cmd = ['dumpsys', 'netstats'];
    let data = await this.adb.shell(cmd);
    if (!data) throw new Error('No data from dumpsys'); //eslint-disable-line curly

    // In case of network traffic information, it is different for the return data between emulator and real device.
    // the return data of emulator
    //   Xt stats:
    //   Pending bytes: 39250
    //   History since boot:
    //   ident=[[type=WIFI, subType=COMBINED, networkId="WiredSSID"]] uid=-1 set=ALL tag=0x0
    //   NetworkStatsHistory: bucketDuration=3600000
    //   bucketStart=1478098800000 activeTime=31824 rxBytes=21502 rxPackets=78 txBytes=17748 txPackets=90 operations=0
    //
    // 7.1
    //   Xt stats:
    //   Pending bytes: 481487
    //   History since boot:
    //   ident=[{type=MOBILE, subType=COMBINED, subscriberId=310260..., metered=true}] uid=-1 set=ALL tag=0x0
    //     NetworkStatsHistory: bucketDuration=3600
    //       st=1483984800 rb=0 rp=0 tb=12031 tp=184 op=0
    //       st=1483988400 rb=0 rp=0 tb=38476 tp=587 op=0
    //       st=1483999200 rb=315616 rp=400 tb=94800 tp=362 op=0
    //       st=1484002800 rb=15826 rp=20 tb=4738 tp=16 op=0
    //
    // the return data of real device
    //   Xt stats:
    //   Pending bytes: 0
    //   History since boot:
    //   ident=[{type=MOBILE, subType=COMBINED, subscriberId=450050...}] uid=-1 set=ALL tag=0x0
    //   NetworkStatsHistory: bucketDuration=3600
    //   st=1478088000 rb=32115296 rp=34291 tb=2956805 tp=25705 op=0
    //   st=1478091600 rb=2714683 rp=11821 tb=1420564 tp=12650 op=0
    //   st=1478095200 rb=10079213 rp=19962 tb=2487705 tp=20015 op=0
    //   st=1478098800 rb=4444433 rp=10227 tb=1430356 tp=10493 op=0
    let index = 0;
    let fromXtstats = data.indexOf('Xt stats:');

    let start = data.indexOf('Pending bytes:', fromXtstats);
    let delimiter = data.indexOf(':', start + 1);
    let end = data.indexOf('\n', delimiter + 1);
    let pendingBytes = data.substring(delimiter + 1, end).trim();

    if (end > delimiter) {
      start = data.indexOf('bucketDuration', end + 1);
      delimiter = data.indexOf('=', start + 1);
      end = data.indexOf('\n', delimiter + 1);
      bucketDuration = data.substring(delimiter + 1, end).trim();
    }

    if (start >= 0) {
      data = data.substring(end + 1, data.length);
      let arrayList = data.split('\n');

      if (arrayList.length > 0) {
        start = -1;

        for (let j = 0; j < NETWORK_KEYS.length; ++j) {
          start = arrayList[0].indexOf(NETWORK_KEYS[j][0]);

          if (start >= 0) {
            index = j;
            returnValue[0] = /** @type {string[]} */ ([]);

            for (let k = 0; k < NETWORK_KEYS[j].length; ++k) {
              returnValue[0][k] = NETWORK_KEYS[j][k];
            }
            break;
          }
        }

        let returnIndex = 1;
        for (let i = 0; i < arrayList.length; i++) {
          data = arrayList[i];
          start = data.indexOf(NETWORK_KEYS[index][0]);

          if (start >= 0) {
            delimiter = data.indexOf('=', start + 1);
            end = data.indexOf(' ', delimiter + 1);
            bucketStart = data.substring(delimiter + 1, end).trim();

            if (end > delimiter) {
              start = data.indexOf(NETWORK_KEYS[index][1], end + 1);
              if (start >= 0) {
                delimiter = data.indexOf('=', start + 1);
                end = data.indexOf(' ', delimiter + 1);
                activeTime = data.substring(delimiter + 1, end).trim();
              }
            }

            if (end > delimiter) {
              start = data.indexOf(NETWORK_KEYS[index][2], end + 1);
              if (start >= 0) {
                delimiter = data.indexOf('=', start + 1);
                end = data.indexOf(' ', delimiter + 1);
                rxBytes = data.substring(delimiter + 1, end).trim();
              }
            }

            if (end > delimiter) {
              start = data.indexOf(NETWORK_KEYS[index][3], end + 1);
              if (start >= 0) {
                delimiter = data.indexOf('=', start + 1);
                end = data.indexOf(' ', delimiter + 1);
                rxPackets = data.substring(delimiter + 1, end).trim();
              }
            }

            if (end > delimiter) {
              start = data.indexOf(NETWORK_KEYS[index][4], end + 1);
              if (start >= 0) {
                delimiter = data.indexOf('=', start + 1);
                end = data.indexOf(' ', delimiter + 1);
                txBytes = data.substring(delimiter + 1, end).trim();
              }
            }

            if (end > delimiter) {
              start = data.indexOf(NETWORK_KEYS[index][5], end + 1);
              if (start >= 0) {
                delimiter = data.indexOf('=', start + 1);
                end = data.indexOf(' ', delimiter + 1);
                txPackets = data.substring(delimiter + 1, end).trim();
              }
            }

            if (end > delimiter) {
              start = data.indexOf(NETWORK_KEYS[index][6], end + 1);
              if (start >= 0) {
                delimiter = data.indexOf('=', start + 1);
                end = data.length;
                operations = data.substring(delimiter + 1, end).trim();
              }
            }
            returnValue[returnIndex++] = [
              bucketStart,
              activeTime,
              rxBytes,
              rxPackets,
              txBytes,
              txPackets,
              operations,
              bucketDuration,
            ];
          }
        }
      }
    }

    if (
      !_.isEqual(pendingBytes, '') &&
      !_.isUndefined(pendingBytes) &&
      !_.isEqual(pendingBytes, 'nodex')
    ) {
      return returnValue;
    } else {
      throw new Error(`Unable to parse network traffic data: '${data}'`);
    }
  });
}

/**
 * Return the CPU information related to the given packageName.
 * It raises an exception if the dumped CPU information did not include the given packageName
 * or the format was wrong.
 * The CPU information's sampling interval depends on the device under test.
 * For example, some devices have 5 minutes interval. When you get the information
 * from 2023-02-07 11:59:40.468 to 2023-02-07 12:04:40.556, then the next will be
 * from 2023-02-07 12:04:40.556 to 2023-02-07 12:09:40.668. No process information
 * exists in the result if the process was not running during the period.
 *
 * @this {AndroidDriver}
 * @param {string} packageName The package name to get the CPU information.
 * @param {number} retries The number of retry count.
 * @returns {Promise<[typeof CPU_KEYS, [user: string, kernel: string]]>} The array of the parsed CPU upsage percentages.
 *                  e.g. ['cpuinfo', ['14.3', '28.2']]
 *                  '14.3' is usage by the user (%), '28.2' is usage by the kernel (%)
 * @throws {Error} If it failed to parse the result of dumpsys, or no package name exists.
 */
export async function getCPUInfo(packageName, retries = 2) {
  // TODO: figure out why this is
  // sometimes, the function of 'adb.shell' fails. when I tested this function on the target of 'Galaxy Note5',
  // adb.shell(dumpsys cpuinfo) returns cpu datas for other application packages, but I can't find the data for packageName.
  // It usually fails 30 times and success for the next time,
  // Since then, he has continued to succeed.

  // @ts-expect-error retryInterval says it can return `null`, but it doesn't look like it actually can.
  // FIXME: fix this in asyncbox
  return await retryInterval(retries, RETRY_PAUSE_MS, async () => {
    /** @type {string} */
    let output;
    try {
      output = await this.adb.shell(['dumpsys', 'cpuinfo']);
    } catch (e) {
      const err = /** @type {import('teen_process').ExecError} */ (e);
      if (err.stderr) {
        this.log.info(err.stderr);
      }
      throw e;
    }
    // `output` will be something like
    //    +0% 2209/io.appium.android.apis: 0.1% user + 0.2% kernel / faults: 70 minor
    const usagesPattern = new RegExp(
      `^.+\\/${_.escapeRegExp(packageName)}:\\D+([\\d.]+)%\\s+user\\s+\\+\\s+([\\d.]+)%\\s+kernel`,
      'm',
    );
    const match = usagesPattern.exec(output);
    if (!match) {
      this.log.debug(output);
      throw new Error(
        `Unable to parse cpu usage data for '${packageName}'. Check the server log for more details`,
      );
    }
    const user = /** @type {string} */ (match[1]);
    const kernel = /** @type {string} */ (match[2]);
    return [CPU_KEYS, [user, kernel]];
  });
}

/**
 * @this {AndroidDriver}
 * @param {number} retries
 */
export async function getBatteryInfo(retries = 2) {
  return await retryInterval(retries, RETRY_PAUSE_MS, async () => {
    let cmd = ['dumpsys', 'battery', '|', 'grep', 'level'];
    let data = await this.adb.shell(cmd);
    if (!data) throw new Error('No data from dumpsys'); //eslint-disable-line curly

    let power = parseInt((data.split(':')[1] || '').trim(), 10);

    if (!Number.isNaN(power)) {
      return [_.clone(BATTERY_KEYS), [power.toString()]];
    } else {
      throw new Error(`Unable to parse battery data: '${data}'`);
    }
  });
}

// #endregion

/**
 * @typedef {import('../driver').AndroidDriver} AndroidDriver
 * @typedef {import('appium-adb').ADB} ADB
 */
