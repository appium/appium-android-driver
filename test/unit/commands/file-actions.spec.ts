import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {describe, it, beforeEach, afterEach} from 'node:test';
import type {TestContext} from 'node:test';
import {promisify} from 'node:util';

import * as support from '@appium/support';
import {ADB} from 'appium-adb';
import sinon from 'sinon';

import type * as FileActions from '../../../lib/commands/file-actions.js';
import {AndroidDriver} from '../../../lib/driver.js';

const FILE_ACTIONS_PATH = '../../../lib/commands/file-actions.js';

let driver: AndroidDriver;
const sandbox = sinon.createSandbox();

let importCounter = 0;
function importFresh(specifier: string) {
  return import(`${specifier}?mock=${importCounter++}`);
}

// `@appium/support`'s `tempDir`/`util` namespaces are real ESM module namespace objects, which
// are frozen and can't be stubbed in place (unlike `fs`, which stays a plain object) - so
// `tempDir.path`/`util.toInMemoryBase64` overrides are swapped in via module mocking instead,
// and file-actions.js is re-imported so it resolves the mocked `@appium/support`.
//
// `support` (an `import * as` namespace) carries a `default` key alongside its named exports;
// spreading it into `namedExports` as-is trips a Node 22 module-mock bug ("Unexpected token
// 'default'"), fixed by Node 24 - so `default` is stripped out here.
const {default: _supportDefault, ...supportNamedExports} = support;

async function mockFileActions(
  t: TestContext,
  overrides: {tempDirPath?: sinon.SinonStub; toInMemoryBase64?: sinon.SinonStub} = {},
) {
  t.mock.module('@appium/support', {
    namedExports: {
      ...supportNamedExports,
      tempDir: overrides.tempDirPath ? {...support.tempDir, path: overrides.tempDirPath} : support.tempDir,
      util: overrides.toInMemoryBase64 ? {...support.util, toInMemoryBase64: overrides.toInMemoryBase64} : support.util,
    },
  });
  return (await importFresh(FILE_ACTIONS_PATH)) as typeof FileActions;
}

describe('File Actions', function () {
  beforeEach(function () {
    driver = new AndroidDriver();
    driver.adb = new ADB();
  });
  afterEach(function () {
    sandbox.restore();
  });

  describe('pullFile', function () {
    it('should be able to pull file from device', async function (t) {
      const localFile = 'local/tmp_file';
      const tempDirPath = sandbox.stub().resolves(localFile);
      const toInMemoryBase64 = sandbox.stub().withArgs(localFile).resolves(Buffer.from('YXBwaXVt', 'utf8'));
      const {pullFile} = await mockFileActions(t, {tempDirPath, toInMemoryBase64});
      const pullStub1 = sandbox.stub(driver.adb, 'pull');
      sandbox.stub(support.fs, 'exists').withArgs(localFile).resolves(true);
      const unlinkStub4 = sandbox.stub(support.fs, 'unlink');
      assert.strictEqual(await pullFile.call(driver, 'remote_path'), 'YXBwaXVt');
      assert.strictEqual(pullStub1.calledWithExactly('remote_path', localFile), true);
      assert.strictEqual(unlinkStub4.calledWithExactly(localFile), true);
    });

    it('should be able to pull file located in application container from the device', async function (t) {
      const localFile = 'local/tmp_file';
      const packageId = 'com.myapp';
      const remotePath = 'path/in/container';
      const tmpPath = '/data/local/tmp/appium-pull-test';
      const tempDirPath = sandbox.stub().resolves(localFile);
      const toInMemoryBase64 = sandbox.stub().withArgs(localFile).resolves(Buffer.from('YXBwaXVt', 'utf8'));
      const {pullFile} = await mockFileActions(t, {tempDirPath, toInMemoryBase64});
      const pullStub = sandbox.stub(driver.adb, 'pull');
      const shellStub2 = sandbox.stub(driver.adb, 'shell');
      shellStub2.withArgs(['mktemp', '/data/local/tmp/appium-pull-XXXXXX']).resolves(tmpPath);
      sandbox.stub(support.fs, 'exists').withArgs(localFile).resolves(true);
      const unlinkStub3 = sandbox.stub(support.fs, 'unlink');
      assert.strictEqual(await pullFile.call(driver, `@${packageId}/${remotePath}`), 'YXBwaXVt');
      assert.strictEqual(pullStub.calledWithExactly(tmpPath, localFile), true);
      assert.strictEqual(
        shellStub2.calledWithExactly([
          'run-as',
          packageId,
          'cat',
          `/data/data/${packageId}/${remotePath}`,
          '>',
          tmpPath,
        ]),
        true,
      );
      assert.strictEqual(unlinkStub3.calledWithExactly(localFile), true);
      assert.strictEqual(shellStub2.calledWithExactly(['rm', '-f', tmpPath]), true);
    });

    for (const failure of ['read container', 'pull', 'encode', 'unlink'] as const) {
      it(`cleans up the remote temporary file when ${failure} fails`, async function (t) {
        const localFile = 'local/tmp_file';
        const tmpPath = '/data/local/tmp/appium-pull-test';
        const tempDirPath = sandbox.stub().resolves(localFile);
        const encode = sandbox.stub().resolves(Buffer.from('YXBwaXVt'));
        const {pullFile} = await mockFileActions(t, {tempDirPath, toInMemoryBase64: encode});
        sandbox.stub(support.fs, 'exists').resolves(true);
        const unlink = sandbox.stub(support.fs, 'unlink').resolves();
        const pull = sandbox.stub(driver.adb, 'pull').resolves();
        const shell = sandbox.stub(driver.adb, 'shell').resolves('');
        shell.onFirstCall().resolves(tmpPath);
        const error = new Error('transfer failed');
        if (failure === 'read container') {
          shell.onSecondCall().rejects(error);
        } else if (failure === 'pull') {
          pull.rejects(error);
        } else if (failure === 'encode') {
          encode.rejects(error);
        } else {
          unlink.rejects(error);
        }
        await assert.rejects(pullFile.call(driver, '@com.myapp/files/test'), /transfer failed/);
        assert.deepStrictEqual(shell.lastCall.args, [['rm', '-f', tmpPath]]);
        if (failure === 'read container') {
          assert.strictEqual(pull.called, false);
        }
      });
    }
  });

  describe('container paths containing newlines', function () {
    const pkg = 'com.myapp';
    const relativePath = 'files/line\nbreak.txt';
    const remotePath = `@${pkg}/${relativePath}`;
    const fullPath = `/data/data/${pkg}/${relativePath}`;

    it('preserves the complete path when pulling', async function (t) {
      const tempDirPath = sandbox.stub().resolves('local-file');
      const toInMemoryBase64 = sandbox.stub().resolves(Buffer.from('YXBwaXVt'));
      const {pullFile} = await mockFileActions(t, {tempDirPath, toInMemoryBase64});
      sandbox.stub(support.fs, 'exists').resolves(false);
      sandbox.stub(driver.adb, 'pull').resolves();
      const shell = sandbox.stub(driver.adb, 'shell').resolves('');
      shell.onFirstCall().resolves('/data/local/tmp/appium-pull-test');
      await pullFile.call(driver, remotePath);
      assert.deepStrictEqual(shell.secondCall.args[0], [
        'run-as',
        pkg,
        'cat',
        support.util.quote(fullPath),
        '>',
        '/data/local/tmp/appium-pull-test',
      ]);
    });

    it('preserves the complete path when pushing', async function (t) {
      const tempDirPath = sandbox.stub().resolves('local-file');
      const {pushFile} = await mockFileActions(t, {tempDirPath});
      sandbox.stub(support.fs, 'writeFile').resolves();
      sandbox.stub(support.fs, 'exists').resolves(false);
      const push = sandbox.stub(driver.adb, 'push').resolves();
      const shell = sandbox.stub(driver.adb, 'shell').resolves('');
      await pushFile.call(driver, remotePath, 'YXBwaXVt');
      assert.strictEqual(push.calledWithExactly('local-file', '/data/local/tmp/line\nbreak.txt'), true);
      assert.strictEqual(shell.calledWithExactly(['run-as', pkg, `touch '${fullPath}'`]), true);
    });

    it('preserves the complete path when deleting', async function () {
      const shell = sandbox.stub(driver.adb, 'shell').resolves('');
      shell.onCall(1).resolves('__PASS__');
      shell.onCall(2).resolves('__PASS__');
      assert.strictEqual(await driver.mobileDeleteFile(remotePath), true);
      assert.strictEqual(
        shell.calledWithExactly([`run-as ${pkg} sh -c '[ -e '"'"'${fullPath}'"'"' ] && echo __PASS__'`]),
        true,
      );
      assert.strictEqual(shell.calledWithExactly(['run-as', pkg, `rm -f '${fullPath}'`]), true);
    });
  });

  describe('pushFile', function () {
    it('should be able to push file to device', async function (t) {
      const localFile = 'local/tmp_file';
      const content = 'appium';
      const tempDirPath = sandbox.stub().resolves(localFile);
      const {pushFile} = await mockFileActions(t, {tempDirPath});
      const pushStub1 = sandbox.stub(driver.adb, 'push');
      sandbox.stub(driver.adb, 'shell');
      const writeFileStub1 = sandbox.stub(support.fs, 'writeFile');
      sandbox.stub(support.fs, 'exists').withArgs(localFile).resolves(true);
      const unlinkStub1 = sandbox.stub(support.fs, 'unlink');
      await pushFile.call(driver, 'remote_path', 'YXBwaXVt');
      assert.strictEqual(writeFileStub1.calledWithExactly(localFile, content, 'binary'), true);
      assert.strictEqual(unlinkStub1.calledWithExactly(localFile), true);
      assert.strictEqual(pushStub1.calledWithExactly(localFile, 'remote_path'), true);
    });

    it('should be able to push file located in application container to the device', async function (t) {
      const localFile = 'local/tmp_file';
      const content = 'appium';
      const packageId = 'com.myapp';
      const remotePath = 'path/in/container';
      const tmpPath = '/data/local/tmp/container';
      const tempDirPath = sandbox.stub().resolves(localFile);
      const {pushFile} = await mockFileActions(t, {tempDirPath});
      const pushStub2 = sandbox.stub(driver.adb, 'push');
      const writeFileStub = sandbox.stub(support.fs, 'writeFile');
      sandbox.stub(support.fs, 'exists').withArgs(localFile).resolves(true);
      const unlinkStub2 = sandbox.stub(support.fs, 'unlink');
      const shellStub = sandbox.stub(driver.adb, 'shell');
      await pushFile.call(driver, `@${packageId}/${remotePath}`, 'YXBwaXVt');
      assert.strictEqual(writeFileStub.calledWithExactly(localFile, content, 'binary'), true);
      assert.strictEqual(pushStub2.calledWithExactly(localFile, tmpPath), true);
      assert.strictEqual(
        shellStub.calledWithExactly(['run-as', packageId, `mkdir -p '/data/data/${packageId}/path/in'`]),
        true,
      );
      assert.strictEqual(
        shellStub.calledWithExactly(['run-as', packageId, `touch '/data/data/${packageId}/${remotePath}'`]),
        true,
      );
      assert.strictEqual(
        shellStub.calledWithExactly(['run-as', packageId, `chmod 777 '/data/data/${packageId}/${remotePath}'`]),
        true,
      );
      assert.strictEqual(
        shellStub.calledWithExactly([
          'run-as',
          packageId,
          `cp -f '${tmpPath}' '/data/data/${packageId}/${remotePath}'`,
        ]),
        true,
      );
      assert.strictEqual(unlinkStub2.calledWithExactly(localFile), true);
      assert.strictEqual(shellStub.calledWithExactly(['rm', '-f', tmpPath]), true);
    });
  });
});

describe('File action argument preservation', {skip: process.platform === 'win32'}, function () {
  const packageId = 'com.example.$APPIUM_QUOTE_TEST';
  const fileName = 'O\'Brien "notes" $APPIUM_QUOTE_TEST `printf unexpected`; (draft) [*].txt';
  const containerPath = `/data/data/${packageId}/${fileName}`;
  const tempPath = `/data/local/tmp/${fileName}`;
  const remotePath = `@${packageId}/${fileName}`;

  beforeEach(function () {
    driver = new AndroidDriver();
    driver.adb = new ADB();
  });
  afterEach(function () {
    sandbox.restore();
  });

  for (const apiLevel of [26, 28]) {
    it(`preserves the media scan URI on API ${apiLevel}`, async function (t) {
      const target = `/data/local/tmp/${fileName}\nnext.txt`;
      const tempDirPath = sandbox.stub().resolves('local-file');
      const {pushFile} = await mockFileActions(t, {tempDirPath});
      sandbox.stub(support.fs, 'exists').resolves(false);
      sandbox.stub(support.fs, 'writeFile').resolves();
      sandbox.stub(driver.adb, 'push').resolves();
      sandbox.stub(driver.adb, 'getApiLevel').resolves(apiLevel);
      const shell = sandbox.stub(driver.adb, 'shell').resolves('');
      await pushFile.call(driver, target, 'YXBwaXVt');
      assert.deepStrictEqual(await parseDeviceCommand(shell.firstCall.args[0]), [
        'am',
        'broadcast',
        '-a',
        'android.intent.action.MEDIA_SCANNER_SCAN_FILE',
        '-d',
        `file://${target}`,
      ]);
    });
  }

  for (const operation of ['pull', 'push'] as const) {
    it(`preserves package names and paths through ${operation} and cleanup`, async function (t) {
      const tempDirPath = sandbox.stub().resolves('local-file');
      const toInMemoryBase64 = sandbox.stub().resolves(Buffer.from('YXBwaXVt'));
      const {pullFile, pushFile} = await mockFileActions(t, {tempDirPath, toInMemoryBase64});
      sandbox.stub(support.fs, 'exists').resolves(true);
      sandbox.stub(support.fs, 'unlink').resolves();
      sandbox.stub(support.fs, 'writeFile').resolves();
      const pull = sandbox.stub(driver.adb, 'pull').resolves();
      const push = sandbox.stub(driver.adb, 'push').resolves();
      const shell = sandbox.stub(driver.adb, 'shell').resolves('');
      if (operation === 'pull') {
        shell.onFirstCall().resolves(tempPath);
        await pullFile.call(driver, remotePath);
        assert.strictEqual(pull.calledWithExactly(tempPath, 'local-file'), true);
      } else {
        await pushFile.call(driver, remotePath, 'YXBwaXVt');
        assert.strictEqual(push.calledWithExactly('local-file', tempPath), true);
      }
      const commands = await Promise.all(
        shell.getCalls().map(async ({args}) => {
          const cmd = args[0];
          if (Array.isArray(cmd) && cmd.includes('>')) {
            const index = cmd.indexOf('>');
            return [
              ...(await parseDeviceCommand(cmd.slice(0, index))),
              '>',
              ...(await parseDeviceCommand(cmd.slice(index + 1))),
            ];
          }
          return await parseDeviceCommand(cmd);
        }),
      );
      const expected =
        operation === 'pull'
          ? [
              ['mktemp', '/data/local/tmp/appium-pull-XXXXXX'],
              ['run-as', packageId, 'cat', containerPath, '>', tempPath],
            ]
          : [
              ['run-as', packageId, 'mkdir', '-p', `/data/data/${packageId}`],
              ['run-as', packageId, 'touch', containerPath],
              ['run-as', packageId, 'chmod', '777', containerPath],
              ['run-as', packageId, 'cp', '-f', tempPath, containerPath],
            ];
      assert.deepStrictEqual(commands, [...expected, ['rm', '-f', tempPath]]);
    });
  }

  for (const inContainer of [true, false]) {
    it(`preserves paths in existence checks and deletion (container=${inContainer})`, async function () {
      const target = inContainer ? containerPath : `/data/local/tmp/${fileName}`;
      const shell = sandbox.stub(driver.adb, 'shell').resolves('');
      const offset = inContainer ? 1 : 0;
      shell.onCall(offset).resolves('__PASS__');
      shell.onCall(offset + 1).resolves('__PASS__');
      await driver.mobileDeleteFile(inContainer ? remotePath : target);
      const commands = await Promise.all(
        shell.getCalls().map(({args}) => {
          const cmd = (Array.isArray(args[0]) ? args[0].join(' ') : args[0]).replace(/ && echo __PASS__$/, '');
          return parseDeviceCommand(cmd);
        }),
      );
      const prefix = inContainer ? ['run-as', packageId] : [];
      assert.deepStrictEqual(commands, [
        ...(inContainer ? [[...prefix, 'ls']] : []),
        inContainer
          ? [...prefix, 'sh', '-c', `[ -e '${target.replace(/'/g, `'"'"'`)}' ] && echo __PASS__`]
          : ['[', '-e', target, ']'],
        inContainer
          ? [...prefix, 'sh', '-c', `[ -f '${target.replace(/'/g, `'"'"'`)}' ] && echo __PASS__`]
          : ['[', '-f', target, ']'],
        [...prefix, 'rm', '-f', target],
        inContainer
          ? [...prefix, 'sh', '-c', `[ -e '${target.replace(/'/g, `'"'"'`)}' ] && echo __PASS__`]
          : ['[', '-e', target, ']'],
      ]);
    });
  }
});

async function parseDeviceCommand(command: string | string[]): Promise<string[]> {
  const {stdout} = await promisify(execFile)(
    '/bin/sh',
    ['-c', `set -- ${Array.isArray(command) ? command.join(' ') : command}; printf '%s\\0' "$@"`],
    {
      env: {...process.env, APPIUM_QUOTE_TEST: 'unexpected-expansion'},
    },
  );
  return stdout.toString().split('\0').slice(0, -1);
}
