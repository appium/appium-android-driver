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
import {newMethodMap} from './method-map';
import { SettingsApp } from 'io.appium.settings';
import { parseArray } from './utils';
import { removeAllSessionWebSocketHandlers } from './helpers/websocket';
import { CHROME_BROWSER_PACKAGE_ACTIVITY } from './commands/context/helpers';

export type AndroidDriverCaps = DriverCaps<AndroidDriverConstraints>;
export type W3CAndroidDriverCaps = W3CDriverCaps<AndroidDriverConstraints>;
export type AndroidDriverOpts = DriverOpts<AndroidDriverConstraints>;

const EMULATOR_PATTERN = /\bemulator\b/i;

type AndroidExternalDriver = ExternalDriver<AndroidDriverConstraints>;
class AndroidDriver
  extends BaseDriver<AndroidDriverConstraints, StringRecord>
  implements ExternalDriver<AndroidDriverConstraints, string, StringRecord>
{
  static newMethodMap = newMethodMap;
  jwpProxyAvoid: RouteMatcher[];

  adb: ADB;

  _settingsApp: SettingsApp;

  apkStrings: StringRecord;

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

  _cachedActivityArgs: StringRecord;

  _screenStreamingProps?: StringRecord;

  _screenRecordingProperties?: StringRecord;

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

    this.curContext = this.defaultContextName();
    this.opts = opts as AndroidDriverOpts;
    this._cachedActivityArgs = {};
  }

  get settingsApp(): SettingsApp {
    if (!this._settingsApp) {
      this._settingsApp = new SettingsApp({adb: this.adb});
    }
    return this._settingsApp;
  }

  isEmulator(): boolean {
    const possibleNames = [this.opts?.udid, this.adb?.curDeviceId];
    return !!this.opts?.avd || possibleNames.some((x) => EMULATOR_PATTERN.test(String(x)));
  }

  get isChromeSession(): boolean {
    return _.includes(Object.keys(CHROME_BROWSER_PACKAGE_ACTIVITY), (this.opts.browserName || '').toLowerCase());
  }

  override validateDesiredCaps(caps: any): caps is AndroidDriverCaps {
    if (!super.validateDesiredCaps(caps)) {
      return false;
    }

    if (caps.browserName) {
      if (caps.app) {
        // warn if the capabilities have both `app` and `browser, although this is common with selenium grid
        this.log.warn(
          `The desired capabilities should generally not include both an 'app' and a 'browserName'`
        );
      }
      if (caps.appPackage) {
        throw this.log.errorAndThrow(
          `The desired should not include both of an 'appPackage' and a 'browserName'`
        );
      }
    }

    if (caps.uninstallOtherPackages) {
      try {
        parseArray(caps.uninstallOtherPackages);
      } catch (e) {
        throw this.log.errorAndThrow(
          `Could not parse "uninstallOtherPackages" capability: ${(e as Error).message}`
        );
      }
    }

    return true;
  }

  override async deleteSession(sessionId?: string | null) {
    if (this.server) {
      await removeAllSessionWebSocketHandlers(this.server, sessionId);
    }

    await super.deleteSession(sessionId);
  }
}

export {AndroidDriver};
