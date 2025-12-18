/* eslint-disable @typescript-eslint/no-unused-vars */

import _ from 'lodash';
import {errors, isErrorType} from 'appium/driver';
import type {AndroidDriver} from '../driver';
import type {Element} from '@appium/types';
import type {FindElementOpts} from './types';

/**
 * @param strategy The element location strategy to use (e.g., 'id', 'xpath', 'class name').
 * @param selector The selector value to search for.
 * @param mult If `true`, searches for multiple elements; if `false`, searches for a single element.
 * @param context The context (e.g., webview) in which to search. Defaults to empty string (native context).
 * @returns If `mult` is `false`, returns a single `Element` object.
 * If `mult` is `true`, returns an array of `Element` objects (may be empty).
 * @throws {Error} If `selector` is not provided.
 * @throws {errors.NoSuchElementError} If a single element search fails and no element is found.
 */
export async function findElOrEls(
  this: AndroidDriver,
  strategy: string,
  selector: string,
  mult: true,
  context?: string,
): Promise<Element[]>;
export async function findElOrEls(
  this: AndroidDriver,
  strategy: string,
  selector: string,
  mult: false,
  context?: string,
): Promise<Element>;
export async function findElOrEls(
  this: AndroidDriver,
  strategy: string,
  selector: string,
  mult: boolean,
  context = '',
) {
  if (!selector) {
    throw new Error('Must provide a selector when finding elements');
  }

  const params: FindElementOpts = {
    strategy,
    selector,
    context,
    multiple: mult,
  };

  let element: Element | Element[] | undefined;
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
      // appium/driver
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
  } catch (e) {
    const err = e as Error;
    if (err.message?.match(/Condition unmet/)) {
      // only get here if we are looking for multiple elements
      // condition was not met setting res to empty array
      element = [];
    } else {
      throw err;
    }
  }

  if (mult) {
    return element as Element[];
  }
  if (_.isEmpty(element)) {
    throw new errors.NoSuchElementError();
  }
  return element as Element;
}

/**
 * Performs the actual element search operation.
 *
 * This is an abstract method that must be implemented by subclasses or specific
 * context handlers (e.g., native context, webview context).
 *
 * @param params The search parameters containing strategy, selector, context, and multiple flag.
 * @returns A single `Element` if `params.multiple` is `false`, or an array of `Element` objects if `true`.
 * @throws {errors.NotImplementedError} This method must be implemented by the specific context handler.
 */
export async function doFindElementOrEls(
  this: AndroidDriver,
  params: FindElementOpts,
): Promise<Element | Element[]> {
  throw new errors.NotImplementedError('Not implemented');
}
