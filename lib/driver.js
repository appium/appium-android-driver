import { BaseDriver } from 'appium-base-driver';
import desiredConstraints from './desired-caps.js';
import commands from './commands/index';
import _ from 'lodash';

class AndroidDriver extends BaseDriver {
  constructor (opts = {}, shouldValidateCaps = true) {
    super(opts, shouldValidateCaps);

    this.desiredConstraints = desiredConstraints;
  }
}

for (let [cmd, fn] of _.pairs(commands)) {
  AndroidDriver.prototype[cmd] = fn;
}

export default AndroidDriver;
