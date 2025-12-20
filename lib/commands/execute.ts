import _ from 'lodash';
import {errors, PROTOCOLS} from 'appium/driver';
import { util } from '@appium/support';
import type {StringRecord, Element} from '@appium/types';
import type {AndroidDriver} from '../driver';
import type {Chromedriver} from 'appium-chromedriver';

const EXECUTE_SCRIPT_PREFIX = 'mobile:';

/**
 * Executes a script on the device or in a web context.
 *
 * @param script The script to execute. If it starts with 'mobile:', it will be treated
 * as a mobile command. Otherwise, it will be executed in the web context (if available).
 * @param args Optional arguments to pass to the script.
 * @returns Promise that resolves to the script execution result.
 * @throws {errors.NotImplementedError} If not in a web context and script doesn't start with 'mobile:'.
 */
export async function execute(
  this: AndroidDriver,
  script: string,
  args?: ExecuteMethodArgs,
): Promise<any> {
  if (_.startsWith(script, EXECUTE_SCRIPT_PREFIX)) {
    const formattedScript = script.trim().replace(/^mobile:\s*/, `${EXECUTE_SCRIPT_PREFIX} `);
    const executeMethodArgs = preprocessExecuteMethodArgs(args);
    return await this.executeMethod(formattedScript, [executeMethodArgs]);
  }
  if (!this.isWebContext()) {
    throw new errors.NotImplementedError();
  }
  const endpoint =
    (this.chromedriver as Chromedriver).jwproxy
      .downstreamProtocol === PROTOCOLS.MJSONWP
      ? '/execute'
      : '/execute/sync';
  return await (this.chromedriver as Chromedriver).jwproxy.command(endpoint, 'POST', {
    script,
    args,
  });
}

// #region Internal Helpers

/**
 * Massages the arguments going into an execute method.
 *
 * @param args Optional arguments to preprocess.
 * @returns Preprocessed arguments as a StringRecord.
 */
function preprocessExecuteMethodArgs(args?: ExecuteMethodArgs): StringRecord {
  const executeMethodArgs = (_.isArray(args) ? _.first(args) : args) ?? {} as StringRecord;

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
      executeMethodArgs.elementId as Element | string,
    );
  }

  return executeMethodArgs;
}

// #endregion

type ExecuteMethodArgs = readonly any[] | readonly [StringRecord] | Readonly<StringRecord>;

