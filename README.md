[![NPM version](http://img.shields.io/npm/v/appium-android-driver.svg)](https://npmjs.org/package/appium-android-driver)
[![Downloads](http://img.shields.io/npm/dm/appium-android-driver.svg)](https://npmjs.org/package/appium-android-driver)

# Appium Android Driver

Appium Android Driver is the collection of common primitives used by other Android drivers, like UIA2/Espresso. This driver cannot work as a separate entity.

## Development

### Install and Compile

```
npm i
npm run build
npm run lint
```

### Unit Test

```
npm test
```

### Emulator regression tests

After building, run `npm run test:emulator` with `ANDROID_SERIAL` set to a running
test emulator. These tests use real ADB shell execution and create temporary files
on the emulator. Set `APPIUM_TEST_APP_PACKAGE` to an installed debuggable app to
also exercise container file operations.

For the full intent, input, tile, and permission tests, build and install the
dedicated fixture (PowerShell example; requires `ANDROID_HOME` and `JAVA_HOME`):

```powershell
./test/fixtures/quote-probe/build.ps1
adb -s emulator-5554 install -r ./build/quote-probe/probe.apk
$env:ANDROID_SERIAL = 'emulator-5554'
$env:APPIUM_TEST_APP_PACKAGE = 'io.appium.quoteargs'
npm run test:emulator
```

Use a disposable test emulator. Tests launch activities and services, change
fixture permissions, and temporarily change system settings. OS-dependent
commands are explicitly skipped when unavailable. The input tests verify text
and keyevent delivery to a real field; they do not configure a secure lockscreen.
On Windows, set `APPIUM_TEST_SH` to a POSIX shell executable (for example Git's
`usr/bin/sh.exe`) to include the shell parser tests in `npm test`.

