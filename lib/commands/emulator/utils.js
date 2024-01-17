/**
 * @this {import('../../driver').AndroidDriver}
 * @param {string} errMsg
 */
export function requireEmulator(errMsg) {
  if (!this.isEmulator()) {
    this.log.errorAndThrow(errMsg);
  }
}

