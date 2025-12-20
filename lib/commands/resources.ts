import _ from 'lodash';
import {fs, tempDir} from '@appium/support';
import type {StringRecord} from '@appium/types';
import type {AndroidDriver, AndroidDriverOpts} from '../driver';
import type {Locale} from './types';

/**
 * Gets the localized strings from the application.
 *
 * @param language The language code to retrieve strings for. If not provided,
 * the device's current language will be used.
 * @returns Promise that resolves to a mapping of string keys to their localized values.
 */
export async function getStrings(
  this: AndroidDriver,
  language: string | null = null,
): Promise<StringRecord> {
  if (!language) {
    language = await this.adb.getDeviceLanguage();
    this.log.info(`No language specified, returning strings for: ${language}`);
  }

  // Clients require the resulting mapping to have both keys
  // and values of type string
  const preprocessStringsMap = (mapping: StringRecord): StringRecord => {
    const result: StringRecord = {};
    for (const [key, value] of _.toPairs(mapping)) {
      result[key] = _.isString(value) ? value : JSON.stringify(value);
    }
    return result;
  };

  return preprocessStringsMap(await extractStringsFromResources.bind(this)(language));
}

/**
 * Ensures the device locale is set to the specified language, country, and optional script.
 *
 * @param language The language code (e.g., 'en', 'fr').
 * @param country The country code (e.g., 'US', 'FR').
 * @param script Optional script code.
 * @returns Promise that resolves when the locale is set and verified.
 * @throws {Error} If the locale cannot be set or verified.
 */
export async function ensureDeviceLocale(
  this: AndroidDriver,
  language: string,
  country: string,
  script?: string,
): Promise<void> {
  try {
    await this.settingsApp.setDeviceLocale(language, country, script);

    if (!(await this.adb.ensureCurrentLocale(language, country, script))) {
      throw new Error('Locale verification has failed');
    }
  } catch (e) {
    this.log.debug((e as Error).stack);
    let errMsg = `Cannot set the device locale to '${toLocaleAbbr({language, country, script})}'.`;
    let suggestions: string[] = [];
    try {
      suggestions = (await fetchLocaleSuggestions.bind(this)(language, country)).map(toLocaleAbbr);
    } catch (e1) {
      this.log.debug((e1 as Error).stack);
    }
    if (!_.isEmpty(suggestions)) {
      errMsg += ` You may want to apply one of the following locales instead: ${suggestions}`;
    }
    throw new Error(errMsg);
  }
}

// #region Internal helpers

async function extractStringsFromResources(
  this: AndroidDriver,
  language: string | null,
  opts: AndroidDriverOpts | null = null,
): Promise<StringRecord> {
  const caps = opts ?? this.opts;

  let app: string | undefined = caps.app;
  let tmpRoot: string | undefined;
  try {
    if (!app && caps.appPackage) {
      tmpRoot = await tempDir.openDir();
      try {
        app = await this.adb.pullApk(caps.appPackage, tmpRoot);
      } catch (e) {
        throw new Error(
          `Could not extract app strings, failed to pull an apk from '${caps.appPackage}'. Original error: ${(e as Error).message}`,
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

async function fetchLocaleSuggestions(
  this: AndroidDriver,
  language?: string,
  country?: string,
): Promise<Locale[]> {
  const supportedLocales = await this.settingsApp.listSupportedLocales();
  const suggestedLocales = supportedLocales
    .filter((locale) =>
      _.toLower(language) === _.toLower(locale.language)
      || _.toLower(country) === _.toLower(locale.country)
    );
  return _.isEmpty(suggestedLocales) ? supportedLocales : suggestedLocales;
}

function toLocaleAbbr({language, country, script}: Locale): string {
  return `${language}_${country}${script ? ('-' + script) : ''}`;
}

// #endregion

