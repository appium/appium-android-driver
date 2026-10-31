import assert from 'node:assert/strict';
import {before, after, describe, it} from 'node:test';

import {ADB} from 'appium-adb';

import {getThirdPartyPackages} from '../../lib/commands/app-management.js';
import {pushSettingsApp} from '../../lib/commands/device/utils.js';
import {setMockLocationApp} from '../../lib/commands/geolocation.js';
import {passwordUnlock, pinUnlockWithKeyEvent} from '../../lib/commands/lock/helpers.js';
import {getBatteryInfo, getMemoryInfo, getCPUInfo} from '../../lib/commands/performance.js';
import {adjustTimeZone} from '../../lib/commands/time.js';
import {AndroidDriver} from '../../lib/driver.js';
import {quoteIntentValue} from '../helpers/shell.js';

const serial = process.env.ANDROID_SERIAL;
const pkg = process.env.APPIUM_TEST_APP_PACKAGE;
const values = [
  'plain',
  'two words',
  "it's!.txt",
  '"double"',
  '$HOME',
  '$(echo injected)',
  '`echo injected`',
  '*?[abc]',
  'a;b|c&d>e<f',
  'line\nbreak',
  'back\\slash',
  '日本語',
];

describe('real Android shell argument regression tests', {skip: !serial}, () => {
  let driver: AndroidDriver;
  let adb: ADB;
  let root: string;
  before(async () => {
    driver = new AndroidDriver();
    adb = await ADB.createADB({udid: serial});
    driver.adb = adb;
    assert.equal((await adb.shell(['getprop', 'sys.boot_completed'], {quoteArgs: true})).trim(), '1');
    // Direct driver construction bypasses session setup. File pushes on API 29+
    // use the Settings helper for media scans, so prepare it on fresh emulators.
    if ((await adb.getApiLevel()) >= 29) {
      await pushSettingsApp.call(driver, true);
    }
    root = (await adb.shell(['mktemp', '-d', '/data/local/tmp/appium-quote-XXXXXX'], {quoteArgs: true})).trim();
  });
  after(async () => {
    if (root) {
      await adb.shell(['rm', '-rf', root], {quoteArgs: true});
    }
  });

  for (const value of ['', ...values]) {
    it(`round trips ${JSON.stringify(value)} through the Android shell`, async () => {
      // Encode on-device so Windows ADB stdout newline conversion cannot hide byte changes.
      const output = await adb.shell(['sh', '-c', 'printf %s "$1" | base64', 'sh', value], {quoteArgs: true});
      assert.equal(Buffer.from(output, 'base64').toString(), value);
    });
  }
  for (const inContainer of [false, true]) {
    for (const name of values) {
      it(
        `push/pull/delete ${JSON.stringify(name)}, container=${inContainer}`,
        {skip: inContainer && !pkg},
        async () => {
          const relative = `files/${root.split('/').at(-1)}/${name}`;
          const target = inContainer ? `@${pkg}/${relative}` : `${root}/${name}`;
          const content = Buffer.from(`payload\0\n${name}🙂`).toString('base64');
          try {
            await driver.pushFile(target, content);
            assert.equal(await driver.pullFile(target), content);
            assert.equal(await driver.mobileDeleteFile(target), true);
            assert.equal(await driver.mobileDeleteFile(target), false);
          } finally {
            if (inContainer) {
              await adb.shell(['run-as', pkg!, 'rm', '-rf', `/data/data/${pkg}/files/${root.split('/').at(-1)}`], {
                quoteArgs: true,
              });
            }
          }
        },
      );
    }
    it(`rejects a directory as a file, container=${inContainer}`, {skip: inContainer && !pkg}, async () => {
      const target = inContainer ? `@${pkg}/files` : root;
      await assert.rejects(driver.mobileDeleteFile(target), /not a file/);
    });
  }
  it('reports missing container apps and still cleans temporary pull files', async () => {
    const before = await adb.shell(['sh', '-c', 'ls /data/local/tmp/appium-pull-* 2>/dev/null || true'], {
      quoteArgs: true,
    });
    await assert.rejects(driver.pullFile('@io.appium.nonexistent.quote/files/missing'), /Cannot access the container/);
    assert.equal(
      await adb.shell(['sh', '-c', 'ls /data/local/tmp/appium-pull-* 2>/dev/null || true'], {quoteArgs: true}),
      before,
    );
  });
  it('keeps chunk separators active and package-like metacharacters literal', async () => {
    const actual: string[] = [];
    // This uses the installed shellChunks implementation and the real device transport.
    const original = adb.shell.bind(adb);
    adb.shell = (async (...args: Parameters<ADB['shell']>) => {
      const output = await original(...args);
      actual.push(output as string);
      return output;
    }) as ADB['shell'];
    try {
      await adb.shellChunks((value) => ['sh', '-c', 'printf %s "$1" | base64', 'sh', value], values, {quoteArgs: true});
      assert.deepEqual(
        actual
          .join('')
          .trim()
          .split(/\r?\n/)
          .map((line) => Buffer.from(line, 'base64').toString()),
        values,
      );
    } finally {
      adb.shell = original as ADB['shell'];
    }
  });
  it('reads package, density, time, battery, memory and CPU data', async () => {
    assert.ok(Array.isArray(await getThirdPartyPackages.call(driver)));
    assert.ok((await driver.getDisplayDensity()) > 0);
    assert.match(await driver.getDeviceTime(), /^\d{4}-\d{2}-\d{2}T/);
    assert.ok((await getBatteryInfo.call(driver, 1)).length > 0);
    assert.ok((await getMemoryInfo.call(driver, 'com.android.systemui', 1)).length > 0);
    // A fresh emulator's CPU sample may predate SystemUI startup. system_server
    // is already active during boot and is present in those initial samples.
    assert.ok((await getCPUInfo.call(driver, 'system_server', 1)).length > 0);
  });
  it('keeps a malicious memory package name out of shell syntax', async () => {
    const marker = `${root}/injected`;
    await assert.rejects(getMemoryInfo.call(driver, `missing;touch ${marker}`, 1));
    assert.equal(await adb.fileExists(marker), false);
  });
  it('passes the current timezone literally and rejects invalid zones', async () => {
    const zone = await adb.shell(['getprop', 'persist.sys.timezone'], {quoteArgs: true});
    await adjustTimeZone.call(driver, zone);
    assert.equal(await adb.shell(['getprop', 'persist.sys.timezone'], {quoteArgs: true}), zone);
    await assert.rejects(adjustTimeZone.call(driver, 'UTC;echo injected'), /not known/);
  });
  it('reads webview socket, window, display and screenrecord command output', async () => {
    for (const args of [
      ['cat', '/proc/net/unix'],
      ['dumpsys', 'window', 'windows'],
      ['dumpsys', 'display'],
      ['dumpsys', 'netstats'],
      ['which', 'screenrecord'],
    ]) {
      assert.ok((await adb.shell(args, {quoteArgs: true})).length > 0);
    }
  });
  it('sets and restores UI night mode', async (t) => {
    if ((await adb.getApiLevel()) < 29) {
      return t.skip('cmd uimode requires API 29+');
    }
    const original = await driver.mobileGetUiMode('night');
    try {
      await driver.mobileSetUiMode('night', original === 'yes' ? 'no' : 'yes');
      assert.equal(await driver.mobileGetUiMode('night'), original === 'yes' ? 'no' : 'yes');
    } finally {
      await driver.mobileSetUiMode('night', original);
    }
  });
  it('executes all non-tile status bar commands', async () => {
    try {
      for (const command of ['expandNotifications', 'expandSettings'] as const) {
        assert.equal(typeof (await driver.mobilePerformStatusBarCommand(command)), 'string');
      }
    } finally {
      await driver.mobilePerformStatusBarCommand('collapse');
    }
  });
  it('gets status icons when the OS supports the subcommand', async (t) => {
    try {
      assert.equal(typeof (await driver.mobilePerformStatusBarCommand('getStatusIcons')), 'string');
    } catch (error) {
      if (String(error).includes('Unknown command: get-status-icons')) {
        return t.skip('get-status-icons is not available on this Android release');
      }
      throw error;
    }
  });
  it('adds and removes an installed package from deviceidle whitelist', {skip: !pkg}, async () => {
    const original = await adb.shell(['dumpsys', 'deviceidle', 'whitelist'], {quoteArgs: true});
    const wasWhitelisted = original.split('\n').some((line) => line.startsWith(`user,${pkg},`));
    try {
      await driver.mobileDeviceidle('whitelistAdd', [pkg!]);
      assert.ok((await adb.shell(['dumpsys', 'deviceidle', 'whitelist'], {quoteArgs: true})).includes(pkg!));
      await driver.mobileDeviceidle('whitelistRemove', pkg!);
      assert.ok(
        !(await adb.shell(['dumpsys', 'deviceidle', 'whitelist'], {quoteArgs: true}))
          .split('\n')
          .some((line) => line.startsWith(`user,${pkg},`)),
      );
    } finally {
      if (wasWhitelisted) {
        await driver.mobileDeviceidle('whitelistAdd', pkg!);
      }
    }
  });

  describe('Android component receipt', {skip: pkg !== 'io.appium.quoteargs'}, () => {
    const component = 'io.appium.quoteargs/.QuoteProbe';
    before(async () => {
      // Creating the service's notification channel can trigger a permission
      // dialog on Android 13+, stealing focus from the later input tests.
      if ((await adb.getApiLevel()) >= 33) {
        await adb.grantPermission(pkg!, 'android.permission.POST_NOTIFICATIONS');
      }
    });
    async function readFixture(name: string): Promise<string> {
      return Buffer.from(await driver.pullFile(`@${pkg}/files/${name}`), 'base64').toString();
    }
    async function awaitReceipt(name: string, expected: string): Promise<void> {
      for (let attempt = 0; attempt < 50; attempt++) {
        try {
          const receipt = JSON.parse(await readFixture(name));
          if (receipt.extras['key space'] === expected) {
            return;
          }
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.equal(JSON.parse(await readFixture(name)).extras['key space'], expected);
    }
    for (const kind of ['activity', 'broadcast', 'service', 'foreground service']) {
      for (const value of ['', ...values]) {
        it(`${kind} receives literal extra ${JSON.stringify(value)}`, async () => {
          const fields = [
            undefined,
            'io.appium.QUOTING',
            pkg,
            quoteIntentValue('quote://path?a=1&b=$HOME'),
            undefined,
            undefined,
            quoteIntentValue(
              kind === 'activity' ? component : component + (kind === 'broadcast' ? '$Receiver' : '$ProbeService'),
            ),
            undefined,
            [['s', quoteIntentValue('key space'), quoteIntentValue(value)]],
          ];
          if (kind === 'activity') {
            await (driver.mobileStartActivity as (...args: any[]) => Promise<string>).apply(driver, [
              true,
              true,
              undefined,
              undefined,
              undefined,
              '0',
              ...fields,
            ]);
          } else if (kind === 'broadcast') {
            await (driver.mobileBroadcast as (...args: any[]) => Promise<string>).apply(driver, [
              undefined,
              false,
              '0',
              ...fields,
            ]);
          } else {
            await (driver.mobileStartService as (...args: any[]) => Promise<string>).apply(driver, [
              kind === 'foreground service',
              '0',
              ...fields,
            ]);
          }
          const file = kind.includes('service') ? 'service.json' : `${kind}.json`;
          await awaitReceipt(file, value);
          const receipt = JSON.parse(await readFixture(file));
          assert.equal(receipt.action, 'io.appium.QUOTING');
          assert.equal(receipt.uri, 'quote://path?a=1&b=$HOME');
        });
      }
    }
    for (const kind of ['activity', 'broadcast', 'service', 'foreground service']) {
      it(`${kind} still accepts a caller-quoted legacy intent fragment`, async () => {
        const target =
          kind === 'activity' ? component : component + (kind === 'broadcast' ? '$Receiver' : '$ProbeService');
        const fragment = `-n ${quoteIntentValue(target)} --es ${quoteIntentValue('key space')} 'legacy value'`;
        if (kind === 'activity') {
          await driver.mobileStartActivity(true, true, undefined, undefined, undefined, '0', fragment);
        } else if (kind === 'broadcast') {
          await driver.mobileBroadcast(undefined, false, '0', fragment);
        } else {
          await driver.mobileStartService(kind === 'foreground service', '0', fragment);
        }
        await awaitReceipt(kind.includes('service') ? 'service.json' : `${kind}.json`, 'legacy value');
      });
    }
    it('stops the service with a legacy intent fragment and delivers onDestroy', async () => {
      await driver.mobileDeleteFile(`@${pkg}/files/stopped.txt`);
      await driver.mobileStopService('0', `-n ${quoteIntentValue(`${component}$ProbeService`)}`);
      for (let attempt = 0; attempt < 50; attempt++) {
        try {
          if ((await readFixture('stopped.txt')) === 'stopped') {
            return;
          }
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.equal(await readFixture('stopped.txt'), 'stopped');
    });
    it('adds, clicks, and removes a tile component', async () => {
      try {
        await driver.mobilePerformStatusBarCommand('addTile', `${component}$Tile`);
        await driver.mobilePerformStatusBarCommand('clickTile', `${component}$Tile`);
      } finally {
        await driver.mobilePerformStatusBarCommand('removeTile', `${component}$Tile`);
      }
    });
    it('preserves password text and PIN keyevents in an actual input field', async () => {
      const dismiss = adb.dismissKeyguard.bind(adb);
      // This tests input arguments, not keyguard dismissal. Wake the display before
      // launching the field rather than power-cycling it during each unlock call.
      await dismiss();
      adb.dismissKeyguard = async () => {};
      const startInputActivity = async () => {
        await driver.mobileDeleteFile(`@${pkg}/files/focused.txt`);
        await driver.mobileStartActivity(true, true, undefined, undefined, undefined, '0', component);
        for (let attempt = 0; attempt < 50; attempt++) {
          try {
            if ((await readFixture('focused.txt')) === 'true') {
              return;
            }
          } catch {}
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        assert.fail('The fixture input window did not gain focus');
      };
      try {
        await startInputActivity();
        await passwordUnlock.call(driver, {unlockKey: "it's! a$b&c"} as Parameters<typeof passwordUnlock>[0]);
        assert.equal(await readFixture('text.txt'), "it's! a$b&c");
        await startInputActivity();
        await pinUnlockWithKeyEvent.call(driver, {unlockKey: '0123456789'} as Parameters<
          typeof pinUnlockWithKeyEvent
        >[0]);
        assert.equal(await readFixture('text.txt'), '0123456789');
      } finally {
        adb.dismissKeyguard = dismiss;
      }
    });
    it('resolves all package permissions and changes appops', async () => {
      try {
        await driver.mobileChangePermissions('all', pkg, 'grant');
        assert.ok((await adb.getGrantedPermissions(pkg!)).includes('android.permission.CAMERA'));
        await driver.mobileChangePermissions('all', pkg, 'revoke');
        assert.ok(!(await adb.getGrantedPermissions(pkg!)).includes('android.permission.CAMERA'));
        driver.relaxedSecurityEnabled = true;
        // Use a non-runtime-permission appop: newer Android versions synchronize
        // CAMERA's UID mode with its runtime grant independently of package modes.
        await driver.mobileChangePermissions('android:mock_location', pkg, 'allow', 'appops');
        assert.match(await adb.shell(['appops', 'get', pkg!, 'android:mock_location'], {quoteArgs: true}), /allow/);
        await driver.mobileChangePermissions('android:mock_location', pkg, 'deny', 'appops');
        // Older Android removes the entry when returning to mock location's default deny mode.
        assert.match(
          await adb.shell(['appops', 'get', pkg!, 'android:mock_location'], {quoteArgs: true}),
          /deny|No operations/,
        );
      } finally {
        await driver.mobileChangePermissions('android:mock_location', pkg, 'default', 'appops');
      }
    });
    it('sends trim memory to a background process', async () => {
      // Revoking a runtime permission above kills the app process.
      await driver.mobileStartActivity(true, true, undefined, undefined, undefined, '0', component);
      await adb.keyevent(3);
      await driver.mobileSendTrimMemory(pkg!, 'RUNNING_LOW');
    });
    it('sets mock location and reads its stored package list', async () => {
      const store = '/data/local/tmp/mock_apps.json';
      const existed = await adb.fileExists(store);
      const previous = existed ? await adb.shell(['cat', store], {quoteArgs: true}) : undefined;
      try {
        await setMockLocationApp.call(driver, pkg!);
        await setMockLocationApp.call(driver, pkg!);
        const saved = JSON.parse(await adb.shell(['cat', store], {quoteArgs: true}));
        assert.equal(saved.filter((id: string) => id === pkg).length, 1);
        assert.match(await adb.shell(['appops', 'get', pkg!, 'android:mock_location'], {quoteArgs: true}), /allow/);
      } finally {
        await adb.shell(['appops', 'set', pkg!, 'android:mock_location', 'default'], {quoteArgs: true});
        if (previous === undefined) {
          await adb.shell(['rm', '-f', store], {quoteArgs: true});
        } else {
          await adb.shell(['sh', '-c', 'printf %s "$1" > "$2"', 'sh', previous, store], {quoteArgs: true});
        }
      }
    });
  });
  it('sets both stylus handwriting states and restores the setting', async () => {
    const key = 'stylus_handwriting_enabled';
    const previous = await adb.shell(['settings', 'get', 'secure', key], {quoteArgs: true});
    driver.relaxedSecurityEnabled = true;
    try {
      for (const enabled of [true, false]) {
        await driver.setStylusHandwriting(enabled);
        assert.equal(await adb.shell(['settings', 'get', 'secure', key], {quoteArgs: true}), enabled ? '1' : '0');
      }
    } finally {
      await adb.shell(
        previous === 'null' ? ['settings', 'delete', 'secure', key] : ['settings', 'put', 'secure', key, previous],
        {quoteArgs: true},
      );
    }
  });
  it('resets IME and restores the selected input method', async () => {
    const previous = await adb.shell(['settings', 'get', 'secure', 'default_input_method'], {quoteArgs: true});
    try {
      await adb.shell(['ime', 'reset'], {quoteArgs: true});
      assert.ok(await adb.shell(['settings', 'get', 'secure', 'default_input_method'], {quoteArgs: true}));
    } finally {
      if (previous !== 'null' && previous) {
        await adb.shell(['ime', 'set', previous], {quoteArgs: true});
      }
    }
  });
  it('records and stops a real screenrecord process', async (t) => {
    if ((await adb.getApiLevel()) < 27) {
      await assert.rejects(driver.startRecordingScreen(), /Screen recording does not work on emulators/);
      return t.skip('Screen recording requires emulator API 27+');
    }
    try {
      await adb.shell(['sh', '-c', 'screenrecord "$1" >/dev/null 2>&1 &', 'sh', `${root}/leftover.mp4`], {
        quoteArgs: true,
      });
      for (let attempt = 0; attempt < 30 && !(await adb.getProcessIdsByName('screenrecord')).length; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.ok((await adb.getProcessIdsByName('screenrecord')).length > 0);
      // startRecordingScreen terminates the leftover with SIGTERM; stop uses SIGINT.
      await driver.startRecordingScreen({timeLimit: 10, forceRestart: true});
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const video = Buffer.from(await driver.stopRecordingScreen(), 'base64');
      assert.ok(video.length > 0);
      assert.equal((await adb.getProcessIdsByName('screenrecord')).length, 0);
    } finally {
      await driver.stopRecordingScreen();
    }
  });
});
