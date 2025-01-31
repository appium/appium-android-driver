const RESPONSE_PATTERN = /:\s+(\w+)/;

/**
 * Set the Ui appearance.
 *
 * @since Android 10
 * @this {import('../driver').AndroidDriver}
 * @param {string} mode The UI mode to set the value for.
 * Supported values are: 'night' and 'car'
 * @param {string} value The actual mode value to set.
 * Supported value for different UI modes are:
 * - night: yes|no|auto|custom_schedule|custom_bedtime
 * - car: yes|no
 * @returns {Promise<void>}
 */
export async function mobileSetUiMode(mode, value) {
  await this.adb.shell(['cmd', 'uimode', mode, value]);
}

/**
 * Get the Ui appearance.
 *
 * @since Android 10
 * @this {import('../driver').AndroidDriver}
 * @param {string} mode The UI mode to set the value for.
 * Supported values are: 'night' and 'car'
 * @returns {Promise<string>} The actual state for the queried UI mode,
 * for example 'yes' or 'no'
 */
export async function mobileGetUiMode(mode) {
  const response = await this.adb.shell(['cmd', 'uimode', mode]);
  // response looks like 'Night mode: no'
  const match = RESPONSE_PATTERN.exec(response);
  if (!match) {
    throw new Error(`Cannot parse the command response: ${response}`);
  }
  return match[1];
}
