import path from 'node:path';
import _ from 'lodash';
import {fs, util} from '@appium/support';

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

  if (!this.apkStrings[language]) {
    this.apkStrings[language] = await extractStringsFromResources.bind(this)(language);
  }
  const mapping = JSON.parse(await fs.readFile(this.apkStrings[language], 'utf-8'));
  return preprocessStringsMap(mapping);
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
 * @returns {Promise<string>};
 */
async function extractStringsFromResources(language, opts = null) {
  const caps = opts ?? this.opts;

  /** @type {string|undefined} */
  let app;
  try {
    app = caps.app || (caps.appPackage && caps.tmpDir && await this.adb.pullApk(caps.appPackage, caps.tmpDir));
  } catch (err) {
    throw new Error(
      `Failed to pull an apk from '${caps.appPackage}' to '${caps.tmpDir}'. Original error: ${
        err.message
      }`
    );
  }

  if (!app || !(await fs.exists(app))) {
    throw new Error(`Could not extract app strings, no app or package specified`);
  }

  const stringsTmpDir = path.resolve(String(caps.tmpDir), util.uuidV4());
  try {
    this.log.debug(
      `Extracting strings from '${app}' for the language '${language || 'default'}' into '${stringsTmpDir}'`
    );
    const {localPath} = await this.adb.extractStringsFromApk(
      app,
      language ?? null,
      stringsTmpDir
    );
    return localPath;
  } catch (err) {
    throw new Error(`Could not extract app strings. Original error: ${err.message}`);
  }
}

// #endregion

/**
 * @typedef {import('appium-adb').ADB} ADB
 */
