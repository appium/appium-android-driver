import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {describe, it} from 'node:test';
import {promisify} from 'node:util';

import {util} from '@appium/support';

import {mobileChangePermissions} from '../../../lib/commands/permissions.js';
import type {AndroidDriver} from '../../../lib/driver.js';

async function parseCommand(args: string[]): Promise<string[]> {
  const {stdout} = await promisify(execFile)('/bin/sh', ['-c', `set -- ${args.join(' ')}; printf '%s\\0' "$@"`]);
  return stdout.split('\0').slice(0, -1);
}

describe('permission shell arguments', function () {
  for (const action of ['grant', 'revoke'] as const) {
    it(
      `quotes the package when resolving all permissions to ${action}`,
      {skip: process.platform === 'win32'},
      async function () {
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
              commands.push(args.map((arg) => util.quote(arg)));
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
        assert.deepStrictEqual(await parseCommand(commands[0]), ['dumpsys', 'package', pkg]);
      },
    );
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

  it('quotes appops arguments after the feature check', {skip: process.platform === 'win32'}, async function () {
    const value = "a'b;$(printf unexpected)\n*";
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
          command = args.map((arg) => util.quote(arg));
        },
      },
    } as unknown as AndroidDriver;
    await mobileChangePermissions.call(driver, value, value, 'allow', 'appops');
    assert.deepStrictEqual(await parseCommand(command), ['appops', 'set', value, value, 'allow']);
  });
});
