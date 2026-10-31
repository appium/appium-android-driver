import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {mobileChangePermissions} from '../../../lib/commands/permissions.js';
import type {AndroidDriver} from '../../../lib/driver.js';
import {parseDeviceCommand, testShell} from '../../helpers/shell.js';

describe('permission shell arguments', function () {
  for (const action of ['grant', 'revoke'] as const) {
    it(`quotes the package when resolving all permissions to ${action}`, {skip: !testShell}, async function () {
      const pkg = 'com.example.\'";$(printf unexpected)\n*';
      const commands: string[][] = [];
      const driver = {
        opts: {},
        log: {info() {}},
        assertFeatureEnabled() {
          throw new Error('adb_shell is disabled');
        },
        adb: {
          shell: async (args: string[], opts: {quoteArgs?: boolean}) => {
            assert.strictEqual(opts.quoteArgs, true);
            commands.push(args);
            return 'package dump';
          },
          getGrantedPermissions: async (appPackage: string, dump: string) => {
            assert.strictEqual(appPackage, pkg);
            assert.strictEqual(dump, 'package dump');
            return [];
          },
          getReqPermissions: async () => [],
        },
      } as unknown as AndroidDriver;
      await mobileChangePermissions.call(driver, 'all', pkg, action);
      assert.strictEqual(commands.length, 1);
      assert.deepStrictEqual(await parseDeviceCommand(commands[0], {quoteArgs: true}), ['dumpsys', 'package', pkg]);
    });
  }

  it('keeps appops gated before executing shell', async function () {
    const driver = {
      opts: {},
      assertFeatureEnabled() {
        throw new Error('adb_shell is disabled');
      },
      adb: {
        shell() {
          assert.fail('must not execute shell');
        },
      },
    } as unknown as AndroidDriver;
    await assert.rejects(
      mobileChangePermissions.call(driver, 'CAMERA', 'com.example', 'allow', 'appops'),
      /adb_shell is disabled/,
    );
  });

  it('quotes appops arguments after the feature check', {skip: !testShell}, async function () {
    const value = "a'b!;$(printf unexpected)\n*";
    let checked = false;
    let command: string[] = [];
    const driver = {
      opts: {},
      assertFeatureEnabled() {
        checked = true;
      },
      adb: {
        shell: async (args: string[], opts: {quoteArgs?: boolean}) => {
          assert.strictEqual(opts.quoteArgs, true);
          assert.ok(checked);
          command = args;
        },
      },
    } as unknown as AndroidDriver;
    await mobileChangePermissions.call(driver, value, value, 'allow', 'appops');
    assert.deepStrictEqual(await parseDeviceCommand(command, {quoteArgs: true}), [
      'appops',
      'set',
      value,
      value,
      'allow',
    ]);
  });
});
