import { errors } from 'appium-base-driver';
import { sleep } from 'asyncbox';
import _ from 'lodash';

let commands = {}, helpers = {}, extensions = {};

commands.postDismissAlert = async function () {
  throw new errors.NotYetImplementedError();
};

const SUPPORTED_PERFORMANCE_DATA_TYPES = {
  'cpuinfo': 'the amount of cpu by user and kernel process - cpu information for applications on real devices and simulators',
  'memoryinfo': 'the amount of memory used by the process - memory information for applications on real devices and simulators',
  'batteryinfo': 'the remaining battery power - battery power information for applications on real devices and simulators',
  'networkinfo': 'the network statistics - network rx/tx information for applications on real devices and simulators'
};

commands.getPerformanceDataTypes = function () {
  return _.keys(SUPPORTED_PERFORMANCE_DATA_TYPES);
};

commands.getPerformanceData = async function (packageName, dataType, dataReadTimeout) {

  if (dataType === 'batteryinfo')
    return this.getBatteryInfo(dataReadTimeout);
  else if (dataType === 'cpuinfo')
    return this.getCPUInfo(packageName, dataReadTimeout);
  else if (dataType === 'memoryinfo')
    return this.getMemoryInfo(packageName, dataReadTimeout);
  else if (dataType === 'networkinfo')
    return this.getNetworkTrafficInfo(dataReadTimeout);
  else 
    throw new Error('No performance data of type \'' + dataType + '\' found.');
};

helpers.getCPUInfo = async function (packageName, dataReadTimeout) {
  let returnValue = [];
  returnValue[0] = ["user", "kernel"];

  let cmd, data, start, end, user, kernel;
  let loop = true;
  let tryCount = 0;
  cmd = ['dumpsys', 'cpuinfo', '|', 'grep', "\'" + packageName + "\'"];
    
  while ( loop === true ) {
      
    if (tryCount === (dataReadTimeout + 1) )
      throw new Error('No response received after ' + dataReadTimeout);
    else {
      ++ tryCount;
      data = await this.adb.shell(cmd);        
    }

    if (data !== "" && data !== undefined && data !== null){
      start = data.indexOf(":");  
      end   = data.indexOf("%", start+1);
      if (data.indexOf(":", start+1) > 0 && data.indexOf("faults", start+1) < 0)  
        start = data.indexOf(":", start+1);
      user = data.substring(start+1, end).trim();
      start = data.indexOf("+");
      end = data.indexOf("%", start+1);
      kernel = data.substring(start+1, end).trim();
            
      if (user !== "" && user !== undefined && user !== "nodex"){
        returnValue[1] = [user, kernel];
        return returnValue;
      }
    }
    await sleep(1000);
  }
};

helpers.getBatteryInfo = async function (dataReadTimeout) {
  let returnValue = [];
  returnValue[0] = ["power"];
  let cmd, data, start, end, power;
  let loop = true;
  let tryCount = 0;
  cmd = ['dumpsys', 'battery', '|', 'grep', "\'level\'"];

  while ( loop === true ) {
    if (tryCount === (dataReadTimeout + 1))
      throw new Error('No response received after ' + dataReadTimeout);
    else {
      ++ tryCount;
      data = await this.adb.shell(cmd);        
    }

    if (data !== "" && data !== undefined && data !== null){
      start = data.indexOf(":");
      end = data.length;
      power = data.substring(start+1, end).trim();

      if (power !== "" && power !== undefined && power !== "nodex"){
        returnValue[1] = [power];
        return returnValue;
      }            
    }
    await sleep(1000);
  }
};

helpers.getMemoryInfo = async function (packageName, dataReadTimeout) {
  let returnValue = [];
  returnValue[0] = ["totalPrivateDirty", "nativePrivateDirty", "dalvikPrivateDirty", "eglPrivateDirty", "glPrivateDirty", "totalPss", "nativePss", "dalvikPss", "eglPss", "glPss", "nativeHeapAllocatedSize", "nativeHeapSize"];
    
  let loop = true;
  let cmd, data, totalPrivateDirty, nativePrivateDirty, dalvikPrivateDirty, eglPrivateDirty, glPrivateDirty, totalPss, nativePss, dalvikPss, eglPss, glPss, nativeHeapSize, nativeHeapAllocatedSize;
  let tryCount = 0;
      
  cmd = ['dumpsys', 'meminfo', "\'" + packageName + "\'", '|', 'grep', '-E', "\'Native|Dalvik|EGL|GL|TOTAL\'"];

  while ( loop === true ) {    
    if (tryCount === (dataReadTimeout + 1))
      throw new Error('No response received after ' + dataReadTimeout);
    else {
      ++ tryCount;
      data = await this.adb.shell(cmd);        
    }
        
    if (data !== "" && data !== undefined && data !== null){
      let arrayList = data.split("\n");
      let arrayList2;  
      for (let i=0 ; i < arrayList.length ; i++){
        let testString = arrayList[i].replace(/\s/g, ","); // 문자열 끝 부분의 공백 제거
        testString = testString.replace(/,{1,}/g, ","); // 문자열 끝 부분의 공백 제거
        arrayList2 = testString.split(",");

        if ((arrayList2[0] === "Native" || arrayList2[1] === "Native") && (arrayList2[1] === "Heap" || arrayList2[2] === "Heap")){//native heap
          nativePrivateDirty = arrayList2[3] ;
          nativePss = arrayList2[2];
          nativeHeapAllocatedSize = arrayList2[6];
          nativeHeapSize = arrayList2[8];
        } else if ((arrayList2[0] === "Dalvik" || arrayList2[1] === "Dalvik") && (arrayList2[1] === "Heap" || arrayList2[2] === "Heap")) { //dalvik heap
          dalvikPrivateDirty = arrayList2[4];
          dalvikPss = arrayList2[3];
        } else if ( (arrayList2[0] === "Dalvik" || arrayList2[1] === "Dalvik") && (arrayList2[1] === "Other" || arrayList2[2] === "Other") ) ;//dalvik others
        else if ( (arrayList2[0] === "EGL" || arrayList2[1] === "EGL") && (arrayList2[1] === "mtrack" || arrayList2[2] === "mtrack") ){ //egl
          eglPrivateDirty = arrayList2[4];
          eglPss = arrayList2[3];
        } else if ( (arrayList2[0] === "GL" || arrayList2[1] === "GL") && (arrayList2[1] === "mtrack" || arrayList2[2] === "mtrack") ){ //gl
          glPrivateDirty = arrayList2[4];
          glPss = arrayList2[3];
        } else if ( arrayList2[0] === "TOTAL" || arrayList2[1] === "TOTAL" ){ //total
          totalPrivateDirty = arrayList2[3];
          totalPss = arrayList2[2];
        }
        
      }
        
      if (totalPrivateDirty !== "" && totalPrivateDirty !== undefined && totalPrivateDirty !== "nodex"){
        returnValue[1] = [totalPrivateDirty, nativePrivateDirty, dalvikPrivateDirty, eglPrivateDirty, glPrivateDirty, totalPss, nativePss, dalvikPss, eglPss, glPss, nativeHeapAllocatedSize, nativeHeapSize];
        return returnValue;
      }
    }
    await sleep(1000);
  }
};

helpers.getNetworkTrafficInfo = async function (dataReadTimeout) {
  let returnValue = [];
  let cmd, data, start, delimiter, end, pendingBytes, bucketDuration, bucketStart, activeTime, rxBytes, rxPackets, txBytes, txPackets, operations;
  let tryCount = 0;
  let loop = true;
  //bucketDuration = 0;

  cmd = ['dumpsys', 'netstats'];
  
  while ( loop ===  true ) {
      
    if (tryCount === (dataReadTimeout + 1))
      throw new Error('No response received after ' + dataReadTimeout);
    else {
      ++ tryCount;
      data = await this.adb.shell(cmd);        
    }

    if (data !== "" && data !== undefined && data !== null){
      let netVariables = [["bucketDuration", "bucketStart", "activeTime", "rxBytes", "rxPackets", "txBytes", "txPackets", "operations"], ["bucketDuration", "st", "activeTime", "rb", "rp", "tb", "tp", "op"]];
      let index = 0;
      let fromXtstats = data.indexOf("Xt stats:");
        
      start = data.indexOf("Pending bytes:", fromXtstats);
      delimiter = data.indexOf(":", start+1);
      end = data.indexOf("\n", delimiter+1);
      pendingBytes = data.substring(delimiter+1, end).trim();

      if (end > delimiter){
        start = data.indexOf("bucketDuration", end+1);
        delimiter = data.indexOf("=", start+1);
        end = data.indexOf("\n", delimiter+1);
        bucketDuration = data.substring(delimiter+1, end).trim();              
      }

      if (start >= 0){
        data = data.substring(end + 1, data.length);
        let arrayList = data.split("\n");
            
        if (arrayList.length > 0){
          start = -1;

          for (let j = 0 ; j < netVariables.length ; ++ j){
            start = arrayList[0].indexOf(netVariables[j][0]);
              
            if (start >= 0 ){
              index = j;
              returnValue[0] = [];

              for (let k = 0 ; k < netVariables[j].length ; ++ k)
                returnValue[0][k] = netVariables[j][k];
              break;
            }
          }
              
          let returnIndex = 1;
          for (let i=0 ; i < arrayList.length ; i++){

            data = arrayList[i];
            start = data.indexOf(netVariables[index][0]);

            if (start >= 0 ){

              delimiter = data.indexOf("=", start+1);
              end = data.indexOf(" ", delimiter+1);
              bucketStart = data.substring(delimiter+1, end).trim();     

              if (end > delimiter){
                start = data.indexOf(netVariables[index][1], end+1);
                if (start >= 0){
                  delimiter = data.indexOf("=", start+1);
                  end = data.indexOf(" ", delimiter+1);
                  activeTime = data.substring(delimiter+1, end).trim();              
                }
              }
                    
              if (end > delimiter){
                start = data.indexOf(netVariables[index][2], end+1);
                if (start >= 0){
                  delimiter = data.indexOf("=", start+1);
                  end = data.indexOf(" ", delimiter+1);
                  rxBytes = data.substring(delimiter+1, end).trim(); 
                }             
              }
                    
              if (end > delimiter){
                start = data.indexOf(netVariables[index][3], end+1);
                if (start >= 0){
                  delimiter = data.indexOf("=", start+1);
                  end = data.indexOf(" ", delimiter+1);
                  rxPackets = data.substring(delimiter+1, end).trim(); 
                }             
              }
                    
              if (end > delimiter){
                start = data.indexOf(netVariables[index][4], end+1);
                if (start >= 0){
                  delimiter = data.indexOf("=", start+1);
                  end = data.indexOf(" ", delimiter+1);
                  txBytes = data.substring(delimiter+1, end).trim();   
                }           
              }
                    
              if (end > delimiter){
                start = data.indexOf(netVariables[index][5], end+1);
                if (start >= 0){
                  delimiter = data.indexOf("=", start+1);
                  end = data.indexOf(" ", delimiter+1);
                  txPackets = data.substring(delimiter+1, end).trim(); 
                }             
              }

              if (end > delimiter){
                start = data.indexOf(netVariables[index][6], end+1);
                if (start >= 0){
                  delimiter = data.indexOf("=", start+1);
                  end = data.length;
                  operations = data.substring(delimiter+1, end).trim(); 
                        
                }             
              }
              returnValue[returnIndex ++] = [bucketDuration, bucketStart, activeTime, rxBytes, rxPackets, txBytes, txPackets, operations];      
            }
          }
        }
        
      }

      if (pendingBytes !== "" && pendingBytes !== undefined && pendingBytes !== "nodex")
        return returnValue;
    }
    await sleep(1000);
  }
};

Object.assign(extensions, commands, helpers);
export { commands, helpers };
export default extensions;
