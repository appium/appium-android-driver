import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

import {ADB} from 'appium-adb';
import sinon from 'sinon';

export const testShell = process.env.APPIUM_TEST_SH ?? (process.platform === 'win32' ? undefined : '/bin/sh');

// Client-side POSIX quoting for the intent commands' existing shell-fragment contract.
export function quoteIntentValue(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

// Exercise appium-adb's actual quoting; intercept only the transport to the device.
export async function serializeShell(command: string | string[], opts?: {quoteArgs?: boolean}): Promise<string> {
  const adb = new ADB();
  const transport = sinon.stub(adb, 'adbExec').resolves('');
  await adb.shell(command, opts);
  const args = transport.firstCall.args[0] as string[];
  return args.slice(1).join(' ');
}

export async function parseDeviceCommand(command: string | string[], opts?: {quoteArgs?: boolean}): Promise<string[]> {
  const serialized = await serializeShell(command, opts);
  const {stdout} = await promisify(execFile)(testShell!, ['-c', `set -- ${serialized}; printf '%s\\0' "$@"`], {
    env: {...process.env, APPIUM_QUOTE_TEST: 'unexpected-expansion', MSYS_NO_PATHCONV: '1'},
  });
  return stdout.split('\0').slice(0, -1);
}
