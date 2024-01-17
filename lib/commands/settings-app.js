import { retryInterval } from 'asyncbox';
import {
  path as SETTINGS_APK_PATH,
  SETTINGS_HELPER_ID,
} from 'io.appium.settings';
import B from 'bluebird';

const HELPER_APP_INSTALL_RETRIES = 3;
const HELPER_APP_INSTALL_RETRY_DELAY_MS = 5000;

/**
 * @this {import('../driver').AndroidDriver}
 * @param {boolean} throwIfError
 * @returns {Promise<void>}
 */
export async function pushSettingsApp(throwIfError) {
  this.log.debug('Pushing settings apk to the device...');

  try {
      // Sometimes adb push or adb instal take more time than expected to install an app
      // e.g. https://github.com/appium/io.appium.settings/issues/40#issuecomment-476593174
      await retryInterval(
        HELPER_APP_INSTALL_RETRIES,
        HELPER_APP_INSTALL_RETRY_DELAY_MS,
        async () => await this.adb.installOrUpgrade(SETTINGS_APK_PATH, SETTINGS_HELPER_ID, {grantPermissions: true})
      );
  } catch (err) {
    if (throwIfError) {
      throw err;
    }

    this.log.warn(
      `Ignored error while installing '${SETTINGS_APK_PATH}': ` +
        `'${err.message}'. Features that rely on this helper ` +
        'require the apk such as toggle WiFi and getting location ' +
        'will raise an error if you try to use them.'
    );
  }

  // Reinstall would stop the settings helper process anyway, so
  // there is no need to continue if the application is still running
  if (await this.settingsApp.isRunningInForeground()) {
    this.log.debug(
      `${SETTINGS_HELPER_ID} is already running. ` +
        `There is no need to reset its permissions.`
    );
    return;
  }

  const fixSettingsAppPermissionsForLegacyApis = async () => {
    if (await this.adb.getApiLevel() > 23) {
      return;
    }

    // Android 6- devices should have granted permissions
    // https://github.com/appium/appium/pull/11640#issuecomment-438260477
    const perms = ['SET_ANIMATION_SCALE', 'CHANGE_CONFIGURATION', 'ACCESS_FINE_LOCATION'];
    this.log.info(`Granting permissions ${perms} to '${SETTINGS_HELPER_ID}'`);
    await this.adb.grantPermissions(
      SETTINGS_HELPER_ID,
      perms.map((x) => `android.permission.${x}`)
    );
  };

  try {
    await B.all([
      this.settingsApp.adjustNotificationsPermissions(),
      this.settingsApp.adjustMediaProjectionServicePermissions(),
      fixSettingsAppPermissionsForLegacyApis(),
    ]);
  } catch (e) {
    this.log.debug(e.stack);
  }

  // launch io.appium.settings app due to settings failing to be set
  // if the app is not launched prior to start the session on android 7+
  // see https://github.com/appium/appium/issues/8957
  try {
    await this.settingsApp.requireRunning({
      timeout: this.isEmulator() ? 30000 : 5000,
    });
  } catch (err) {
    this.log.debug(err.stack);
    if (throwIfError) {
      throw err;
    }
  }
}
