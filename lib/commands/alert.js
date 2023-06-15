// @ts-check

import {errors} from 'appium/driver';
import {mixin} from './mixins';

/**
 * @type {AlertMixin & ThisType<import('../driver').AndroidDriver>}
 * @satisfies {import('@appium/types').ExternalDriver}
 */
const AlertMixin = {
  getAlertText() {
    throw new errors.NotYetImplementedError();
  },

  setAlertText() {
    throw new errors.NotYetImplementedError();
  },

  postAcceptAlert() {
    throw new errors.NotYetImplementedError();
  },

  postDismissAlert() {
    throw new errors.NotYetImplementedError();
  },
};

mixin(AlertMixin);

export default AlertMixin;

/**
 * @typedef {import('./mixins').AlertMixin} AlertMixin
 */
