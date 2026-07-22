import {AndroidDriver} from './driver.js';
import {getChromePkg} from './commands/context/helpers.js';
import {parseArray, requireArgs} from './utils.js';
export const utils = {
  getChromePkg,
  parseArray,
  requireArgs,
} as const;
export type * from './commands/types.js';
export {ANDROID_DRIVER_CONSTRAINTS as commonCapConstraints} from './constraints.js';
export * from './driver.js';
export * as doctor from './doctor/checks.js';

export default AndroidDriver;
