import {install} from 'source-map-support';
install();

import {AndroidDriver} from './driver';
import {getChromePkg} from './commands/context/helpers';
import {parseArray, requireArgs} from './utils';
export const utils = {
  getChromePkg,
  parseArray,
  requireArgs,
} as const;
export type * from './commands/types';
export {ANDROID_DRIVER_CONSTRAINTS as commonCapConstraints} from './constraints';
export * from './driver';
export * as doctor from './doctor/checks';

export default AndroidDriver;
