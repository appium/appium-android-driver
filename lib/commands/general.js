import _ from 'lodash';
//import { errors } from 'mobile-json-wire-protocol';
import log from '../logger';

let commands = {}, helpers = {}, extensions = {};

const logTypesSupported = {
  'logcat' : 'Logs for Android applications on real device and emulators ' +
             'via ADB'
};

/*
commands.title = async function () {
  this.assertWebviewContext();
  return this.appModel.title;
};

commands.keys = async function (value) {
  if (!this.focusedElId) {
    throw new errors.InvalidElementStateError();
  }
  await this.setValue(value, this.focusedElId);
};

commands.setGeoLocation = async function (location) {
  // TODO test this adequately once WD bug is fixed
  this.appModel.lat = location.latitude;
  this.appModel.long = location.longitude;
};

commands.getGeoLocation = async function () {
  return this.appModel.currentGeoLocation;
};
*/
commands.getPageSource = function () {
  return this.bootstrap.sendAction('source');
};
/*
commands.getOrientation = async function () {
  return this.appModel.orientation;
};

commands.setOrientation = async function (o) {
  if (!_.contains(["LANDSCAPE", "PORTRAIT"], o)) {
    throw new errors.UnknownError("Orientation must be LANDSCAPE or PORTRAIT");
  }
  this.appModel.orientation = o;
};

commands.getScreenshot = async function () {
  return this.appModel.getScreenshot();
};

*/

commands.back = function () {
  return this.bootstrap.sendAction('pressBack');
};

commands.hideKeyboard = async function () {
  let {isKeyboardShown, canCloseKeyboard} = await this.adb.isSoftKeyboardPresent();
  if (!isKeyboardShown) {
    throw new Error('Soft keyboard not present, cannot hide keyboard');
  }

  if (canCloseKeyboard) {
    return this.back();
  } else {
    log.info('Keyboard has no UI; no closing necessary');
  }
};

commands.getWindowSize = function () {
  return this.bootstrap.sendAction('getDeviceSize');
};

commands.getCurrentActivity = async function () {
  return (await this.adb.getFocusedPackageAndActivity()).appActivity;
};

commands.getLogTypes = function () {
  return _.keys(logTypesSupported);
};

Object.assign(extensions, commands, helpers);
export { commands, helpers };
export default extensions;
