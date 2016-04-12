[![NPM version](http://img.shields.io/npm/v/appium-android-driver.svg)](https://npmjs.org/package/appium-android-driver)
[![Downloads](http://img.shields.io/npm/dm/appium-android-driver.svg)](https://npmjs.org/package/appium-android-driver)
[![Dependency Status](https://david-dm.org/appium/appium-android-driver.svg)](https://david-dm.org/appium/appium-android-driver)
[![devDependency Status](https://david-dm.org/appium/appium-android-driver/dev-status.svg)](https://david-dm.org/appium/appium-android-driver#info=devDependencies)

[![Build Status](https://travis-ci.org/appium/appium-android-driver.svg?branch=master)](https://travis-ci.org/appium/appium-android-driver)
[![Coverage Status](https://coveralls.io/repos/appium/appium-android-driver/badge.svg?branch=master)](https://coveralls.io/r/appium/appium-android-driver?branch=master)

# Appium Android Driver

Appium Android Driver is a test automation tool for Android devices. Appium Android Driver automates native, hybrid and mobile web apps, tested on simulators, emulators and real devices. Appium Android Driver is part of the [Appium](https://github.com/appium/appium) mobile test automation tool.

## Installation
```
npm install appium-android-driver
```

## Usage
Import Android Driver, set [desired capabilities](http://appium.io/slate/en/1.5/?javascript#appium-server-capabilities) and create a session:

```
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
```
await driver.setOrientation('LANDSCAPE');
console.log(await driver.getOrientation()); // -> 'LANDSCAPE'
```

## Commands
|          Command           |
|----------------------------|
| `activateIMEEngine`        |
| `availableIMEEngines`      |
| `back`                     |
| `background`               |
| `clear`                    |
| `click`                    |
| `complexTap`               |
| `deactivateIMEEngine`      |
| `defaultContextName`       |
| `defaultWebviewName`       |
| `doKey`                    |
| `doTouchAction`            |
| `doTouchDrag`              |
| `drag`                     |
| `elementDisplayed`         |
| `elementEnabled`           |
| `elementSelected`          |
| `fakeFlick`                |
| `fakeFlickElement`         |
| `findElOrEls`              |
| `fixRelease`               |
| `flick`                    |
| `getActiveIMEEngine`       |
| `getAlertText`             |
| `getAttribute`             |
| `getContexts`              |
| `getCurrentActivity`       |
| `getCurrentContext`        |
| `getDeviceTime`            |
| `getLocationInView`        |
| `getLog`                   |
| `getLogTypes`              |
| `getName`                  |
| `getNetworkConnection`     |
| `getOrientation`           |
| `getPageSource`            |
| `getScreenshot`            |
| `getSize`                  |
| `getStrings`               |
| `getText`                  |
| `getWindowSize`            |
| `hideKeyboard`             |
| `installApp`               |
| `isAppInstalled`           |
| `isIMEActivated`           |
| `isLocked`                 |
| `isWebContext`             |
| `keyevent`                 |
| `keys`                     |
| `lock`                     |
| `longPressKeyCode`         |
| `onChromedriverStop`       |
| `openNotifications`        |
| `openSettingsActivity`     |
| `parseTouch`               |
| `performGesture`           |
| `performMultiAction`       |
| `performTouch`             |
| `pinchClose`               |
| `pinchOpen`                |
| `postAcceptAlert`          |
| `postDismissAlert`         |
| `pressKeyCode`             |
| `pullFile`                 |
| `pullFolder`               |
| `pushFile`                 |
| `removeApp`                |
| `replaceValue`             |
| `reset`                    |
| `setAlertText`             |
| `setContext`               |
| `setGeoLocation`           |
| `setLocation`              |
| `setNetworkConnection`     |
| `setOrientation`           |
| `setValue`                 |
| `setUrl`                   |
| `startActivity`            |
| `startChromedriverProxy`   |
| `stopChromedriverProxies`  |
| `suspendChromedriverProxy` |
| `swipe`                    |
| `tap`                      |
| `toggleData`               |
| `toggleFlightMode`         |
| `toggleLocationServices`   |
| `toggleSetting`            |
| `toggleWiFi`               |
| `touchDown`                |
| `touchLongClick`           |
| `touchMove`                |
| `touchUp`                  |
| `unlock`                   |
| `wrapBootstrapDisconnect`  |


## API Notes

`lock` behaves differently in Android than it does in iOS. In Android it does not take any arguments, and locks the screen and returns immediately.


## Watch

```
npm run watch
```

## Test

```
npm test
```
