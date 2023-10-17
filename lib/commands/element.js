// @ts-check

import {mixin} from './mixins';
import {retryInterval} from 'asyncbox';
import {errors} from 'appium/driver';

/**
 * @type {import('./mixins').ElementMixin & ThisType<import('../driver').AndroidDriver>}
 * @satisfies {import('@appium/types').ExternalDriver}
 */
const ElementMixin = {
  async getAttribute(attribute, elementId) {
    throw new errors.NotImplementedError('Not implemented');
  },

  async getName(elementId) {
    return await this.getAttribute('className', elementId);
  },

  async elementDisplayed(elementId) {
    return (await this.getAttribute('displayed', elementId)) === 'true';
  },

  async elementEnabled(elementId) {
    return (await this.getAttribute('enabled', elementId)) === 'true';
  },

  async elementSelected(elementId) {
    return (await this.getAttribute('selected', elementId)) === 'true';
  },

  async setElementValue(keys, elementId, replace = false) {
    let text = keys;
    if (keys instanceof Array) {
      text = keys.join('');
    }

    let params = {
      elementId,
      text: String(text),
      replace,
      unicodeKeyboard: this.opts.unicodeKeyboard,
    };

    return await this.doSetElementValue(params);
  },

  /**
   * Reason for isolating doSetElementValue from setElementValue is for reusing setElementValue
   * across android-drivers (like appium-uiautomator2-driver) and to avoid code duplication.
   * Other android-drivers (like appium-uiautomator2-driver) need to override doSetElementValue
   * to facilitate setElementValue.
   */
  async doSetElementValue(params) {
    throw new errors.NotImplementedError('Not implemented');
  },

  async setValue(keys, elementId) {
    return await this.setElementValue(keys, elementId, false);
  },

  async replaceValue(keys, elementId) {
    return await this.setElementValue(keys, elementId, true);
  },

  async setValueImmediate(keys, elementId) {
    let text = keys;
    if (keys instanceof Array) {
      text = keys.join('');
    }

    // first, make sure we are focused on the element
    await this.click(elementId);

    // then send through adb
    await this.adb.inputText(/** @type {string} */ (text));
  },

  async getText(elementId) {
    throw new errors.NotImplementedError('Not implemented');
  },

  async clear(elementId) {
    let text = (await this.getText(elementId)) || '';
    let length = text.length;
    if (length === 0) {
      // if length is zero there are two possibilities:
      //   1. there is nothing in the text field
      //   2. it is a password field
      // since there is little overhead to the adb call, delete 100 elements
      // if we get zero, just in case it is #2
      length = 100;
    }
    await this.click(elementId);
    this.log.debug(`Sending up to ${length} clear characters to device`);
    await retryInterval(5, 500, async () => {
      let remainingLength = length;
      while (remainingLength > 0) {
        let lengthToSend = remainingLength < 50 ? remainingLength : 50;
        this.log.debug(`Sending ${lengthToSend} clear characters to device`);
        await this.adb.clearTextField(lengthToSend);
        remainingLength -= lengthToSend;
      }
    });
  },

  async click(elementId) {
    throw new errors.NotImplementedError('Not implemented');
  },

  async getLocation(elementId) {
    throw new errors.NotImplementedError('Not implemented');
  },

  async getLocationInView(elementId) {
    return await this.getLocation(elementId);
  },

  async getSize(elementId) {
    throw new errors.NotImplementedError('Not implemented');
  },

  async getElementRect(elementId) {
    throw new errors.NotImplementedError('Not implemented');
  },

  async touchLongClick(elementId, x, y, duration) {
    throw new errors.NotImplementedError('Not implemented');
  },

  async touchDown(elementId, x, y) {
    throw new errors.NotImplementedError('Not implemented');
  },

  async touchUp(elementId, x, y) {
    throw new errors.NotImplementedError('Not implemented');
  },

  async touchMove(elementId, x, y) {
    throw new errors.NotImplementedError('Not implemented');
  },

  async complexTap(tapCount, touchCount, duration, x, y) {
    throw new errors.NotImplementedError('Not implemented');
  },

  async tap(elementId = null, x = null, y = null, count = 1) {
    throw new errors.NotImplementedError('Not implemented');
  },
};

mixin(ElementMixin);

export default ElementMixin;

/**
 * @typedef {import('appium-adb').ADB} ADB
 */
