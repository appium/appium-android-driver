// @ts-check

import {mixin} from './mixins';
import {errors} from 'appium/driver';

const EMU_CONSOLE_FEATURE = 'emulator_console';
/**
 * @type {import('./mixins').EmulatorConsoleMixin & ThisType<import('../driver').AndroidDriver>}
 * @satisfies {import('@appium/types').ExternalDriver}
 */
const EmulatorConsoleMixin = {
  async mobileExecEmuConsoleCommand(opts) {
    this.ensureFeatureEnabled(EMU_CONSOLE_FEATURE);

    const {command, execTimeout, connTimeout, initTimeout} = opts;

    if (!command) {
      throw new errors.InvalidArgumentError(`The 'command' argument is mandatory`);
    }

    return await /** @type {import('appium-adb').ADB} */ (this.adb).execEmuConsoleCommand(command, {
      execTimeout,
      connTimeout,
      initTimeout,
    });
  },
};

mixin(EmulatorConsoleMixin);

export default EmulatorConsoleMixin;
