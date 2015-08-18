//import _ from 'lodash';
//import { errors } from 'mobile-json-wire-protocol';
//import log from '../logger';

let commands = {}, helpers = {}, extensions = {};

// stategy: locator strategy
// selector: the actual selector for finding an element
// mult: multiple elements or just one?
// context: finding an element from the root context? or starting from another element
helpers.findElOrEls = async function (strategy, selector, mult, context = '') {
  // throws error if not valid, uses this.locatorStrategies
  this.validateLocatorStrategy(strategy);

  if (strategy === "xpath" && context) {
    throw new Error("Cannot use xpath locator strategy from an element. " +
                    "It can only be used from the root element");
  }

  if (!selector) {
    throw new Error("Must provide a selector when finding elements");
  }

  let params = {
    strategy: strategy,
    selector: selector,
    context: context,
    multiple: mult
  };

  return this.bootstrap.sendAction('find', params);
};

Object.assign(extensions, commands, helpers);
export { commands, helpers};
export default extensions;
