import {install} from 'source-map-support';
install();

import {AndroidDriver} from './driver';
export {ANDROID_DRIVER_CONSTRAINTS as commonCapConstraints} from './constraints';
export * from './driver';
export * as doctor from './doctor/checks';

export default AndroidDriver;
