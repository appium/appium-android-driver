/* eslint-disable @typescript-eslint/no-non-null-assertion */

import type {
  DriverCaps,
  DriverOpts,
  ExternalDriver,
  InitialOpts,
  RouteMatcher,
  StringRecord,
  W3CDriverCaps,
} from '@appium/types';
import _ from 'lodash';
import ADB from 'appium-adb';
import type {default as AppiumChromedriver} from 'appium-chromedriver';
import {BaseDriver} from 'appium/driver';
import ANDROID_DRIVER_CONSTRAINTS, {AndroidDriverConstraints} from './constraints';
import {helpers} from './helpers';
import {newMethodMap} from './method-map';

export type AndroidDriverCaps = DriverCaps<AndroidDriverConstraints>;
export type W3CAndroidDriverCaps = W3CDriverCaps<AndroidDriverConstraints>;
export type AndroidDriverOpts = DriverOpts<AndroidDriverConstraints>;

type AndroidExternalDriver = ExternalDriver<AndroidDriverConstraints>;
class AndroidDriver
  extends BaseDriver<AndroidDriverConstraints, StringRecord>
  implements ExternalDriver<AndroidDriverConstraints, string, StringRecord>
{
  static newMethodMap = newMethodMap;
  jwpProxyAvoid: RouteMatcher[];

  adb: ADB;

  unlocker: typeof helpers.unlocker;

  apkStrings: StringRecord<StringRecord<string>>;

  proxyReqRes?: (...args: any) => any;

  contexts?: string[];

  sessionChromedrivers: StringRecord<AppiumChromedriver>;

  chromedriver?: AppiumChromedriver;

  proxyCommand?: AndroidExternalDriver['proxyCommand'];
  jwpProxyActive: boolean;
  curContext: string;

  useUnlockHelperApp?: boolean;

  defaultIME?: string;

  _wasWindowAnimationDisabled?: boolean;

  opts: AndroidDriverOpts;

  constructor(opts: InitialOpts = {} as InitialOpts, shouldValidateCaps = true) {
    super(opts, shouldValidateCaps);

    this.locatorStrategies = [
      'xpath',
      'id',
      'class name',
      'accessibility id',
      '-android uiautomator',
    ];
    this.desiredCapConstraints = _.cloneDeep(ANDROID_DRIVER_CONSTRAINTS);
    this.sessionChromedrivers = {};
    this.jwpProxyActive = false;
    this.apkStrings = {};
    this.unlocker = helpers.unlocker;

    this.curContext = this.defaultContextName();
    this.opts = opts as AndroidDriverOpts;
  }

  isEmulator() {
    return helpers.isEmulator(this.adb, this.opts);
  }

  get isChromeSession() {
    return helpers.isChromeBrowser(String(this.opts.browserName));
  }
}

export {commands as androidCommands} from './commands';
export {AndroidDriver};
