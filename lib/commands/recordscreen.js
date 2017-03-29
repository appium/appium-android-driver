import _ from 'lodash';
import { sleep } from 'asyncbox';

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
  let cmd, data, length, indexNoSuchFile;
  let loop = true;

  data = await this.adb.getApiLevel();

  //this function is suppported on the device running android 4.4(api level 19)
  if (data < 19) throw new Error('The screenrecord command is able to record the display of devices running Android 4.4 (API level 19) and higher.');

  cmd = ['ls', `${filePath}`, '|', 'grep', 'No such file'];
  data = await this.adb.shell(cmd); 

  //if there's same file in the path, then thorws error
  if ( _.size(data) === 0) throw new Error(`${filePath} is already exist.`);


  //make adb command 
  cmd = ['screenrecord', `${filePath}`];

  if ( videoSize !== "default" ) {
    cmd.push('--size', videoSize);
  }  

  if ( timeLimit !== -1 ) {
    cmd.push('--time-limit', timeLimit);
  } 

  if ( bitRate !== -1 ) {
    cmd.push('--bit-rate', bitRate);
  } 

  //call the command asynchronously 
  data = this.adb.shell(cmd); 

  
  //there is the delay time to start recording the screen, so, wait until it is ready.
  //the ready condition is
  //1. check the movie file is created
  //2. check it is started to capture the screen 
  cmd = ['ls', '-al', `${filePath}`]; 
  while (loop) {
    data = await this.adb.shell(cmd); 
    indexNoSuchFile = data.indexOf("No such file");

    if (indexNoSuchFile < 0) {
      var result_ls_filePath_toArray = data.split(" ");
      length = _.size(result_ls_filePath_toArray);
      var availableDataIndex = 0;
      
      for (let i = 0 ; i < length ; ++ i){
        if ( _.size(result_ls_filePath_toArray[i]) > 0 ){
          availableDataIndex++;
          //check it is started to capture the screen
          if (availableDataIndex === 4){
            if ( (result_ls_filePath_toArray[i] * 1) > 32 )
              return;
          }
        }
      }
      await sleep(1000);
    } else
      await sleep(1000);
  } 
};

/**
* stop recording the screen.
*/
commands.stopRecordingScreen = async function ( ) {
  let cmd, data, length;
  let loop = true;
  
  //check the pid of the screenrecord process 
  cmd = ['ps', '|', 'grep', 'screenrecord'];
  data = await this.adb.shell(cmd); 

  if ( _.size(data) > 0){
    var result_ps_grep_screenrecord_toArray = data.split(" ");
    length = _.size(result_ps_grep_screenrecord_toArray);

    //kill the process and wait for that it is completed
    for (let i = 1 ; i < length ; ++ i){
      // if there is a screenrecord process running
      if ( _.size(result_ps_grep_screenrecord_toArray[i]) > 0 ){
        // get the process id 
        var screenrecordPID = result_ps_grep_screenrecord_toArray[i] * 1;

        while (loop) {
          cmd = ['kill', '-2', screenrecordPID];
          await this.adb.shell(cmd); 

          cmd = ['ps', '|', 'grep', 'screenrecord'];
          data = await this.adb.shell(cmd); 

          length = _.size(data);

          if (length === 0)
            return;
          else
            await sleep(1000);
        }
      }
    }
  } else 
    throw new Error('There is no screenrecord running');
};

Object.assign(extensions, commands);
export { commands };
export default extensions;
