import _ from 'lodash';
import {fs, tempDir} from '@appium/support';

/**
 * @this {import('../driver').AndroidDriver}
 * @param {string?} [language=null]
 * @returns {Promise<import('@appium/types').StringRecord>}}
 */
export async function getStrings(language = null) {
  if (!language) {
    language = await this.adb.getDeviceLanguage();
    this.log.info(`No language specified, returning strings for: ${language}`);
  }

  // Clients require the resulting mapping to have both keys
  // and values of type string
  /** @param {import('@appium/types').StringRecord} mapping */
  const preprocessStringsMap = (mapping) => {
    /** @type {import('@appium/types').StringRecord} */
    const result = {};
    for (const [key, value] of _.toPairs(mapping)) {
      result[key] = _.isString(value) ? value : JSON.stringify(value);
    }
    return result;
  };

  return preprocessStringsMap(await extractStringsFromResources.bind(this)(language));
}

/**
 * @this {import('../driver').AndroidDriver}
 * @param {string} language
 * @param {string} country
 * @param {string} [script]
 * @returns {Promise<void>}}
 */
export async function ensureDeviceLocale(language, country, script) {
  await this.settingsApp.setDeviceLocale(language, country, script);

  if (!(await this.adb.ensureCurrentLocale(language, country, script))) {
    const message = script
      ? `language: ${language}, country: ${country} and script: ${script}`
      : `language: ${language} and country: ${country}`;
    throw new Error(`Failed to set ${message}`);
  }
}

// #region Internal helpers

/**
 * @this {import('../driver').AndroidDriver}
 * @param {string?} [language]
 * @param {import('../driver').AndroidDriverOpts?} [opts=null]
 * @returns {Promise<import('@appium/types').StringRecord>};
 */
async function extractStringsFromResources(language, opts = null) {
  const caps = opts ?? this.opts;

  /** @type {string|undefined} */
  let app = caps.app;
  let tmpRoot;
  try {
    if (!app && caps.appPackage) {
      tmpRoot = await tempDir.openDir();
      try {
        app = await this.adb.pullApk(caps.appPackage, tmpRoot);
      } catch (e) {
        throw new Error(
          `Could not extract app strings, failed to pull an apk from '${caps.appPackage}'. Original error: ${e.message}`,
        );
      }
    }

    if (!app || !(await fs.exists(app))) {
      throw new Error(`Could not extract app strings, no app or package specified`);
    }

    return (await this.adb.extractStringsFromApk(app, language ?? null)).apkStrings;
  } finally {
    if (tmpRoot) {
      await fs.rimraf(tmpRoot);
    }
  }
}

// #endregion

/**
 * @typedef {import('appium-adb').ADB} ADB
 */
