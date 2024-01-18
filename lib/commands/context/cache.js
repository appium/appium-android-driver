import {LRUCache} from 'lru-cache';

/** @type {LRUCache<string, import('../types').WebViewDetails>} */
export const WEBVIEWS_DETAILS_CACHE = new LRUCache({
  max: 100,
  updateAgeOnGet: true,
});

/**
 *
 * @param {import('appium-adb').ADB} adb
 * @param {string} webview
 * @returns {string}
 */
export function toDetailsCacheKey(adb, webview) {
  return `${adb?.curDeviceId}:${webview}`;
}

/**
 * Retrieves web view details previously cached by `getWebviews` call
 *
 * @param {import('appium-adb').ADB} adb
 * @param {string} webview
 * @returns {import('../types').WebViewDetails | undefined}
 */
export function getWebviewDetails(adb, webview) {
  const key = toDetailsCacheKey(adb, webview);
  return WEBVIEWS_DETAILS_CACHE.get(key);
}
