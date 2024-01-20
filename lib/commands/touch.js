/* eslint-disable @typescript-eslint/no-unused-vars */

import {util} from '@appium/support';
import {errors, isErrorType} from 'appium/driver';
import {asyncmap} from 'asyncbox';
import B from 'bluebird';
import _ from 'lodash';

/**
 * @deprecated
 * @this {import('../driver').AndroidDriver}
 * @param {string?} [elementId=null]
 * @param {number?} [x=null]
 * @param {number?} [y=null]
 * @param {number} [count=1]
 * @returns {Promise<void>}
 */
export async function tap(elementId = null, x = null, y = null, count = 1) {
  throw new errors.NotImplementedError('Not implemented');
}

/**
 * @deprecated
 * @this {import('../driver').AndroidDriver}
 * @param {string} elementId
 * @param {number} x
 * @param {number} y
 * @param {number} duration
 * @returns {Promise<void>}
 */
export async function touchLongClick(elementId, x, y, duration) {
  throw new errors.NotImplementedError('Not implemented');
}

/**
 * @deprecated
 * @this {import('../driver').AndroidDriver}
 * @param {string} elementId
 * @param {number} x
 * @param {number} y
 * @returns {Promise<void>}
 */
export async function touchDown(elementId, x, y) {
  throw new errors.NotImplementedError('Not implemented');
}

/**
 * @deprecated
 * @this {import('../driver').AndroidDriver}
 * @param {string} elementId
 * @param {number} x
 * @param {number} y
 * @returns {Promise<void>}
 */
export async function touchUp(elementId, x, y) {
  throw new errors.NotImplementedError('Not implemented');
}

/**
 * @deprecated
 * @this {import('../driver').AndroidDriver}
 * @param {string} elementId
 * @param {number} x
 * @param {number} y
 * @returns {Promise<void>}
 */
export async function touchMove(elementId, x, y) {
  throw new errors.NotImplementedError('Not implemented');
}

/**
 * @deprecated
 * @this {import('../driver').AndroidDriver}
 * @param {import('./types').SwipeOpts} opts
 * @returns {Promise<void>}
 */
export async function doSwipe(opts) {
  throw new errors.NotImplementedError('Not implemented');
}

/**
 * @deprecated
 * @this {import('../driver').AndroidDriver}
 * @param {import('./types').TouchDragAction} opts
 * @returns {Promise<void>}
 */
export async function doTouchDrag(opts) {
  throw new errors.NotImplementedError('Not implemented');
}

/**
 * @deprecated
 * @this {import('../driver').AndroidDriver}
 * @param {import('./types').TouchActionKind} action
 * @param {import('./types').TouchActionOpts} [opts={}]
 * @returns {Promise<void>}
 */
export async function doTouchAction(action, opts = {}) {
  const {element, x, y, count, ms, duration} = opts;
  // parseTouch precalculates absolute element positions
  // so there is no need to pass `element` to the affected gestures
  switch (action) {
    case 'tap':
      return await this.tap('', x, y, count);
    case 'press':
      return await this.touchDown('', /** @type {number} */ (x), /** @type {number} */ (y));
    case 'release':
      return await this.touchUp(
        String(element),
        /** @type {number} */ (x),
        /** @type {number} */ (y),
      );
    case 'moveTo':
      return await this.touchMove('', /** @type {number} */ (x), /** @type {number} */ (y));
    case 'wait':
      return await B.delay(/** @type {number} */ (ms));
    case 'longPress':
      return await this.touchLongClick(
        '',
        /** @type {number} */ (x),
        /** @type {number} */ (y),
        duration ?? 1000,
      );
    case 'cancel':
      // TODO: clarify behavior of 'cancel' action and fix this
      this.log.warn('Cancel action currently has no effect');
      break;
    default:
      this.log.errorAndThrow(`unknown action ${action}`);
  }
}

/**
 * @deprecated
 * @this {import('../driver').AndroidDriver}
 * @param {import('./types').TouchAction[]} gestures
 * @returns {Promise<void>}
 */
export async function performTouch(gestures) {
  // press-wait-moveTo-release is `swipe`, so use native method
  if (
    gestures.length === 4 &&
    gestures[0].action === 'press' &&
    gestures[1].action === 'wait' &&
    gestures[2].action === 'moveTo' &&
    gestures[3].action === 'release'
  ) {
    let swipeOpts = await getSwipeOptions.bind(this)(
      /** @type {import('./types').SwipeAction} */ (gestures),
    );
    return await this.doSwipe(swipeOpts);
  }
  let actions = /** @type {(import('./types').TouchActionKind|TouchAction)[]} */ (
    _.map(gestures, 'action')
  );

  if (actions[0] === 'longPress' && actions[1] === 'moveTo' && actions[2] === 'release') {
    // some things are special
    return await this.doTouchDrag(/** @type {import('./types').TouchDragAction} */ (gestures));
  } else {
    if (actions.length === 2) {
      // `press` without a wait is too slow and gets interpretted as a `longPress`
      if (_.head(actions) === 'press' && _.last(actions) === 'release') {
        actions[0] = 'tap';
        gestures[0].action = 'tap';
      }

      // the `longPress` and `tap` methods release on their own
      if (
        (_.head(actions) === 'tap' || _.head(actions) === 'longPress') &&
        _.last(actions) === 'release'
      ) {
        gestures.pop();
        actions.pop();
      }
    } else {
      // longpress followed by anything other than release should become a press and wait
      if (actions[0] === 'longPress') {
        actions = ['press', 'wait', ...actions.slice(1)];

        let press = /** @type {NonReleaseTouchAction} */ (gestures.shift());
        press.action = 'press';
        /** @type {NonReleaseTouchAction} */
        let wait = {
          action: 'wait',
          options: {ms: press.options.duration || 1000},
        };
        delete press.options.duration;
        gestures = [press, wait, ...gestures];
      }
    }

    let fixedGestures = await parseTouch.bind(this)(gestures, false);
    // fix release action then perform all actions
    if (actions[actions.length - 1] === 'release') {
      actions[actions.length - 1] = /** @type {TouchAction} */ (
        await fixRelease.bind(this)(gestures)
      );
    }
    for (let g of fixedGestures) {
      await performGesture.bind(this)(g);
    }
  }
}

/**
 * @deprecated
 * @this {import('../driver').AndroidDriver}
 * @param {import('./types').TouchAction[]} actions
 * @param {string} elementId
 * @returns {Promise<void>}
 */
export async function performMultiAction(actions, elementId) {
  // Android needs at least two actions to be able to perform a multi pointer gesture
  if (actions.length === 1) {
    throw new Error(
      'Multi Pointer Gestures need at least two actions. ' +
        'Use Touch Actions for a single action.',
    );
  }

  const states = await asyncmap(
    actions,
    async (action) => await parseTouch.bind(this)(action, true),
    false,
  );

  return await this.doPerformMultiAction(elementId, states);
}

/**
 * @deprecated
 * @this {import('../driver').AndroidDriver}
 * @param {string} elementId
 * @param {import('./types').TouchState[]} states
 * @returns {Promise<void>}
 */
export async function doPerformMultiAction(elementId, states) {
  throw new errors.NotImplementedError('Not implemented');
}

// #region Internal helpers

/**
 * @deprecated
 * @param {number|null} [val]
 * @returns {number}
 */
function getCoordDefault(val) {
  // going the long way and checking for undefined and null since
  // we can't be assured `elId` is a string and not an int. Same
  // thing with destElement below.
  return util.hasValue(val) ? val : 0.5;
}

/**
 * @deprecated
 * @param {number} number
 * @param {number} digits
 * @returns {number}
 */
export function truncateDecimals(number, digits) {
  const multiplier = Math.pow(10, digits),
    adjustedNum = number * multiplier,
    truncatedNum = Math[adjustedNum < 0 ? 'ceil' : 'floor'](adjustedNum);

  return truncatedNum / multiplier;
}

/**
 * @deprecated
 * @param {NonReleaseTouchAction} waitGesture
 * @returns {number}
 */
function getSwipeTouchDuration(waitGesture) {
  // the touch action api uses ms, we want seconds
  // 0.8 is the default time for the operation
  let duration = 0.8;
  if (typeof waitGesture.options.ms !== 'undefined' && waitGesture.options.ms) {
    duration = waitGesture.options.ms / 1000;
    if (duration === 0) {
      // set to a very low number, since they wanted it fast
      // but below 0.1 becomes 0 steps, which causes errors
      duration = 0.1;
    }
  }
  return duration;
}

/**
 * @deprecated
 * @this {import('../driver').AndroidDriver}
 * @param {import('./types').SwipeAction} gestures
 * @param {number} [touchCount=1]
 * @returns {Promise<import('./types').TouchSwipeOpts>}
 */
async function getSwipeOptions(gestures, touchCount = 1) {
  let startX = getCoordDefault(gestures[0].options.x),
    startY = getCoordDefault(gestures[0].options.y),
    endX = getCoordDefault(gestures[2].options.x),
    endY = getCoordDefault(gestures[2].options.y),
    duration = getSwipeTouchDuration(gestures[1]),
    element = /** @type {string} */ (gestures[0].options.element),
    destElement = gestures[2].options.element || gestures[0].options.element;

  // there's no destination element handling in bootstrap and since it applies to all platforms, we handle it here
  if (util.hasValue(destElement)) {
    let locResult = await this.getLocationInView(destElement);
    let sizeResult = await this.getSize(destElement);
    let offsetX = Math.abs(endX) < 1 && Math.abs(endX) > 0 ? sizeResult.width * endX : endX;
    let offsetY = Math.abs(endY) < 1 && Math.abs(endY) > 0 ? sizeResult.height * endY : endY;
    endX = locResult.x + offsetX;
    endY = locResult.y + offsetY;
    // if the target element was provided, the coordinates for the destination need to be relative to it.
    if (util.hasValue(element)) {
      let firstElLocation = await this.getLocationInView(element);
      endX -= firstElLocation.x;
      endY -= firstElLocation.y;
    }
  }
  // clients are responsible to use these options correctly
  return {startX, startY, endX, endY, duration, touchCount, element};
}

/**
 * @deprecated
 * @this {import('../driver').AndroidDriver}
 * @param {import('./types').TouchAction[]} gestures
 * @param {boolean} [multi]
 * @returns {Promise<import('./types').TouchState[]>}
 */
async function parseTouch(gestures, multi) {
  // because multi-touch releases at the end by default
  if (multi && /** @type {TouchAction} */ (_.last(gestures)).action === 'release') {
    gestures.pop();
  }

  let touchStateObjects = await asyncmap(
    gestures,
    async (gesture) => {
      let options = gesture.options || {};
      if (_.includes(['press', 'moveTo', 'tap', 'longPress'], gesture.action)) {
        options.offset = false;
        let elementId = gesture.options.element;
        if (elementId) {
          let pos = await this.getLocationInView(elementId);
          if (gesture.options.x || gesture.options.y) {
            options.x = pos.x + (gesture.options.x || 0);
            options.y = pos.y + (gesture.options.y || 0);
          } else {
            const {width, height} = await this.getSize(elementId);
            options.x = pos.x + width / 2;
            options.y = pos.y + height / 2;
          }
          let touchStateObject = {
            action: gesture.action,
            options,
            timeOffset: 0.005,
          };
          return touchStateObject;
        } else {
          options.x = gesture.options.x || 0;
          options.y = gesture.options.y || 0;

          let touchStateObject = {
            action: gesture.action,
            options,
            timeOffset: 0.005,
          };
          return touchStateObject;
        }
      } else {
        let offset = 0.005;
        if (gesture.action === 'wait') {
          options = gesture.options;
          offset = parseInt(gesture.options.ms, 10) / 1000;
        }
        let touchStateObject = {
          action: gesture.action,
          options,
          timeOffset: offset,
        };
        return touchStateObject;
      }
    },
    false,
  );
  // we need to change the time (which is now an offset)
  // and the position (which may be an offset)
  let prevPos = null,
    time = 0;
  for (let state of touchStateObjects) {
    if (_.isUndefined(state.options.x) && _.isUndefined(state.options.y) && prevPos !== null) {
      // this happens with wait
      state.options.x = prevPos.x;
      state.options.y = prevPos.y;
    }
    if (state.options.offset && prevPos) {
      // the current position is an offset
      state.options.x += prevPos.x;
      state.options.y += prevPos.y;
    }
    delete state.options.offset;
    if (!_.isUndefined(state.options.x) && !_.isUndefined(state.options.y)) {
      prevPos = state.options;
    }

    if (multi) {
      let timeOffset = state.timeOffset;
      time += timeOffset;
      state.time = truncateDecimals(time, 3);

      // multi gestures require 'touch' rather than 'options'
      if (!_.isUndefined(state.options.x) && !_.isUndefined(state.options.y)) {
        state.touch = {
          x: state.options.x,
          y: state.options.y,
        };
      }
      delete state.options;
    }
    delete state.timeOffset;
  }
  return touchStateObjects;
}

/**
 * @deprecated
 * @this {import('../driver').AndroidDriver}
 * @param {import('./types').TouchAction[]} gestures
 * @returns {Promise<import('./types').ReleaseTouchAction|undefined>}
 */
async function fixRelease(gestures) {
  let release = /** @type {import('./types').ReleaseTouchAction} */ (_.last(gestures));
  // sometimes there are no options
  release.options = release.options || {};
  // nothing to do if release options are already set
  if (release.options.element || (release.options.x && release.options.y)) {
    return;
  }
  // without coordinates, `release` uses the center of the screen, which,
  // generally speaking, is not what we want
  // therefore: loop backwards and use the last command with an element and/or
  // offset coordinates
  gestures = _.clone(gestures);
  let ref = null;
  for (let gesture of /** @type {NonReleaseTouchAction[]} */ (gestures.reverse())) {
    let opts = gesture.options;
    if (opts.element || (opts.x && opts.y)) {
      ref = gesture;
      break;
    }
  }
  if (ref) {
    let opts = ref.options;
    if (opts.element) {
      let loc = await this.getLocationInView(opts.element);
      if (opts.x && opts.y) {
        // this is an offset from the element
        release.options = {
          x: loc.x + opts.x,
          y: loc.y + opts.y,
        };
      } else {
        // this is the center of the element
        let size = await this.getSize(opts.element);
        release.options = {
          x: loc.x + size.width / 2,
          y: loc.y + size.height / 2,
        };
      }
    } else {
      release.options = _.pick(opts, 'x', 'y');
    }
  }
  return release;
}

/**
 * @deprecated
 * @this {import('../driver').AndroidDriver}
 * @param {import('./types').TouchAction} gesture
 * @returns {Promise<void>}
 */
async function performGesture(gesture) {
  try {
    return await this.doTouchAction(gesture.action, gesture.options || {});
  } catch (e) {
    // sometime the element is not available when releasing, retry without it
    if (
      isErrorType(e, errors.NoSuchElementError) &&
      gesture.action === 'release' &&
      gesture.options?.element
    ) {
      delete gesture.options.element;
      this.log.debug(`retrying release without element opts: ${gesture.options}.`);
      return await this.doTouchAction(gesture.action, gesture.options || {});
    }
    throw e;
  }
}

// #endregion

/**
 * @typedef {import('appium-adb').ADB} ADB
 * @typedef {import('./types').TouchAction} TouchAction
 * @typedef {import('./types').NonReleaseTouchAction} NonReleaseTouchAction
 */
