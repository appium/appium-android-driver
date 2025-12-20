import type {AndroidDriver} from '../driver';

const RESPONSE_PATTERN = /:\s+(\w+)/;

/**
 * Set the Ui appearance.
 *
 * @since Android 10
 * @param mode The UI mode to set the value for.
 * Supported values are: 'night' and 'car'
 * @param value The actual mode value to set.
 * Supported value for different UI modes are:
 * - night: yes|no|auto|custom_schedule|custom_bedtime
 * - car: yes|no
 * @returns Promise that resolves when the UI mode is set.
 */
export async function mobileSetUiMode(
  this: AndroidDriver,
  mode: string,
  value: string,
): Promise<void> {
  await this.adb.shell(['cmd', 'uimode', mode, value]);
}

/**
 * Get the Ui appearance.
 *
 * @since Android 10
 * @param mode The UI mode to get the value for.
 * Supported values are: 'night' and 'car'
 * @returns Promise that resolves to the actual state for the queried UI mode,
 * for example 'yes' or 'no'
 * @throws {Error} If the command response cannot be parsed.
 */
export async function mobileGetUiMode(
  this: AndroidDriver,
  mode: string,
): Promise<string> {
  const response = await this.adb.shell(['cmd', 'uimode', mode]);
  // response looks like 'Night mode: no'
  const match = RESPONSE_PATTERN.exec(response);
  if (!match) {
    throw new Error(`Cannot parse the command response: ${response}`);
  }
  return match[1];
}
