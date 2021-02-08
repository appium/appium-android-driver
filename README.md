[![NPM version](http://img.shields.io/npm/v/appium-android-driver.svg)](https://npmjs.org/package/appium-android-driver)
[![Downloads](http://img.shields.io/npm/dm/appium-android-driver.svg)](https://npmjs.org/package/appium-android-driver)
[![Dependency Status](https://david-dm.org/appium/appium-android-driver.svg)](https://david-dm.org/appium/appium-android-driver)
[![devDependency Status](https://david-dm.org/appium/appium-android-driver/dev-status.svg)](https://david-dm.org/appium/appium-android-driver#info=devDependencies)

[![Build Status](https://travis-ci.org/appium/appium-android-driver.svg?branch=master)](https://travis-ci.org/appium/appium-android-driver)

# Appium Android Driver

Appium Android Driver is a test automation tool for Android devices. Appium Android Driver automates native, hybrid and mobile web apps, tested on simulators, emulators and real devices. Appium Android Driver is part of the [Appium](https://github.com/appium/appium) mobile test automation tool.

*Note*: Issue tracking for this repo has been disabled. Please use the [main Appium issue tracker](https://github.com/appium/appium/issues) instead.

## Deprecation Notice

This driver is obsolete and should _not_ be used to automate devices running Android version
6.0 (codename Marshmallow, API level 23) or greater.
Consider using [UIAutomator2](https://github.com/appium/appium-uiautomator2-driver) or
[Espresso](https://github.com/appium/appium-espresso-driver) drivers for such purpose instead.
Along with the fact that Android Driver is obsolete, parts of its codebase are inherited
by the aforementioned drivers, so the project itself is still being partially maintained.

## Usage

Import Android Driver, set [desired capabilities](http://appium.io/docs/en/writing-running-appium/caps/index.html#android-only) and create a session:

```js
import { AndroidDriver } from `appium-android-driver`

let defaultCaps = {
  app: 'path/to/your.apk',
  deviceName: 'Android',
  platformName: 'Android'
};

let driver = new AndroidDriver();
await driver.createSession(defaultCaps);
```
Run commands:
```js
await driver.setOrientation('LANDSCAPE');
console.log(await driver.getOrientation()); // -> 'LANDSCAPE'
```

### Technical details of the bootstrap system installed on the device

The system works by a `com.android.uiautomator.testrunner.UiAutomatorTestCase`
placed on the Android device, which opens a [SocketServer](http://docs.oracle.com/javase/7/docs/api/java/net/ServerSocket.html)
on port `4724`. This server receives commands, converts them to appropriate
Android UI Automator commands, and runs them in the context of the device.

The commands are sent through the JavaScript interface.

### UiAutomator interface

Appium's UiAutomator interface has two methods `start` and `shutdown`.

`async start (uiAutomatorBinaryPath, className, startDetector, ...extraParams)`

`start` will push uiAutomatorBinary to device and start UiAutomator with className
and return the SubProcess. `startDetector` and `extraParams` are optional arguments.
`startDetector` will be used as condition to check against your output stream of test if any. `extraParams` will be passed along as command line arguments when starting the subProcess.

`shutdown` will kill UiAutomator process on the device and also kill the subProcess.


```js
import UiAutomator from 'lib/uiautomator';
import ADB from 'appium-adb';

let adb = await ADB.createADB();
let uiAutomator = new UiAutomator(adb);

let startDetector = (s) => { return /Appium Socket Server Ready/.test(s); };
await uiAutomator.start('foo/bar.jar', 'io.appium.android.bootstrap.Bootstrap',
                        startDetector, '-e', 'disableAndroidWatchers', true);
await uiAutomator.shutdown();
```

### Specifying and selecting devices/emulators

The driver will attempt to connect to a device/emulator based on these properties in the `desiredCapabilities` object:

1. `avd`: Launch or connect to the emulator with the given name.
1. `udid`: Connect to the device with the given UDID.
1. `platformVersion`: Connect to the first device or active emulator whose OS begins with the desired OS. This means `platformVersion: 5` will take the first `5x` device from the output of `adb devices` if there are multiple available.

If none of these capabilities are given, the driver will connect to the first device or active emulator returned from the output of `adb devices`.

If more than one of these capabilities are given, the driver will only use first the capability in the order above. That is, `avd` takes priority over `udid`, which takes priority over `platformVersion`.

## API Notes

`lock` behaves differently in Android than it does in iOS. In Android it does not take any arguments, and locks the screen and returns immediately.

## Opt-In Features (With Security Risk)

These can be enabled when running this driver through Appium, via the `--allow-insecure` or `--relaxed-security` flags.

|Feature Name|Description|
|------------|-----------|
|get_server_logs|Allows retrieving of Appium server logs via the Webdriver log interface|
|adb_shell|Allows execution of arbitrary adb shell commands via the "mobile: shell" command|

## Development

### Building the Bootstrap Jar

This package builds with an older version of the Android tools, using [ant](https://ant.apache.org/).

To build the Java system, make sure [ant](https://ant.apache.org/) is installed.

In order to have both the current Android tools and the ones needed for this package,
do the following:
1. Copy your `$ANDROID_HOME` directory (where the Android SDK is installed) to another location.
1. Download the Android 22 tools
    * MacOS: http://dl-ssl.google.com/android/repository/tools_r22-macosx.zip
    * Linux: http://dl-ssl.google.com/android/repository/tools_r22-linux.zip
    * Windows: http://dl-ssl.google.com/android/repository/tools_r22-windows.zip
1. Replace the `tools` directory in the copied Android SDK directory with the Android 22
  `tools` just downloaded
1. Create/edit `bootstrap/local.properties` file, adding
    * `sdk.dir=/path/to/copied/android/sdk`

Now you should be able to build the Jar file by running
```sh
npm run build:bootstrap
```

The AppiumBootstrap.jar file is committed to source, and isn't built during the publish step. Any updates to it
need to be committed. To build the jar, run `gulp ant`.

### Install Dependencies

```
npm run clean
```

### Transpile ES2015 code

```
npm run build
```

### Watch

```
npm run watch
```

### Unit Test

```
npm test
```

Some tests need particular emulators. Currently they are twofold:
1. API level 25: either set `ANDROID_25_AVD` environment variable to the name of
  avd, or defaults to `"Nexus_5_API_25"`. If neither exist, the tests are skipped.
2. API level 24: either set `ANDROID_24_NO_GMS_AVD` environment variable to the name of
  avd, or defaults to `"Nexus_5_API_24"`. If neither exist, the tests are skipped.

Some tests also also need a specific version of Chromedriver (specifically, `2.20`),
which is available in the `test/assets` folder, or can be specified with the
`CHROME_2_20_EXECUTABLE` environment variable.
