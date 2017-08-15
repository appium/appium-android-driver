import { retryInterval } from 'asyncbox';
import B from 'bluebird';
import { util } from 'appium-support';
import log from '../logger';


let commands = {}, extensions = {};

const RETRY_PAUSE = 1000;

/**
* record the display of devices running Android 4.4 (API level 19) and higher.
* It records screen activity to an MPEG-4 file. Audio is not recorded with the video file.
*
* @param filePath the video file name
*                 for example, "/sdcard/demo.mp4"
* @param videoSize the format is widthxheight.
*                  if it is "default", the default value is the device's native display resolution (if supported),
*                  1280x720 if not. For best results,
*                  use a size supported by your device's Advanced Video Coding (AVC) encoder.
*                  for example, "1280x720"
* @param timeLimit the maximum recording time, in seconds. if it is -1, the default and maximum value is 180 (3 minutes).
* @param bitRate the video bit rate for the video, in megabits per second.
*                if it is -1, the default value is 4Mbps. You can increase the bit rate to improve video quality,
*                but doing so results in larger movie files.
*                for example, 6000000
*
*/
commands.startRecordingScreen = async function (filePath, videoSize, timeLimit, bitRate) {
  if (this.isEmulator()) {
    throw new Error('Screen recording does not work on emulators');
  }

  // this function is suppported on the device running android 4.4(api level 19)
  let apiLevel = await this.adb.getApiLevel();
  if (apiLevel < 19) {
    throw new Error(`Screen recording not available on API Level ${apiLevel}. Minimum API Level is 19.`);
  }

  //if there's same file in the path, then thorws error
  if (await this.adb.fileExists(filePath)) {
    throw new Error(`Screen recording failed: '${filePath}' already exists.`);
  }


  //make adb command
  let cmd = ['screenrecord', filePath];
  if (util.hasValue(videoSize)) {
    cmd.push('--size', videoSize);
  }
  if (util.hasValue(timeLimit)) {
    cmd.push('--time-limit', timeLimit);
  }
  if (util.hasValue(bitRate)) {
    cmd.push('--bit-rate', bitRate);
  }

  // wrap in a manual Promise so we can handle errors in adb shell operation
  return await new B(async (resolve, reject) => {
    let err;
    log.debug(`Beginning screen recording with command: 'adb ${cmd.join(' ')}'`);
    // do not await here, as the call runs in the background and we check for its product
    this.adb.shell(cmd).catch((e) => {
      err = e;
    });

    // there is the delay time to start recording the screen, so, wait until it is ready.
    // the ready condition is
    //   1. check the movie file is created
    //   2. check it is started to capture the screen
    try {
      await retryInterval(10, RETRY_PAUSE, async () => {
        if (err) return; // eslint-disable-line curly

        let size = this.adb.fileSize(filePath);
        if (size <= 32) {
          throw new Error(`Remote file '${filePath}' found but it is still too small: ${size} bytes`);
        }
      });
    } catch (e) {
      err = e;
    }

    if (err) {
      log.error(`Error recording screen: err.message`);
      return reject(err);
    }
    resolve();
  });
};

/**
* stop recording the screen.
*/
commands.stopRecordingScreen = async function () {
  try {
    await this.adb.killProcessesByName('screenrecord');
  } catch (err) {
    log.errorAndThrow(`Unable to stop screen recording: ${err.message}`);
  }
};

Object.assign(extensions, commands);
export { commands };
export default extensions;
