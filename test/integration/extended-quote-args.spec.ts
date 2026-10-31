import assert from 'node:assert/strict';
import http from 'node:http';
import {before, describe, it} from 'node:test';

import {ADB} from 'appium-adb';

import {getWebViewsMapping} from '../../lib/commands/context/helpers.js';
import {initDevice} from '../../lib/commands/device/common.js';
import {pushSettingsApp} from '../../lib/commands/device/utils.js';
import {passwordUnlock, pinUnlockWithKeyEvent} from '../../lib/commands/lock/helpers.js';
import {AndroidDriver} from '../../lib/driver.js';

const serial = process.env.ANDROID_SERIAL;
const pkg = 'io.appium.quoteargs';
const pause = async () => await new Promise((resolve) => setTimeout(resolve, 250));

/**
 * Additional device checks: install the quote-probe fixture and set ANDROID_SERIAL.
 * APPIUM_TEST_SECURE_LOCK=true enables credential changes on disposable emulators only.
 * APPIUM_TEST_GSTREAMER=true requires gst-launch/gst-inspect and the streaming plugins on PATH.
 * APPIUM_TEST_STREAM_PORT selects the HTTP port (the next port is used internally).
 * MediaStore assertions intentionally expose io.appium.settings version-specific scan failures.
 */
describe('extended real-device quote coverage', {skip: !serial}, () => {
  let driver: AndroidDriver;
  let adb: ADB;
  before(async () => {
    driver = new AndroidDriver();
    adb = await ADB.createADB({udid: serial});
    driver.adb = adb;
    assert.equal((await adb.shell(['getprop', 'sys.boot_completed'], {quoteArgs: true})).trim(), '1');
    await pushSettingsApp.call(driver, true);
  });

  it('discovers a live WebView and reads its DevTools page details', async () => {
    await driver.mobileStartActivity(
      true,
      true,
      undefined,
      undefined,
      undefined,
      '0',
      `-n ${pkg}/.QuoteProbe --ez webview true`,
    );
    try {
      let matching;
      for (let attempt = 0; attempt < 40; attempt++) {
        const views = await getWebViewsMapping.call(driver, {
          ensureWebviewsHavePages: true,
          enableWebviewDetailsCollection: true,
        });
        matching = views.find(
          (view) =>
            view.webviewName === `WEBVIEW_${pkg}` && view.pages?.some((page) => page.title === 'Appium quote probe'),
        );
        if (matching) {
          break;
        }
        await pause();
      }
      assert.ok(matching, 'the real WebView and local page must be discoverable');
      assert.ok(matching.info?.Browser);
      assert.ok(matching.pages?.some((page) => page.title === 'Appium quote probe' && page.webSocketDebuggerUrl));
    } finally {
      await adb.forceStop(pkg);
    }
  });

  for (const name of ['two words.png', "it's!.png", 'dollar$;name.png', '日本語.png']) {
    it(`indexes a pushed image in MediaStore: ${name}`, async () => {
      // MediaStore stores the canonical path, not the /sdcard symlink used to push files.
      const user = (await adb.shell(['am', 'get-current-user'], {quoteArgs: true})).trim();
      const storage = `/storage/emulated/${user}`;
      const directory = `${storage}/Pictures/appium-quote-${Date.now()}`;
      const target = `${directory}/${name}`;
      const where = `_data='${target.replace(/'/g, "''")}'`;
      const uri = 'content://media/external/images/media';
      const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=';
      await adb.shell(['mkdir', '-p', directory], {quoteArgs: true});
      try {
        await driver.pushFile(target, png);
        // Unlike pushFile's best-effort scan, this directly asserts the modern helper succeeds.
        if ((await adb.getApiLevel()) >= 29) {
          await driver.settingsApp.scanMedia(target);
        }
        let result = '';
        for (let attempt = 0; attempt < 40; attempt++) {
          result = await adb.shell(['content', 'query', '--uri', uri, '--projection', '_data', '--where', where], {
            quoteArgs: true,
          });
          if (result.includes(`_data=${target}`)) {
            break;
          }
          await pause();
        }
        assert.ok(result.includes(`_data=${target}`), result);
        assert.equal(await driver.pullFile(target), png);
      } finally {
        await adb.shell(['content', 'delete', '--uri', uri, '--where', where], {quoteArgs: true});
        await adb.shell(['rm', '-rf', directory], {quoteArgs: true});
      }
    });
  }

  for (const skipDeviceInitialization of [true, false]) {
    for (const hideKeyboard of [undefined, false, true]) {
      it(`initializes the device: skip=${skipDeviceInitialization}, hideKeyboard=${hideKeyboard}`, async () => {
        const original = await adb.shell(['settings', 'get', 'secure', 'default_input_method'], {quoteArgs: true});
        const originalOpts = {...driver.opts};
        try {
          Object.assign(driver.opts, {
            skipDeviceInitialization,
            skipSettingsAppReinstall: true,
            hideKeyboard,
            skipLogcatCapture: true,
            skipUnlock: true,
          });
          await initDevice.call(driver);
          assert.ok(await adb.isAppInstalled('io.appium.settings'));
          if (hideKeyboard === false) {
            const ime = await adb.defaultIME();
            assert.ok(ime && !ime.includes('io.appium.settings'));
          }
        } finally {
          driver.opts = originalOpts;
          if (original && original !== 'null') {
            await adb.shell(['ime', 'set', original], {quoteArgs: true});
          }
        }
      });
    }
  }

  for (const [kind, credential] of [
    ['pin', '135790'],
    ['password', "Abc'!29"],
  ] as const) {
    it(`unlocks a real secure ${kind} keyguard`, {skip: process.env.APPIUM_TEST_SECURE_LOCK !== 'true'}, async () => {
      // Opt in only on disposable emulators. Setting without --old refuses an existing credential.
      let configured = false;
      try {
        const result = await adb.shell(['locksettings', `set-${kind}`, credential], {quoteArgs: true});
        assert.match(result, /set to/);
        configured = true;
        await adb.keyevent(223);
        for (let attempt = 0; attempt < 40 && !(await adb.isScreenLocked()); attempt++) {
          await pause();
        }
        assert.equal(await adb.isScreenLocked(), true, 'keyguard must actually be locked before input');
        const caps = {unlockKey: credential} as Parameters<typeof passwordUnlock>[0];
        if (kind === 'pin') {
          await pinUnlockWithKeyEvent.call(driver, caps);
        } else {
          await passwordUnlock.call(driver, caps);
        }
        for (let attempt = 0; attempt < 40 && (await adb.isScreenLocked()); attempt++) {
          await pause();
        }
        assert.equal(await adb.isScreenLocked(), false, 'input must dismiss the secure keyguard');
      } finally {
        if (configured) {
          const result = await adb.shell(['locksettings', 'clear', '--old', credential], {quoteArgs: true});
          assert.match(result, /cleared/);
          await adb.dismissKeyguard();
        }
      }
    });
  }

  for (const considerRotation of [false, true]) {
    it(
      `streams a real JPEG frame: rotation=${considerRotation}`,
      {
        skip: process.env.APPIUM_TEST_GSTREAMER !== 'true',
      },
      async () => {
        driver.relaxedSecurityEnabled = true;
        const port = Number(process.env.APPIUM_TEST_STREAM_PORT ?? 19093);
        try {
          await adb.keyevent(224);
          await driver.mobileStartActivity(
            true,
            true,
            undefined,
            undefined,
            undefined,
            '0',
            `-n ${pkg}/.QuoteProbe --ez stream true`,
          );
          await driver.mobileStartScreenStreaming(
            320,
            480,
            undefined,
            '127.0.0.1',
            port,
            '/screen',
            port + 1,
            70,
            considerRotation,
          );
          await new Promise<void>((resolve, reject) => {
            const request = http.get(`http://127.0.0.1:${port}/screen`, (response) => {
              let bytes = Buffer.alloc(0);
              response.on('data', (chunk: Buffer) => {
                bytes = Buffer.concat([bytes, chunk]);
                if (bytes.includes(Buffer.from([0xff, 0xd8])) && bytes.includes(Buffer.from([0xff, 0xd9]))) {
                  request.destroy();
                  resolve();
                }
              });
              response.on('error', reject);
            });
            request.setTimeout(20000, () => request.destroy(new Error('No JPEG frame received')));
            request.on('error', reject);
          });
        } finally {
          await driver.mobileStopScreenStreaming();
          await adb.forceStop(pkg);
          driver.relaxedSecurityEnabled = false;
        }
      },
    );
  }
});
