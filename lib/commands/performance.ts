import {retryInterval} from 'asyncbox';
import _ from 'lodash';
import type {ExecError} from 'teen_process';
import type {AndroidDriver} from '../driver';
import type {PerformanceDataType} from './types';

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
] as const;

export const CPU_KEYS = ['user', 'kernel'] as const;
export const BATTERY_KEYS = ['power'] as const;
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
] as const;

export const SUPPORTED_PERFORMANCE_DATA_TYPES = Object.freeze({
  cpuinfo:
    'the amount of cpu by user and kernel process - cpu information for applications on real devices and simulators',
  memoryinfo:
    'the amount of memory used by the process - memory information for applications on real devices and simulators',
  batteryinfo:
    'the remaining battery power - battery power information for applications on real devices and simulators',
  networkinfo:
    'the network statistics - network rx/tx information for applications on real devices and simulators',
} as const);

export const MEMINFO_TITLES = Object.freeze({
  NATIVE: 'Native',
  DALVIK: 'Dalvik',
  EGL: 'EGL',
  GL: 'GL',
  MTRACK: 'mtrack',
  TOTAL: 'TOTAL',
  HEAP: 'Heap',
} as const);

const RETRY_PAUSE_MS = 1000;

/**
 * Retrieves the list of available performance data types.
 *
 * @returns An array of supported performance data type names.
 * The possible values are: 'cpuinfo', 'memoryinfo', 'batteryinfo', 'networkinfo'.
 */
export async function getPerformanceDataTypes(
  this: AndroidDriver,
): Promise<PerformanceDataType[]> {
  return _.keys(SUPPORTED_PERFORMANCE_DATA_TYPES) as PerformanceDataType[];
}

/**
 * Retrieves performance data for the specified data type.
 *
 * @param packageName The package name of the application to get performance data for.
 * Required for 'cpuinfo' and 'memoryinfo' data types.
 * @param dataType The type of performance data to retrieve.
 * Must be one of values returned by {@link getPerformanceDataTypes}.
 * @param retries The number of retry attempts if data retrieval fails.
 * @returns A two-dimensional array where the first row contains column names
 * and subsequent rows contain the sampled data values.
 * @throws {Error} If the data type is not supported or data retrieval fails.
 */
export async function getPerformanceData(
  this: AndroidDriver,
  packageName: string,
  dataType: string,
  retries: number = 2,
): Promise<any[][]> {
  switch (_.toLower(dataType)) {
    case 'batteryinfo':
      return await getBatteryInfo.call(this, retries);
    case 'cpuinfo':
      return await getCPUInfo.call(this, packageName, retries);
    case 'memoryinfo':
      return await getMemoryInfo.call(this, packageName, retries);
    case 'networkinfo':
      return await getNetworkTrafficInfo.call(this, retries);
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
 */
export async function mobileGetPerformanceData(
  this: AndroidDriver,
  packageName: string,
  dataType: PerformanceDataType,
): Promise<any[][]> {
  return await this.getPerformanceData(packageName, dataType);
}

// #region Internal helpers

/**
 * API level between 18 and 30
 * ['<System Type>', '<Memory Type>', <pss total>, <private dirty>, <private clean>, <swapPss dirty>, <heap size>, <heap alloc>, <heap free>]
 * except 'TOTAL', which skips the second type name
 * !!! valDict gets mutated
 */
function parseMeminfoForApi19To29(
  entries: string[],
  valDict: Record<string, string | number>,
): void {
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
 * API level 30 and above
 * ['<System Type>', '<Memory Type>', <pss total>, <private dirty>, <private clean>, <swapPss dirty>, <rss total>, <heap size>, <heap alloc>, <heap free>]
 * !!! valDict gets mutated
 */
function parseMeminfoForApiAbove29(
  entries: string[],
  valDict: Record<string, string | number>,
): void {
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
 * Retrieves memory information for the specified application package.
 *
 * The data is parsed from the output of `dumpsys meminfo` command.
 * The output format varies depending on the Android API level:
 * - API 18-29: Contains PSS, private dirty, and heap information
 * - API 30+: Additionally includes RSS information
 *
 * @param packageName The package name of the application to get memory information for.
 * @param retries The number of retry attempts if data retrieval fails.
 * @returns A two-dimensional array where the first row contains memory metric names
 * (totalPrivateDirty, nativePrivateDirty, dalvikPrivateDirty, eglPrivateDirty,
 * glPrivateDirty, totalPss, nativePss, dalvikPss, eglPss, glPss,
 * nativeHeapAllocatedSize, nativeHeapSize, nativeRss, dalvikRss, totalRss)
 * and the second row contains the corresponding values.
 * @throws {Error} If memory data cannot be retrieved or parsed.
 */
export async function getMemoryInfo(
  this: AndroidDriver,
  packageName: string,
  retries: number = 2,
): Promise<any[][]> {
  return (await retryInterval(retries, RETRY_PAUSE_MS, async () => {
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
    const valDict: Record<string, string | number> = {totalPrivateDirty: ''};
    const apiLevel = await this.adb.getApiLevel();
    for (const line of data.split('\n')) {
      const entries = line.trim().split(/\s+/).filter(Boolean);
      if (apiLevel >= 30) {
        parseMeminfoForApiAbove29(entries, valDict);
      } else {
        parseMeminfoForApi19To29(entries, valDict);
      }
    }
    if (valDict.totalPrivateDirty && valDict.totalPrivateDirty !== 'nodex') {
      const headers = _.clone(MEMORY_KEYS);
      const values = headers.map((header) => valDict[header]);
      return [headers, values];
    }

    throw new Error(`Unable to parse memory data: '${data}'`);
  })) as any[][];
}

/**
 * Retrieves network traffic statistics from the device.
 *
 * The data is parsed from the output of `dumpsys netstats` command.
 * The output format differs between emulators and real devices:
 * - Emulators: Uses full key names (bucketStart, activeTime, rxBytes, etc.)
 * - Real devices (Android 7.1+): Uses abbreviated keys (st, rb, rp, tb, tp, op)
 *
 * @param retries The number of retry attempts if data retrieval fails.
 * @returns A two-dimensional array where the first row contains network metric names
 * (bucketStart/st, activeTime, rxBytes/rb, rxPackets/rp, txBytes/tb, txPackets/tp,
 * operations/op, bucketDuration) and subsequent rows contain the sampled data
 * for each time bucket.
 * @throws {Error} If network traffic data cannot be retrieved or parsed.
 */
export async function getNetworkTrafficInfo(
  this: AndroidDriver,
  retries: number = 2,
): Promise<any[][]> {
  return (await retryInterval(retries, RETRY_PAUSE_MS, async () => {
    const returnValue: any[][] = [];
    let bucketDuration: string | undefined;
    let bucketStart: string | undefined;
    let activeTime: string | undefined;
    let rxBytes: string | undefined;
    let rxPackets: string | undefined;
    let txBytes: string | undefined;
    let txPackets: string | undefined;
    let operations: string | undefined;

    const cmd = ['dumpsys', 'netstats'];
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
    const fromXtstats = data.indexOf('Xt stats:');

    let start = data.indexOf('Pending bytes:', fromXtstats);
    let delimiter = data.indexOf(':', start + 1);
    let end = data.indexOf('\n', delimiter + 1);
    const pendingBytes = data.substring(delimiter + 1, end).trim();

    if (end > delimiter) {
      start = data.indexOf('bucketDuration', end + 1);
      delimiter = data.indexOf('=', start + 1);
      end = data.indexOf('\n', delimiter + 1);
      bucketDuration = data.substring(delimiter + 1, end).trim();
    }

    if (start >= 0) {
      data = data.substring(end + 1, data.length);
      const arrayList = data.split('\n');

      if (arrayList.length > 0) {
        start = -1;

        for (let j = 0; j < NETWORK_KEYS.length; ++j) {
          start = arrayList[0].indexOf(NETWORK_KEYS[j][0]);

          if (start >= 0) {
            index = j;
            returnValue[0] = [];

            for (let k = 0; k < NETWORK_KEYS[j].length; ++k) {
              returnValue[0][k] = NETWORK_KEYS[j][k];
            }
            break;
          }
        }

        let returnIndex = 1;
        for (const dataLine of arrayList) {
          start = dataLine.indexOf(NETWORK_KEYS[index][0]);

          if (start >= 0) {
            delimiter = dataLine.indexOf('=', start + 1);
            end = dataLine.indexOf(' ', delimiter + 1);
            bucketStart = dataLine.substring(delimiter + 1, end).trim();

            if (end > delimiter) {
              start = dataLine.indexOf(NETWORK_KEYS[index][1], end + 1);
              if (start >= 0) {
                delimiter = dataLine.indexOf('=', start + 1);
                end = dataLine.indexOf(' ', delimiter + 1);
                activeTime = dataLine.substring(delimiter + 1, end).trim();
              }
            }

            if (end > delimiter) {
              start = dataLine.indexOf(NETWORK_KEYS[index][2], end + 1);
              if (start >= 0) {
                delimiter = dataLine.indexOf('=', start + 1);
                end = dataLine.indexOf(' ', delimiter + 1);
                rxBytes = dataLine.substring(delimiter + 1, end).trim();
              }
            }

            if (end > delimiter) {
              start = dataLine.indexOf(NETWORK_KEYS[index][3], end + 1);
              if (start >= 0) {
                delimiter = dataLine.indexOf('=', start + 1);
                end = dataLine.indexOf(' ', delimiter + 1);
                rxPackets = dataLine.substring(delimiter + 1, end).trim();
              }
            }

            if (end > delimiter) {
              start = dataLine.indexOf(NETWORK_KEYS[index][4], end + 1);
              if (start >= 0) {
                delimiter = dataLine.indexOf('=', start + 1);
                end = dataLine.indexOf(' ', delimiter + 1);
                txBytes = dataLine.substring(delimiter + 1, end).trim();
              }
            }

            if (end > delimiter) {
              start = dataLine.indexOf(NETWORK_KEYS[index][5], end + 1);
              if (start >= 0) {
                delimiter = dataLine.indexOf('=', start + 1);
                end = dataLine.indexOf(' ', delimiter + 1);
                txPackets = dataLine.substring(delimiter + 1, end).trim();
              }
            }

            if (end > delimiter) {
              start = dataLine.indexOf(NETWORK_KEYS[index][6], end + 1);
              if (start >= 0) {
                delimiter = dataLine.indexOf('=', start + 1);
                end = dataLine.length;
                operations = dataLine.substring(delimiter + 1, end).trim();
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
  })) as any[][];
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
 * @param packageName The package name to get the CPU information.
 * @param retries The number of retry count.
 * @returns The array of the parsed CPU upsage percentages.
 *                  e.g. ['cpuinfo', ['14.3', '28.2']]
 *                  '14.3' is usage by the user (%), '28.2' is usage by the kernel (%)
 * @throws {Error} If it failed to parse the result of dumpsys, or no package name exists.
 */
export async function getCPUInfo(
  this: AndroidDriver,
  packageName: string,
  retries: number = 2,
): Promise<[typeof CPU_KEYS, [user: string, kernel: string]]> {
  // TODO: figure out why this is
  // sometimes, the function of 'adb.shell' fails. when I tested this function on the target of 'Galaxy Note5',
  // adb.shell(dumpsys cpuinfo) returns cpu datas for other application packages, but I can't find the data for packageName.
  // It usually fails 30 times and success for the next time,
  // Since then, he has continued to succeed.

  // @ts-expect-error retryInterval says it can return `null`, but it doesn't look like it actually can.
  // FIXME: fix this in asyncbox
  return await retryInterval(retries, RETRY_PAUSE_MS, async () => {
    let output: string;
    try {
      output = await this.adb.shell(['dumpsys', 'cpuinfo']);
    } catch (e) {
      const err = e as ExecError;
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
    const user = match[1];
    const kernel = match[2];
    return [CPU_KEYS, [user, kernel]];
  });
}

/**
 * Retrieves battery level information from the device.
 *
 * The data is parsed from the output of `dumpsys battery` command.
 *
 * @param retries The number of retry attempts if data retrieval fails.
 * @returns A two-dimensional array where the first row contains the metric name ['power']
 * and the second row contains the battery level as a string (0-100).
 * @throws {Error} If battery data cannot be retrieved or parsed.
 */
export async function getBatteryInfo(
  this: AndroidDriver,
  retries: number = 2,
): Promise<any[][]> {
  return (await retryInterval(retries, RETRY_PAUSE_MS, async () => {
    const cmd = ['dumpsys', 'battery', '|', 'grep', 'level'];
    const data = await this.adb.shell(cmd);
    if (!data) throw new Error('No data from dumpsys'); //eslint-disable-line curly

    const power = parseInt((data.split(':')[1] || '').trim(), 10);

    if (!Number.isNaN(power)) {
      return [_.clone(BATTERY_KEYS), [power.toString()]];
    } else {
      throw new Error(`Unable to parse battery data: '${data}'`);
    }
  })) as any[][];
}

// #endregion

