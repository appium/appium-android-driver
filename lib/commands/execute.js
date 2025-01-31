import _ from 'lodash';
import {errors, PROTOCOLS} from 'appium/driver';
import { util } from '@appium/support';

const EXECUTE_SCRIPT_PREFIX = 'mobile:';

/**
 * @this {AndroidDriver}
 * @param {string} script
 * @param {ExecuteMethodArgs} [args]
 * @returns {Promise<any>}
 */
export async function execute(script, args) {
  if (_.startsWith(script, EXECUTE_SCRIPT_PREFIX)) {
    const formattedScript = script.trim().replace(/^mobile:\s*/, `${EXECUTE_SCRIPT_PREFIX} `);
    const executeMethodArgs = preprocessExecuteMethodArgs(args);
    return await this.executeMethod(formattedScript, [executeMethodArgs]);
  }
  if (!this.isWebContext()) {
    throw new errors.NotImplementedError();
  }
  const endpoint =
    /** @type {import('appium-chromedriver').Chromedriver} */ (this.chromedriver).jwproxy
      .downstreamProtocol === PROTOCOLS.MJSONWP
      ? '/execute'
      : '/execute/sync';
  return await /** @type {import('appium-chromedriver').Chromedriver} */ (
    this.chromedriver
  ).jwproxy.command(endpoint, 'POST', {
    script,
    args,
  });
}

// #region Internal Helpers

/**
 * Massages the arguments going into an execute method.
 *
 * @param {ExecuteMethodArgs} [args]
 * @returns {StringRecord}
 */
function preprocessExecuteMethodArgs(args) {
  const executeMethodArgs = /** @type {StringRecord} */ ((_.isArray(args) ? _.first(args) : args) ?? {});

  /**
   * Renames the deprecated `element` key to `elementId`.  Historically,
   * all of the pre-Execute-Method-Map execute methods accepted an `element` _or_ and `elementId` param.
   * This assigns the `element` value to `elementId` if `elementId` is not already present.
   */
  if (!('elementId' in executeMethodArgs) && 'element' in executeMethodArgs) {
    executeMethodArgs.elementId = executeMethodArgs.element;
  }

  /**
   * Automatically unwraps the `elementId` prop _if and only if_ the execute method expects it.
   */
  if ('elementId' in executeMethodArgs) {
    executeMethodArgs.elementId = util.unwrapElement(
      /** @type {import('@appium/types').Element|string} */ (executeMethodArgs.elementId),
    );
  }

  return executeMethodArgs;
}

// #endregion

/**
 * @typedef {import('../driver').AndroidDriver} AndroidDriver
 * @typedef {import('@appium/types').StringRecord} StringRecord
 * @typedef {readonly any[] | readonly [StringRecord] | Readonly<StringRecord>} ExecuteMethodArgs
 */