import { BaseDriver } from 'appium-base-driver';
import commands from './commands/index';
import _ from 'lodash';

class AndroidDriver extends BaseDriver {

}

for (let [cmd, fn] of _.pairs(commands)) {
  AndroidDriver.prototype[cmd] = fn;
}

export default AndroidDriver;
