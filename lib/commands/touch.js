import log from '../logger';
import _ from 'lodash';
import androidHelpers from '../android-helpers';
import B from 'bluebird';
import { errors, isErrorType } from 'appium-base-driver';
import { asyncmap } from 'asyncbox';

let commands = {}, helpers = {}, extensions = {};

commands.doTouchAction = async function (action, opts) {
  switch (action) {
    case 'tap':
      return await this.tap(opts.element, opts.x, opts.y, opts.count);
    case 'press':
      return await this.touchDown(opts.element, opts.x, opts.y);
    case 'release':
      return await this.touchUp(opts.element, opts.x, opts.y);
    case 'moveTo':
      return await this.touchMove(opts.element, opts.x, opts.y);
    case 'wait':
      return await B.delay(opts.ms);
    case 'longPress':
      if (typeof opts.duration === 'undefined' || !opts.duration) {
        opts.duration = 1000;
      }
      return await this.touchLongClick(opts.element, opts.x, opts.y, opts.duration);
    case 'cancel':
      // TODO: clarify behavior of 'cancel' action and fix this
      log.warn("Cancel action currently has no effect");
      break;
    default:
      log.errorAndThrow(`unknown action ${action}`);
  }
};


// drag is *not* press-move-release, so we need to translate
// drag works fine for scroll, as well
helpers.doTouchDrag = async function (gestures) {
  let longPress = gestures[0];
  let moveTo = gestures[1];
  let startX = longPress.options.x || 0,
      startY = longPress.options.y || 0,
      endX = moveTo.options.x || 0,
      endY = moveTo.options.y || 0;
  if (longPress.options.element) {
    let {x, y} = await this.getLocationInView(longPress.options.element);
    startX += x || 0;
    startY += y || 0;
  }
  if (moveTo.options.element) {
    let {x, y} = await this.getLocationInView(moveTo.options.element);
    endX += x || 0;
    endY += y || 0;
  }

  let apiLevel = await this.adb.getApiLevel();
  // lollipop takes a little longer to get things rolling
  let duration = apiLevel >= 5 ? 2 : 1;
  // make sure that if the long press has a duration, we use it.
  if (longPress.options && longPress.options.duration) {
    duration = Math.max(longPress.options.duration / 1000, duration);
  }

  // `drag` will take care of whether there is an element or not at that level
  return await this.drag(startX, startY, endX, endY, duration, 1, longPress.options.element, moveTo.options.element);
};

// Release gesture needs element or co-ordinates to release it from that position
// or else release gesture is performed from center of the screen, so to fix it
// This method sets co-ordinates/element to release gesture if it has no options set already.
helpers.fixRelease = async function (gestures) {
  let release = _.last(gestures);
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
  for (let gesture of gestures.reverse()) {
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
          y: loc.y + opts.y
        };
      } else {
        // this is the center of the element
        let size = await this.getSize(opts.element);
        release.options = {
          x: loc.x + size.width / 2,
          y: loc.y + size.height / 2
        };
      }
    } else {
      release.options = _.pick(opts, 'x', 'y');
    }
  }
  return release;
};

// Perform one gesture
helpers.performGesture = async function (gesture) {
  try {
    return await this.doTouchAction(gesture.action, gesture.options || {});
  } catch (e) {
    // sometime the element is not available when releasing, retry without it
    if (isErrorType(e, errors.NoSuchElementError) && gesture.action === 'release' &&
        gesture.options.element) {
      delete gesture.options.element;
      log.debug(`retrying release without element opts: ${gesture.options}.`);
      return await this.doTouchAction(gesture.action, gesture.options || {});
    }
    throw e;
  }
};

commands.performTouch = async function (gestures) {
  if (this.isWebContext()) {
    throw new errors.NotYetImplementedError();
  }

  // press-wait-moveTo-release is `swipe`, so use native method
  if (gestures.length === 4 &&
      gestures[0].action === 'press' &&
      gestures[1].action === 'wait' &&
      gestures[2].action === 'moveTo' &&
      gestures[3].action === 'release') {

    let swipeOpts = await this.getSwipeOptions(gestures);
    return await this.swipe(swipeOpts.startX, swipeOpts.startY, swipeOpts.endX,
        swipeOpts.endY, swipeOpts.duration, swipeOpts.touchCount,
        swipeOpts.element);
  }
  let actions = _.map(gestures, "action");

  if (actions[0] === 'longPress' && actions[1] === 'moveTo' && actions[2] === 'release') {
    // some things are special
    return await this.doTouchDrag(gestures);
  } else {
    if (actions.length === 2) {
      // `press` without a wait is too slow and gets interpretted as a `longPress`
      if (_.head(actions) === 'press' && _.last(actions) === 'release') {
        actions[0] = 'tap';
        gestures[0].action = 'tap';
      }

      // the `longPress` and `tap` methods release on their own
      if ((_.head(actions) === 'tap' || _.head(actions) === 'longPress') && _.last(actions) === 'release') {
        gestures.pop();
        actions.pop();
      }
    } else {
      // longpress followed by anything other than release should become a press and wait
      if (actions[0] === 'longPress') {
        actions = ['press', 'wait', ...actions.slice(1)];

        let press = gestures.shift();
        press.action = 'press';
        let wait = {
          action: 'wait',
          options: {ms: press.options.duration || 1000}
        };
        delete press.options.duration;
        gestures = [press, wait, ...gestures];
      }
    }

    let fixedGestures = await this.parseTouch(gestures, false);
    // fix release action then perform all actions
    if (actions[actions.length - 1] === 'release') {
      actions[actions.length - 1] = await this.fixRelease(gestures);
    }
    for (let g of fixedGestures) {
      await this.performGesture(g);
    }
  }
};

helpers.parseTouch = async function (gestures, multi) {
  // because multi-touch releases at the end by default
  if (multi && _.last(gestures).action === 'release') {
    gestures.pop();
  }

  let touchStateObjects = await asyncmap(gestures, async (gesture) => {
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
          options.x = pos.x + (width / 2);
          options.y = pos.y + (height / 2);
        }
        let touchStateObject = {
          action: gesture.action,
          options,
          timeOffset: 0.005,
        };
        return touchStateObject;
      } else {
        options.x = (gesture.options.x || 0);
        options.y = (gesture.options.y || 0);

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
        offset = (parseInt(gesture.options.ms, 10) / 1000);
      }
      let touchStateObject = {
        action: gesture.action,
        options,
        timeOffset: offset,
      };
      return touchStateObject;
    }
  }, false);
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
      state.time = androidHelpers.truncateDecimals(time, 3);

      // multi gestures require 'touch' rather than 'options'
      if (!_.isUndefined(state.options.x) && !_.isUndefined(state.options.y)) {
        state.touch = {
          x: state.options.x,
          y: state.options.y
        };
      }
      delete state.options;
    }
    delete state.timeOffset;
  }
  return touchStateObjects;
};


commands.performMultiAction = async function (actions, elementId) {
  if (this.isWebContext()) {
    throw new errors.NotYetImplementedError();
  }

  // Android needs at least two actions to be able to perform a multi pointer gesture
  if (actions.length === 1) {
    throw new Error("Multi Pointer Gestures need at least two actions. " +
        "Use Touch Actions for a single action.");
  }

  let states = await asyncmap(actions, async (action) => {
    return await this.parseTouch(action, true);
  }, false);

  return this.doPerformMultiAction(elementId, states);
};

/**
 * Reason for isolating doPerformMultiAction from performMultiAction is for reusing performMultiAction
 * across android-drivers (like appium-uiautomator2-driver) and to avoid code duplication.
 * Other android-drivers (like appium-uiautomator2-driver) need to override doPerformMultiAction
 * to facilitate performMultiAction.
 */
commands.doPerformMultiAction = async function (elementId, states) {
  let opts;
  if (elementId) {
    opts = {
      elementId,
      actions: states
    };
    return await this.bootstrap.sendAction("element:performMultiPointerGesture", opts);
  } else {
    opts = {
      actions: states
    };
    return await this.bootstrap.sendAction("performMultiPointerGesture", opts);
  }
};

Object.assign(extensions, commands, helpers);
export { commands, helpers };
export default extensions;
