import _ from 'lodash';
import { errors, isErrorType } from 'appium-base-driver';


let helpers = {}, extensions = {};

/**
 * Reason for isolating doFindElementOrEls from findElOrEls is for reusing findElOrEls
 * across android-drivers (like appium-uiautomator2-driver) to avoid code duplication.
 * Other android-drivers (like appium-uiautomator2-driver) need to override doFindElementOrEls
 * to facilitate findElOrEls.
 */
helpers.doFindElementOrEls = async function (params) {
  return await this.bootstrap.sendAction('find', params);
};

// stategy: locator strategy
// selector: the actual selector for finding an element
// mult: multiple elements or just one?
// context: finding an element from the root context? or starting from another element
helpers.findElOrEls = async function (strategy, selector, mult, context = '') {
  if (!selector) {
    throw new Error('Must provide a selector when finding elements');
  }

  const params = {
    strategy,
    selector,
    context,
    multiple: mult
  };

  if (mult) {
    // Do not apply implicit wait if looking for multiple elements
    return (await this.doFindElementOrEls(params) || []);
  }

  let element;
  const doFind = async () => {
    try {
      element = await this.doFindElementOrEls(params);
    } catch (err) {

      // if the error that comes back is from a proxied request, we need to
      // unwrap it to its actual protocol error first
      if (isErrorType(err, errors.ProxyRequestError)) {
        err = err.getActualError(); // eslint-disable-line no-ex-assign
      }

      // now we have to inspect the error to determine if it is a no such
      // element error, based on the shape of the error object from
      // appium-base-driver
      if (isErrorType(err, errors.NoSuchElementError)) {
        // we are fine with this, just indicate a retry
        return false;
      }
      throw err;
    }

    // we want to return false if we want to potentially try again
    return !_.isEmpty(element);
  };
  try {
    await this.implicitWaitForCondition(doFind);
  } catch (err) {
    if (!(err.message && err.message.match(/Condition unmet/))) {
      throw err;
    }
  }
  if (_.isEmpty(element)) {
    throw new errors.NoSuchElementError();
  }
  return element;
};

Object.assign(extensions, helpers);
export { helpers };
export default extensions;
