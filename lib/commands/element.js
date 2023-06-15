// @ts-check

import {AndroidHelpers as androidHelpers} from '../helpers';
import {mixin} from './mixins';
import {retryInterval} from 'asyncbox';
import {util} from '@appium/support';

/**
 * @type {import('./mixins').ElementMixin & ThisType<import('../driver').AndroidDriver>}
 * @satisfies {import('@appium/types').ExternalDriver}
 */
const ElementMixin = {
  async getAttribute(attribute, elementId) {
    let p = {attribute, elementId};
    return await /** @type {AndroidBootstrap} */ (this.bootstrap).sendAction(
      'element:getAttribute',
      p
    );
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
    return await /** @type {AndroidBootstrap} */ (this.bootstrap).sendAction(
      'element:setText',
      params
    );
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
    await /** @type {ADB} */ (this.adb).inputText(/** @type {string} */ (text));
  },

  async getText(elementId) {
    return await /** @type {AndroidBootstrap} */ (this.bootstrap).sendAction('element:getText', {
      elementId,
    });
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
        await /** @type {ADB} */ (this.adb).clearTextField(lengthToSend);
        remainingLength -= lengthToSend;
      }
    });
  },

  async click(elementId) {
    return await /** @type {AndroidBootstrap} */ (this.bootstrap).sendAction('element:click', {
      elementId,
    });
  },

  async getLocation(elementId) {
    return await /** @type {AndroidBootstrap} */ (this.bootstrap).sendAction(
      'element:getLocation',
      {elementId}
    );
  },

  async getLocationInView(elementId) {
    return await this.getLocation(elementId);
  },

  async getSize(elementId) {
    return await /** @type {AndroidBootstrap} */ (this.bootstrap).sendAction('element:getSize', {
      elementId,
    });
  },

  async getElementRect(elementId) {
    return await /** @type {AndroidBootstrap} */ (this.bootstrap).sendAction('element:getRect', {
      elementId,
    });
  },

  async touchLongClick(elementId, x, y, duration) {
    let params = {elementId, x, y, duration};
    androidHelpers.removeNullProperties(params);
    return await /** @type {AndroidBootstrap} */ (this.bootstrap).sendAction(
      'element:touchLongClick',
      params
    );
  },

  async touchDown(elementId, x, y) {
    let params = {elementId, x, y};
    androidHelpers.removeNullProperties(params);
    return await /** @type {AndroidBootstrap} */ (this.bootstrap).sendAction(
      'element:touchDown',
      params
    );
  },

  async touchUp(elementId, x, y) {
    let params = {elementId, x, y};
    androidHelpers.removeNullProperties(params);
    return await /** @type {AndroidBootstrap} */ (this.bootstrap).sendAction(
      'element:touchUp',
      params
    );
  },

  async touchMove(elementId, x, y) {
    let params = {elementId, x, y};
    androidHelpers.removeNullProperties(params);
    return await /** @type {AndroidBootstrap} */ (this.bootstrap).sendAction(
      'element:touchMove',
      params
    );
  },

  async complexTap(tapCount, touchCount, duration, x, y) {
    return await /** @type {AndroidBootstrap} */ (this.bootstrap).sendAction('click', {x, y});
  },

  async tap(elementId = null, x = null, y = null, count = 1) {
    if (!util.hasValue(elementId) && !util.hasValue(x) && !util.hasValue(y)) {
      throw new Error(`Either element to tap or both absolute coordinates should be defined`);
    }
    for (let i = 0; i < count; i++) {
      if (util.hasValue(elementId)) {
        // FIXME: bootstrap ignores relative coordinates
        await /** @type {AndroidBootstrap} */ (this.bootstrap).sendAction('element:click', {
          elementId,
          x,
          y,
        });
      } else {
        await /** @type {AndroidBootstrap} */ (this.bootstrap).sendAction('click', {x, y});
      }
    }
  },
};

mixin(ElementMixin);

export default ElementMixin;

/**
 * @typedef {import('../bootstrap').AndroidBootstrap} AndroidBootstrap
 * @typedef {import('appium-adb').ADB} ADB
 */
