import type {ADB} from 'appium-adb';
import {AndroidDriverCaps} from '../driver';

/**
 * @deprecated
 */
export type TADB = ADB;

/**
 * XXX Placeholder for ADB options
 */
export type TADBOptions = any;

export interface FastUnlockOptions {
  credential: string;
  /**
   * @privateRemarks FIXME: narrow this type to whatever `appium-adb` expects
   */
  credentialType: string;
}

/**
 * XXX May be wrong
 */
export interface ADBDeviceInfo {
  udid: string;
  emPort: number | false;
}

export type ADBLaunchInfo = Pick<
  AndroidDriverCaps,
  'appPackage' | 'appWaitActivity' | 'appActivity' | 'appWaitPackage'
>;
