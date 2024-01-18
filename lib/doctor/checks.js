import {resolveExecutablePath} from './utils';
import {system, fs, doctor} from '@appium/support';
import path from 'path';
import '@colors/colors';
import {getAndroidBinaryPath, getSdkRootFromEnv} from 'appium-adb';

const JAVA_HOME_VAR_NAME = system.isWindows() ? '%JAVA_HOME%' : '$JAVA_HOME';
const ENVIRONMENT_VARS_TUTORIAL_URL =
  'https://github.com/appium/java-client/blob/master/docs/environment.md';
const JAVA_HOME_TUTORIAL =
  'https://docs.oracle.com/cd/E21454_01/html/821-2531/inst_jdk_javahome_t.html';
const ANDROID_SDK_LINK1 = 'https://developer.android.com/studio#cmdline-tools';
const ANDROID_SDK_LINK2 = 'https://developer.android.com/studio/intro/update#sdk-manager';
const BUNDLETOOL_RELEASES_LINK = 'https://github.com/google/bundletool/releases/';
const GSTREAMER_INSTALL_LINK =
  'https://gstreamer.freedesktop.org/documentation/installing/index.html?gi-language=c';
const FFMPEG_INSTALL_LINK = 'https://www.ffmpeg.org/download.html';

/**
 * @typedef EnvVarCheckOptions
 * @property {boolean} [expectDir] If set to true then
 * the path is expected to be a valid folder
 * @property {boolean} [expectFile] If set to true then
 * the path is expected to be a valid file
 */

/** @satisfies {import('@appium/types').IDoctorCheck} */
class EnvVarAndPathCheck {
  /**
   * @param {string} varName
   * @param {EnvVarCheckOptions} [opts={}]
   */
  constructor(varName, opts = {}) {
    this.varName = varName;
    this.opts = opts;
  }

  async diagnose() {
    const varValue = process.env[this.varName];
    if (!varValue) {
      return doctor.nok(`${this.varName} environment variable is NOT set!`);
    }

    if (!(await fs.exists(varValue))) {
      let errMsg = `${this.varName} is set to '${varValue}' but this path does not exist!`;
      if (system.isWindows() && varValue.includes('%')) {
        errMsg += ` Consider replacing all references to other environment variables with absolute paths.`;
      }
      return doctor.nok(errMsg);
    }

    const stat = await fs.stat(varValue);
    if (this.opts.expectDir && !stat.isDirectory()) {
      return doctor.nok(
        `${this.varName} is expected to be a valid folder, got a file path instead`,
      );
    }
    if (this.opts.expectFile && stat.isDirectory()) {
      return doctor.nok(
        `${this.varName} is expected to be a valid file, got a folder path instead`,
      );
    }

    return doctor.ok(`${this.varName} is set to: ${varValue}`);
  }

  async fix() {
    return (
      `Make sure the environment variable ${this.varName.bold} is properly configured for the Appium process. ` +
      `Refer ${ENVIRONMENT_VARS_TUTORIAL_URL} for more details.`
    );
  }

  hasAutofix() {
    return false;
  }

  isOptional() {
    return false;
  }
}
export const androidHomeCheck = new EnvVarAndPathCheck('ANDROID_HOME', {expectDir: true});
export const javaHomeCheck = new EnvVarAndPathCheck('JAVA_HOME', {expectDir: true});

/** @satisfies {import('@appium/types').IDoctorCheck} */
export class JavaHomeValueCheck {
  async diagnose() {
    const envVar = process.env.JAVA_HOME;
    if (!envVar) {
      return doctor.nok(`${JAVA_HOME_VAR_NAME} environment variable must be set`);
    }

    const javaBinaryRelativePath = path.join('bin', `java${system.isWindows() ? '.exe' : ''}`);
    const javaBinary = path.join(envVar, javaBinaryRelativePath);
    if (!(await fs.exists(javaBinary))) {
      return doctor.nok(
        `${JAVA_HOME_VAR_NAME} is set to an invalid value. ` +
          `It must be pointing to a folder containing ${javaBinaryRelativePath}`,
      );
    }
    return doctor.ok(`'${javaBinaryRelativePath}' exists under '${envVar}'`);
  }

  async fix() {
    return (
      `Set ${JAVA_HOME_VAR_NAME} environment variable to the root folder path of your local JDK installation. ` +
      `Read ${JAVA_HOME_TUTORIAL}`
    );
  }

  hasAutofix() {
    return false;
  }

  isOptional() {
    return false;
  }
}
export const javaHomeValueCheck = new JavaHomeValueCheck();

/** @satisfies {import('@appium/types').IDoctorCheck} */
export class AndroidSdkCheck {
  /** @type {import('@appium/types').AppiumLogger} */
  log;

  TOOL_NAMES = ['adb', 'emulator', `apkanalyzer${system.isWindows() ? '.bat' : ''}`];

  async diagnose() {
    const listOfTools = this.TOOL_NAMES.join(', ');
    const sdkRoot = getSdkRootFromEnv();
    if (!sdkRoot) {
      return doctor.nok(`${listOfTools} could not be found because ANDROID_HOME is NOT set!`);
    }

    this.log.info(`   Checking ${listOfTools}`);
    const missingBinaries = [];
    for (const binary of this.TOOL_NAMES) {
      try {
        this.log.info(`     '${binary}' exists in ${await getAndroidBinaryPath(binary)}`);
      } catch (e) {
        missingBinaries.push(binary);
      }
    }

    if (missingBinaries.length > 0) {
      return doctor.nok(`${missingBinaries.join(', ')} could NOT be found in '${sdkRoot}'!`);
    }

    return doctor.ok(`${listOfTools} exist in '${sdkRoot}'`);
  }

  async fix() {
    return (
      `Manually install ${'Android SDK'.bold} and set ${'ANDROID_HOME'.bold}. ` +
      `Read ${[ANDROID_SDK_LINK1, ANDROID_SDK_LINK2].join(' and ')}.`
    );
  }

  hasAutofix() {
    return false;
  }

  isOptional() {
    return false;
  }
}
export const androidSdkCheck = new AndroidSdkCheck();

/** @satisfies {import('@appium/types').IDoctorCheck} */
export class OptionalBundletoolCheck {
  async diagnose() {
    const bundletoolPath = await resolveExecutablePath('bundletool.jar');
    return bundletoolPath
      ? doctor.okOptional(`bundletool.jar is installed at: ${bundletoolPath}`)
      : doctor.nokOptional('bundletool.jar cannot be found');
  }

  async fix() {
    return (
      `${'bundletool.jar'.bold} is used to handle Android App bundles. ` +
      `Please download the binary from ${BUNDLETOOL_RELEASES_LINK} and store it ` +
      `to any folder listed in the PATH environment variable. Folders that ` +
      `are currently present in PATH: ${process.env.PATH}`
    );
  }

  hasAutofix() {
    return false;
  }

  isOptional() {
    return true;
  }
}
export const optionalBundletoolCheck = new OptionalBundletoolCheck();

/** @satisfies {import('@appium/types').IDoctorCheck} */
export class OptionalGstreamerCheck {
  GSTREAMER_BINARY = `gst-launch-1.0${system.isWindows() ? '.exe' : ''}`;
  GST_INSPECT_BINARY = `gst-inspect-1.0${system.isWindows() ? '.exe' : ''}`;

  async diagnose() {
    const gstreamerPath = await resolveExecutablePath(this.GSTREAMER_BINARY);
    const gstInspectPath = await resolveExecutablePath(this.GST_INSPECT_BINARY);

    return gstreamerPath && gstInspectPath
      ? doctor.okOptional(
          `${this.GSTREAMER_BINARY} and ${this.GST_INSPECT_BINARY} are installed at: ${gstreamerPath} and ${gstInspectPath}`,
        )
      : doctor.nokOptional(
          `${this.GSTREAMER_BINARY} and/or ${this.GST_INSPECT_BINARY} cannot be found`,
        );
  }

  async fix() {
    return (
      `${
        `${this.GSTREAMER_BINARY} and ${this.GST_INSPECT_BINARY}`.bold
      } are used to stream the screen of the device under test. ` +
      `Please read ${GSTREAMER_INSTALL_LINK}.`
    );
  }

  hasAutofix() {
    return false;
  }

  isOptional() {
    return true;
  }
}
export const optionalGstreamerCheck = new OptionalGstreamerCheck();

/** @satisfies {import('@appium/types').IDoctorCheck} */
export class OptionalFfmpegCheck {
  FFMPEG_BINARY = `ffmpeg${system.isWindows() ? '.exe' : ''}`;

  async diagnose() {
    const ffmpegPath = await resolveExecutablePath(this.FFMPEG_BINARY);

    return ffmpegPath
      ? doctor.okOptional(`${this.FFMPEG_BINARY} exists at '${ffmpegPath}'`)
      : doctor.nokOptional(`${this.FFMPEG_BINARY} cannot be found`);
  }

  async fix() {
    return (
      `${`${this.FFMPEG_BINARY}`.bold} is used to capture screen recordings from the device under test. ` +
      `Please read ${FFMPEG_INSTALL_LINK}.`
    );
  }

  hasAutofix() {
    return false;
  }

  isOptional() {
    return true;
  }
}
export const optionalFfmpegCheck = new OptionalFfmpegCheck();
