import {AndroidDriverCaps} from '../driver';

export interface ADBDeviceInfo {
  udid: string;
  emPort: number | false;
}

export type ADBLaunchInfo = Pick<
  AndroidDriverCaps,
  'appPackage' | 'appWaitActivity' | 'appActivity' | 'appWaitPackage'
>;
