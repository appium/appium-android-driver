const swipeStepsPerSec = 28,
      dragStepsPerSec = 40;

let commands = {}, helpers = {}, extensions = {};

commands.pressKeyCode = function (keycode, metastate) {
  return this.bootstrap.sendAction("pressKeyCode", {keycode, metastate});
};

commands.longPressKeyCode = function (keycode, metastate) {
  return this.bootstrap.sendAction("longPressKeyCode", {keycode, metastate});
};

commands.getOrientation = function () {
  return this.bootstrap.sendAction("orientation", {});
};

commands.setOrientation = function (orientation) {
  return this.bootstrap.sendAction("orientation", {orientation});
};

commands.fakeFlick = function (xSpeed, ySpeed) {
  return this.bootstrap.sendAction("flick", {xSpeed, ySpeed});
};

commands.fakeFlickElement = function (elementId, xoffset, yoffset, speed) {
  let param = {xoffset, yoffset, speed, elementId};
  return this.bootstrap.sendAction("element:flick", param);
};

commands.swipe = function (startX, startY, endX, endY, duration, touchCount, elId) {
  if (startX === 'null') {
    startX = 0.5;
  }
  if (startY === 'null') {
    startY = 0.5;
  }
  let swipeOpts = {startX, startY, endX, endY,
                   steps: Math.round(duration * swipeStepsPerSec)};
  // going the long way and checking for undefined and null since
  // we can't be assured `elId` is a string and not an int
  if (typeof elId !== "undefined" && elId !== null) {
    swipeOpts.elementId = elId;
    return this.bootstrap.sendAction("element:swipe", swipeOpts);
  } else {
    return this.bootstrap.sendAction("swipe", swipeOpts);
  }
};

commands.pinchClose = function (startX, startY, endX, endY, duration, percent, steps, elId) {
  let pinchOpts = {
    direction: 'in',
    elementId: elId,
    percent,
    steps
  };
  return this.bootstrap.sendAction("element:pinch", pinchOpts);
};

commands.pinchOpen = function (startX, startY, endX, endY, duration, percent, steps, elId) {
  let pinchOpts = {direction: 'out', elementId: elId, percent, steps};
  return this.bootstrap.sendAction("element:pinch", pinchOpts);
};

commands.flick = function (startX, startY, endX, endY, touchCount, elId) {
  if (startX === 'null') {
    startX = 0.5;
  }
  if (startY === 'null') {
    startY = 0.5;
  }
  let swipeOpts = {startX, startY, endX, endY, steps: Math.round(0.2 * swipeStepsPerSec)};
  if (elId !== null) {
    swipeOpts.elementId = elId;
    return this.bootstrap.sendAction("element:swipe", swipeOpts);
  } else {
    return this.bootstrap.sendAction("swipe", swipeOpts);
  }
};

commands.drag = function (startX, startY, endX, endY, duration, touchCount, elementId, destElId) {
  let dragOpts = {elementId, destElId, startX, startY, endX, endY,
                  steps: Math.round(duration * dragStepsPerSec)};
  if (elementId) {
    return this.bootstrap.sendAction("element:drag", dragOpts);
  } else {
    return this.bootstrap.sendAction("drag", dragOpts);
  }
};

Object.assign(extensions, commands, helpers);
export { commands, helpers };
export default extensions;
