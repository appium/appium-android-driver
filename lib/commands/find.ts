/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * @module
 */

import _ from 'lodash';
import {errors, isErrorType} from 'appium/driver';
import type {AndroidDriver} from '../driver';
import type {Element} from '@appium/types';
import type {FindElementOpts} from './types';

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
    if (err.message && err.message.match(/Condition unmet/)) {
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

export async function doFindElementOrEls(
  this: AndroidDriver,
  params: FindElementOpts,
): Promise<Element | Element[]> {
  throw new errors.NotImplementedError('Not implemented');
}
