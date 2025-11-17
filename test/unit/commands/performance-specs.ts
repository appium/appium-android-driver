import sinon from 'sinon';
import {AndroidDriver} from '../../../lib/driver';
import {
  SUPPORTED_PERFORMANCE_DATA_TYPES,
  NETWORK_KEYS,
  CPU_KEYS,
  BATTERY_KEYS,
  MEMORY_KEYS,
  getBatteryInfo,
  getCPUInfo,
  getMemoryInfo,
  getNetworkTrafficInfo,
} from '../../../lib/commands/performance';
import _ from 'lodash';
import {ADB} from 'appium-adb';
import * as asyncbox from 'asyncbox';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';

use(chaiAsPromised);

const PACKAGE_NAME = 'io.appium.android.apis';
const RETRY_PAUSE = 1000;
const RETRY_COUNT = 2;

const sandbox = sinon.createSandbox();
let adb: sinon.SinonStubbedInstance<ADB>;
let driver: AndroidDriver;
let retryIntervalStub: sinon.SinonStub<typeof asyncbox.retryInterval>;

describe('performance data', function () {

  beforeEach(function () {
    const adbInstance = new ADB();
    driver = new AndroidDriver();
    driver.adb = adbInstance;
    adb = sandbox.stub(adbInstance);
    retryIntervalStub = sandbox.stub(asyncbox, 'retryInterval').callsFake(async function (times, sleepMs, fn) {
      return await fn();
    });
  });
  afterEach(function () {
    sandbox.restore();
  });
  describe('getPerformanceDataTypes', function () {
    it('should get the list of available getPerformance data type', async function () {
      const types = await driver.getPerformanceDataTypes();
      expect(types).to.eql(_.keys(SUPPORTED_PERFORMANCE_DATA_TYPES));
    });
  });
  describe('getCPUInfo', function () {
    it('should return cpu data', async function () {
      (adb.shell as sinon.SinonStub).withArgs(['dumpsys', 'cpuinfo']).returns(`Load: 8.85 / 8.85 / 7.96
      CPU usage from 339020ms to 38831ms ago (2020-09-05 12:55:08.950 to 2020-09-05 13:00:09.140) with 99% awake:
        0.6% 811/com.android.systemui: 0.3% user + 0.3% kernel / faults: 564 minor 1 major
        0.6% 282/android.hardware.bluetooth@1.1-service.sim: 0% user + 0.6% kernel
        0.3% 6663/com.google.android.youtube: 0.1% user + 0.2% kernel / faults: 4328 minor
        0.1% 327/surfaceflinger: 0% user + 0.1% kernel
        0.1% 511/system_server: 0% user + 0.1% kernel / faults: 741 minor
        0.1% 295/android.hardware.graphics.composer@2.3-service: 0% user + 0.1% kernel
        0% 787/wpa_supplicant: 0% user + 0% kernel
        0% 309/android.hardware.wifi@1.0-service: 0% user + 0% kernel
        0% 433/llkd: 0% user + 0% kernel
        0% 6602/com.google.android.videos: 0% user + 0% kernel
        0% 2141/com.android.phone: 0% user + 0% kernel / faults: 144 minor
        0% 306/android.hardware.sensors@2.1-service.multihal: 0% user + 0% kernel
        0% 154/logd: 0% user + 0% kernel / faults: 21 minor 1 major
        0% 7504/kworker/u4:1-flush-251:32: 0% user + 0% kernel
        0% 16/ksoftirqd/1: 0% user + 0% kernel
        0% 6825/kworker/0:0-mm_percpu_wq: 0% user + 0% kernel
        0% 10/rcu_preempt: 0% user + 0% kernel
        0% 458/hostapd_nohidl: 0% user + 0% kernel
        0% 179/jbd2/vdc-8: 0% user + 0% kernel
        0% 157/hwservicemanager: 0% user + 0% kernel
        0% 1666/com.google.android.gms.persistent: 0% user + 0% kernel / faults: 156 minor
        0% 270/statsd: 0% user + 0% kernel
        0% 271/netd: 0% user + 0% kernel / faults: 9 minor
        0% 341/logcat: 0% user + 0% kernel
        0% 1072/com.android.networkstack.process: 0% user + 0% kernel / faults: 452 minor
        0% 183/android.system.suspend@1.0-service: 0% user + 0% kernel
        0% 7157/kworker/1:1-events_power_efficient: 0% user + 0% kernel
        0% 7245/${PACKAGE_NAME}:rcs: 14.3% user + 28.2% kernel / faults: 30 minor
        0% 9/ksoftirqd/0: 0% user + 0% kernel
        0% 11/migration/0: 0% user + 0% kernel
        0% 21/kauditd: 0% user + 0% kernel
        0% 113/kworker/1:1H-kblockd: 0% user + 0% kernel
        0% 155/lmkd: 0% user + 0% kernel
        0% 156/servicemanager: 0% user + 0% kernel
        0% 162/vold: 0% user + 0% kernel
        0% 407/libgoldfish-rild: 0% user + 0% kernel / faults: 108 minor
        0% 431/netmgr: 0% user + 0% kernel
        0% 1020/android.hardware.gnss@2.0-service.ranchu: 0% user + 0% kernel
        0% 2345/com.google.android.gms: 0% user + 0% kernel / faults: 70 minor
        +0% 7508/kworker/u4:2-phy0: 0% user + 0% kernel
      0.2% TOTAL: 0% user + 0.1% kernel + 0% iowait + 0% softirq
      `);
      expect(await getCPUInfo.bind(driver)(PACKAGE_NAME)).to.eql([CPU_KEYS, ['14.3', '28.2']]);
      expect(retryIntervalStub.calledWith(RETRY_COUNT, RETRY_PAUSE)).to.be.true;
    });
    it('should throw error if cpu data is not in valid format', async function () {
      (adb.shell as sinon.SinonStub).returns('invalid data');
      await expect(getCPUInfo.bind(driver)(PACKAGE_NAME, 1)).to.eventually.be.rejected;
    });
  });
  describe('getBatteryInfo', function () {
    it('should return battery info', async function () {
      (adb.shell as sinon.SinonStub).withArgs(['dumpsys', 'battery', '|', 'grep', 'level']).returns('  level: 47');
      await expect(getBatteryInfo.bind(driver)()).to.become([BATTERY_KEYS, ['47']]);
      expect(retryIntervalStub.calledWith(RETRY_COUNT, RETRY_PAUSE)).to.be.true;
    });
    it('should throw error if data is not valid', async function () {
      (adb.shell as sinon.SinonStub).returns('invalid data');
      await expect(getBatteryInfo.bind(driver)(1)).to.be.rejectedWith(/Unable to parse battery data/);
    });
    it('should throw error if no data', async function () {
      (adb.shell as sinon.SinonStub).returns(null);
      await expect(getBatteryInfo.bind(driver)(1)).to.be.rejectedWith(/No data from dumpsys/);
    });
  });
  describe('getMemoryInfo', function () {
    const shellArgs = [
      'dumpsys',
      'meminfo',
      `'${PACKAGE_NAME}'`,
      '|',
      'grep',
      '-E',
      "'Native|Dalvik|EGL|GL|TOTAL'",
    ];
    const dumpsysDataAPI30 = `
                         Pss  Private  Private  SwapPss      Rss     Heap     Heap     Heap
                       Total    Dirty    Clean    Dirty    Total     Size    Alloc     Free
                      ------   ------   ------   ------   ------   ------   ------   ------
         Native Heap      107      102        0        0     120         112      111      555
         Dalvik Heap      108      103        0        0     121         555      555      555
        Dalvik Other      555      555        0        0     123
          EGL mtrack      109      104        0      555     124           0        0        0
           GL mtrack      110      105        0      555     125           0        0        0
               TOTAL      555      555      555        0     126         555      555
               TOTAL      106      101      555        0     127         555      555      555`;
    const dumpsysDataAPI19 = `
                          Pss  Private  Private  Swapped     Heap     Heap     Heap
                        Total    Dirty    Clean    Dirty     Size    Alloc     Free
                       ------   ------   ------   ------   ------   ------   ------
         Native Heap      107      102        0        0      112      111      555
         Dalvik Heap      108      103        0        0      555      555      555
        Dalvik Other      555      555        0        0
          EGL mtrack      109      104        0      555        0        0        0
           GL mtrack      110      105        0      555        0        0        0
               TOTAL      555      555      555        0               555      555
               TOTAL      106      101      555        0      555      555      555`;
    const expectedResult = [
      MEMORY_KEYS,
      [
        '101',
        '102',
        '103',
        '104',
        '105', // private dirty total|native|dalvik|egl|gl
        '106',
        '107',
        '108',
        '109',
        '110', // pss           total|native|dalvik|egl|gl
        '111',
        '112', // native        heap_alloc|heap_size
        undefined,
        undefined,
        undefined,
      ],
    ];
    it('should return memory info for API>=30', async function () {
      const expectedResult30 = [
        MEMORY_KEYS,
        [
          '101',
          '102',
          '103',
          '104',
          '105', // private dirty total|native|dalvik|egl|gl
          '106',
          '107',
          '108',
          '109',
          '110', // pss           total|native|dalvik|egl|gl
          '111',
          '112', // native        heap_alloc|heap_size
          '120',
          '121',
          '127', // Rss        |native|dalvik|total
        ],
      ];
      (adb.getApiLevel as sinon.SinonStub).returns(30);
      (adb.shell as sinon.SinonStub).withArgs(shellArgs).returns(dumpsysDataAPI30);
      expect(await getMemoryInfo.bind(driver)(PACKAGE_NAME)).to.deep.equal(expectedResult30);
      expect(retryIntervalStub.calledWith(RETRY_COUNT, RETRY_PAUSE)).to.be.true;
    });
    it('should return memory info for 18<API<30', async function () {
      (adb.getApiLevel as sinon.SinonStub).returns(19);
      (adb.shell as sinon.SinonStub).withArgs(shellArgs).returns(dumpsysDataAPI19);
      expect(await getMemoryInfo.bind(driver)(PACKAGE_NAME)).to.deep.equal(expectedResult);
      expect(retryIntervalStub.calledWith(RETRY_COUNT, RETRY_PAUSE)).to.be.true;
    });
    it('should throw error if data is not valid', async function () {
      (adb.shell as sinon.SinonStub).returns('TOTAL nodex nodex nodex nodex nodex nodex nodex');
      await expect(getMemoryInfo.bind(driver)(PACKAGE_NAME, 1)).to.be.rejectedWith(/Unable to parse memory data/);
    });
    it('should throw error if no data', async function () {
      (adb.shell as sinon.SinonStub).returns(null);
      await expect(getMemoryInfo.bind(driver)(PACKAGE_NAME, 1)).to.be.rejectedWith(/No data from dumpsys/);
    });
  });
  describe('getNetworkTrafficInfo', function () {
    const shellArgs = ['dumpsys', 'netstats'];
    const header = `
      Xt stats:
        Pending bytes: pbytes
        History since boot:
        ident=[[type=MOBILE, subType=COMBINED, subscriberId=555]] uid=-1 set=ALL tag=0x0
          NetworkStatsHistory: bucketDuration=dur`;
    const data =
      header +
      `
            st=start1 rb=rb1 rp=rp1 tb=tb1 tp=tp1 op=op1
            st=start2 rb=rb2 rp=rp2 tb=tb2 tp=tp2 op=op2`;
    const dataInOldFormat =
      header +
      `
            bucketStart=start1 activeTime=time1 rxBytes=rb1 rxPackets=rp1 txBytes=tb1 txPackets=tp1 operations=op1
            bucketStart=start2 activeTime=time2 rxBytes=rb2 rxPackets=rp2 txBytes=tb2 txPackets=tp2 operations=op2`;
    it('should return network stats', async function () {
      (adb.shell as sinon.SinonStub).withArgs(shellArgs).returns(data);
      expect(await getNetworkTrafficInfo.bind(driver)()).to.deep.equal([
        NETWORK_KEYS[1],
        ['start1', undefined, 'rb1', 'rp1', 'tb1', 'tp1', 'op1', 'dur'],
        ['start2', undefined, 'rb2', 'rp2', 'tb2', 'tp2', 'op2', 'dur'],
      ]);
      expect(retryIntervalStub.calledWith(RETRY_COUNT, RETRY_PAUSE)).to.be.true;
    });
    it('should be able to parse data in old format', async function () {
      (adb.shell as sinon.SinonStub).withArgs(shellArgs).returns(dataInOldFormat);
      expect(await getNetworkTrafficInfo.bind(driver)()).to.deep.equal([
        NETWORK_KEYS[0],
        ['start1', 'time1', 'rb1', 'rp1', 'tb1', 'tp1', 'op1', 'dur'],
        ['start2', 'time2', 'rb2', 'rp2', 'tb2', 'tp2', 'op2', 'dur'],
      ]);
      expect(retryIntervalStub.calledWith(RETRY_COUNT, RETRY_PAUSE)).to.be.true;
    });
    it('should be fulfilled if history is empty', async function () {
      (adb.shell as sinon.SinonStub).returns(header);
      expect(await getNetworkTrafficInfo.bind(driver)()).to.deep.equal([]);
    });
    it('should throw error if data is not valid', async function () {
      (adb.shell as sinon.SinonStub).returns('nodex');
      await expect(getNetworkTrafficInfo.bind(driver)(1)).to.be.rejectedWith(/Unable to parse network traffic data/);
    });
    it('should throw error if no data', async function () {
      (adb.shell as sinon.SinonStub).returns(null);
      await expect(getNetworkTrafficInfo.bind(driver)(1)).to.be.rejectedWith(/No data from dumpsys/);
    });
  });
});
