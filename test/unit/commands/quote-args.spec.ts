import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {describe, it} from 'node:test';
import {promisify} from 'node:util';

import {ADB} from 'appium-adb';
import sinon from 'sinon';

import {getThirdPartyPackages} from '../../../lib/commands/app-management.js';
import {setMockLocationApp} from '../../../lib/commands/geolocation.js';
import {AndroidDriver} from '../../../lib/driver.js';
import {parseDeviceCommand, quoteIntentValue, testShell} from '../../helpers/shell.js';

describe('remaining literal shell command call sites', () => {
  const cases: Array<[string, (driver: AndroidDriver) => Promise<unknown>, string[], string]> = [
    ['set UI mode', (d) => d.mobileSetUiMode('night', 'yes'), ['cmd', 'uimode', 'night', 'yes'], ''],
    ['get UI mode', (d) => d.mobileGetUiMode('night'), ['cmd', 'uimode', 'night'], 'Night mode: yes'],
    [
      'trim memory',
      (d) => d.mobileSendTrimMemory("pkg's!", 'RUNNING_LOW'),
      ['am', 'send-trim-memory', "pkg's!", 'RUNNING_LOW'],
      '',
    ],
    ['density', (d) => d.getDisplayDensity(), ['getprop', 'ro.sf.lcd_density'], '420'],
    ['time', (d) => d.getDeviceTime(), ['date', '+%Y-%m-%dT%T%z'], '2026-10-31T10:00:00+0000'],
    [
      'third party packages',
      (d) => getThirdPartyPackages.call(d),
      ['pm', 'list', 'packages', '-3'],
      'package:com.example',
    ],
  ];
  for (const [name, invoke, args, response] of cases) {
    it(`${name} enables argument quoting`, async () => {
      const driver = new AndroidDriver();
      driver.adb = new ADB();
      const shell = sinon.stub(driver.adb, 'shell').resolves(response);
      await invoke(driver);
      assert.deepEqual(shell.firstCall.args, [args, {quoteArgs: true}]);
    });
  }
  it('quotes both properties when density falls back to the emulator', async () => {
    const driver = new AndroidDriver();
    driver.adb = new ADB();
    const shell = sinon.stub(driver.adb, 'shell').onFirstCall().resolves('invalid');
    shell.onSecondCall().resolves('320');
    assert.equal(await driver.getDisplayDensity(), 320);
    assert.deepEqual(shell.secondCall.args, [['getprop', 'qemu.sf.lcd_density'], {quoteArgs: true}]);
  });
  it('quotes mock location appops and the stored app list', async () => {
    const driver = new AndroidDriver();
    driver.adb = new ADB();
    const pkg = "pkg's!";
    sinon.stub(driver.adb, 'fileExists').resolves(true);
    const shell = sinon.stub(driver.adb, 'shell').resolves(JSON.stringify([pkg]));
    await setMockLocationApp.call(driver, pkg);
    assert.deepEqual(shell.firstCall.args, [
      ['appops', 'set', pkg, 'android:mock_location', 'allow'],
      {quoteArgs: true},
    ]);
    assert.deepEqual(shell.secondCall.args, [['cat', '/data/local/tmp/mock_apps.json'], {quoteArgs: true}]);
  });
});

const values = [
  '',
  'two words',
  "it's!.txt",
  '"double"',
  '$APPIUM_QUOTE_TEST',
  '$(printf injected)',
  '`printf injected`',
  '*?[abc]',
  'a;b|c&d>e<f',
  'line\nbreak',
  'back\\slash',
  '日本語',
];

describe('ADB literal argument contract', {skip: !testShell}, () => {
  for (const value of values) {
    it(`round trips ${JSON.stringify(value)} through real ADB quoting`, async () => {
      assert.deepEqual(await parseDeviceCommand(['printf', '%s', value], {quoteArgs: true}), ['printf', '%s', value]);
    });
  }
});

describe('status bar command validation', () => {
  for (const command of ['addTile', 'removeTile', 'clickTile'] as const) {
    for (const component of [undefined, null, '', '  ', 42, {}, []]) {
      it(`rejects ${command} with component ${JSON.stringify(component)} before ADB`, async () => {
        const driver = new AndroidDriver();
        driver.adb = new ADB();
        const shell = sinon.stub(driver.adb, 'shell');
        await assert.rejects(
          driver.mobilePerformStatusBarCommand(command, component as string),
          /component.*non-empty string/,
        );
        assert.equal(shell.callCount, 0);
      });
    }
  }
  for (const [command, adbCommand] of Object.entries({
    expandNotifications: 'expand-notifications',
    expandSettings: 'expand-settings',
    collapse: 'collapse',
    getStatusIcons: 'get-status-icons',
    addTile: 'add-tile',
    removeTile: 'remove-tile',
    clickTile: 'click-tile',
  })) {
    it(`executes ${command} with literal arguments`, async () => {
      const driver = new AndroidDriver();
      driver.adb = new ADB();
      const shell = sinon.stub(driver.adb, 'shell').resolves('output');
      const component = "pkg/.Tile's!";
      assert.equal(await driver.mobilePerformStatusBarCommand(command as 'addTile', component), 'output');
      assert.deepEqual(shell.firstCall.args, [
        ['cmd', 'statusbar', adbCommand, ...(command.endsWith('Tile') ? [component] : [])],
        {quoteArgs: true},
      ]);
    });
  }
  it('rejects an unknown command', async () => {
    await assert.rejects(new AndroidDriver().mobilePerformStatusBarCommand('unknown' as 'collapse'), /unknown/);
  });
});

describe('deviceidle quoting and chunk separators', {skip: !testShell}, () => {
  for (const [action, sign] of [
    ['whitelistAdd', '+'],
    ['whitelistRemove', '-'],
  ] as const) {
    for (const packages of [
      'one.package',
      ["pkg.it's!", 'pkg;printf injected', '$APPIUM_QUOTE_TEST'],
      [],
      Array.from({length: 20}, (_, i) => `${i}.pkg's!${'x'.repeat(70)}`),
    ]) {
      it(`${action} handles ${JSON.stringify(packages)} through real shellChunks`, async () => {
        const driver = new AndroidDriver();
        driver.adb = new ADB();
        const transport = sinon.stub(driver.adb, 'adbExec').resolves('');
        await driver.mobileDeviceidle(action, packages);
        const expectedPackages = typeof packages === 'string' ? [packages] : packages;
        if (expectedPackages.length === 20) {
          assert.ok(transport.callCount > 1, 'must exercise multiple chunks');
        }
        const actual: string[] = [];
        for (const call of transport.getCalls()) {
          const args = call.args[0] as string[];
          const {stdout} = await promisify(execFile)(testShell!, [
            '-c',
            `dumpsys() { printf '%s\\0' "$@"; }; ${args.slice(1).join(' ')}`,
          ]);
          actual.push(...stdout.split('\0').slice(0, -1));
        }
        assert.deepEqual(
          actual,
          expectedPackages.flatMap((pkg) => ['deviceidle', 'whitelist', sign + pkg]),
        );
      });
    }
  }
  it('rejects invalid action and package input', async () => {
    const driver = new AndroidDriver();
    await assert.rejects(driver.mobileDeviceidle('whitelistAdd'), /packages argument/);
    await assert.rejects(driver.mobileDeviceidle('invalid' as 'whitelistAdd', 'pkg'), /action must/);
  });
});

describe('intent command caller-side quoting compatibility', {skip: !testShell}, () => {
  const legacyCommands: Array<[string, (driver: AndroidDriver, intent: string) => Promise<string>]> = [
    [
      'activity',
      (d, intent) => d.mobileStartActivity(undefined, undefined, undefined, undefined, undefined, undefined, intent),
    ],
    ['broadcast', (d, intent) => d.mobileBroadcast(undefined, undefined, undefined, intent)],
    ['service', (d, intent) => d.mobileStartService(false, undefined, intent)],
    ['foreground service', (d, intent) => d.mobileStartService(true, undefined, intent)],
    ['stop service', (d, intent) => d.mobileStopService(undefined, intent)],
  ];
  for (const [kind, invoke] of legacyCommands) {
    for (const [fragment, expected] of [
      ['-n pkg/.Activity --es message "two words"', ['-n', 'pkg/.Activity', '--es', 'message', 'two words']],
      [
        '-n pkg/.Activity --es message $APPIUM_QUOTE_TEST',
        ['-n', 'pkg/.Activity', '--es', 'message', 'unexpected-expansion'],
      ],
    ] as const) {
      it(`${kind} preserves legacy shell fragment ${fragment}`, async () => {
        const driver = new AndroidDriver();
        driver.adb = new ADB();
        const shell = sinon.stub(driver.adb, 'shell').resolves('');
        await invoke(driver, fragment);
        assert.equal(shell.firstCall.args.length, 1);
        assert.deepEqual((await parseDeviceCommand(shell.firstCall.args[0])).slice(2), expected);
      });
    }
  }
  for (const kind of ['activity', 'broadcast', 'service', 'foreground service', 'stop service']) {
    for (const value of values) {
      it(`${kind} preserves extra ${JSON.stringify(value)}`, async () => {
        const driver = new AndroidDriver();
        driver.adb = new ADB();
        const shell = sinon.stub(driver.adb, 'shell').resolves('ok');
        const fields = [
          undefined,
          quoteIntentValue("action's!"),
          'pkg',
          quoteIntentValue('scheme://a?x=1&y=$HOME'),
          undefined,
          undefined,
          'pkg/.Component',
          ['category one', 'category!'].map(quoteIntentValue),
          [['s', quoteIntentValue('key space'), quoteIntentValue(value)]],
          '0x10000000',
        ] as const;
        // The public commands share the same intent field order after their command-specific options.
        const invoke = (fn: (...args: any[]) => Promise<string>, prefix: unknown[]) =>
          fn.apply(driver, [...prefix, ...fields]);
        if (kind === 'activity') {
          await invoke(driver.mobileStartActivity, [true, false, undefined, undefined, undefined, '0']);
        } else if (kind === 'broadcast') {
          await invoke(driver.mobileBroadcast, [undefined, false, '0']);
        } else if (kind === 'stop service') {
          await invoke(driver.mobileStopService, ['0']);
        } else {
          await invoke(driver.mobileStartService, [kind === 'foreground service', '0']);
        }
        const [args, opts] = shell.firstCall.args;
        assert.equal(opts, undefined);
        const parsed = await parseDeviceCommand(args, opts);
        assert.equal(parsed[parsed.indexOf('-a') + 1], "action's!");
        assert.equal(parsed[parsed.indexOf('-d') + 1], 'scheme://a?x=1&y=$HOME');
        assert.deepEqual(parsed.slice(parsed.indexOf('--es'), parsed.indexOf('--es') + 3), [
          '--es',
          'key space',
          value,
        ]);
      });
    }
  }
  it('preserves the already-stopped service compatibility response', async () => {
    const driver = new AndroidDriver();
    driver.adb = new ADB();
    const shell = sinon.stub(driver.adb, 'shell').rejects({code: 255, stderr: 'Service stopped'});
    assert.equal(await driver.mobileStopService(), 'Service stopped');
    shell.rejects(new Error('other failure'));
    await assert.rejects(driver.mobileStopService(), /other failure/);
  });
});
