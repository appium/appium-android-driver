import {LRUCache} from 'lru-cache';
import type {ADB} from 'appium-adb';
import type {WebViewDetails} from '../types';

export const WEBVIEWS_DETAILS_CACHE = new LRUCache<string, WebViewDetails>({
  max: 100,
  updateAgeOnGet: true,
});

/**
 * Generates a cache key for webview details based on the device ID and webview name.
 *
 * @param adb - The ADB instance (may be null/undefined)
 * @param webview - The webview name
 * @returns A cache key string in the format `deviceId:webview`
 */
export function toDetailsCacheKey(adb: ADB, webview: string): string {
  return `${adb?.curDeviceId}:${webview}`;
}

/**
 * Retrieves web view details previously cached by `getWebviews` call.
 *
 * @param adb - The ADB instance (may be null/undefined)
 * @param webview - The webview name
 * @returns The cached webview details, or undefined if not found
 */
export function getWebviewDetails(adb: ADB, webview: string): WebViewDetails | undefined {
  const key = toDetailsCacheKey(adb, webview);
  return WEBVIEWS_DETAILS_CACHE.get(key);
}

