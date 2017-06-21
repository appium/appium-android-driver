import { retryInterval } from 'asyncbox';
import log from '../logger';

let commands = {}, extensions = {};


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
commands.startRecordingScreen = async function ( filePath, videoSize, timeLimit, bitRate ) {
  //this function is suppported on the device running android 4.4(api level 19)
  if (await this.adb.getApiLevel() < 19) {
    throw new Error('The screenrecord command is able to record the display of devices running Android 4.4 (API level 19) and higher.');
  }

  let fileExists;
  try {
    fileExists = await this.adb.fileExists(filePath);
  } catch (ign) {
    fileExists = false;
  }
  //if there's same file in the path, then thorws error
  if (fileExists) {
    throw new Error(`${filePath} is already exist.`);
  }

  //make adb command
  let cmd = ['screenrecord', `${filePath}`];
  if ( videoSize !== "default" ) {
    cmd.push('--size', videoSize);
  }
  if ( timeLimit !== -1 ) {
    cmd.push('--time-limit', timeLimit);
  }
  if ( bitRate !== -1 ) {
    cmd.push('--bit-rate', bitRate);
  }

  let err;
  //call the command asynchronously
  this.adb.shell(cmd).catch((e) => {
    err = e;
  });

  // there is the delay time to start recording the screen, so, wait until it is ready.
  // the ready condition is
  //   1. check the movie file is created
  //   2. check it is started to capture the screen
  await retryInterval(100, 1000, async () => {
    // check if the screen record command failed
    if (err) {
      return;
    }

    let lsData = await this.adb.shell(['ls', '-al', filePath]);

    // this is to get the file size from the result of the command(ls -al)
    // if the file size is bigger than 32 bytes, then it means that it starts to capture the screen
    let match = /[-rwxd]{10}\s*\S*\s*\S*\s*(\d*)\s*\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}\s[\S\.]*/.exec(lsData);
    if (match) {
      let size = parseInt(match[1], 10);
      if (size <= 32) {
        throw new Error(`File '${filePath}' exists but is not large enough (${size} bytes)`);
      }
    }
  });

  if (err) {
    log.errorAndThrow(`Unable to record screen: ${err.message}`);
  }
};

/**
* stop recording the screen.
*/
commands.stopRecordingScreen = async function ( ) {
  try {
    await this.adb.killProcessesByName('screenrecord');
  } catch (err) {
    log.errorAndThrow(`adb.killProcessesByName(screenrecord): ${err}`);
  }
};

Object.assign(extensions, commands);
export { commands };
export default extensions;
