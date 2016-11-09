import _ from 'lodash';
import ADB from 'appium-adb';
import { retryInterval } from 'asyncbox';

let adb = new ADB();

let commands = {}, helpers = {}, extensions = {};

const NETWORK_KEYS = [['bucketStart', 'activeTime', 'rxBytes', 'rxPackets', 'txBytes', 'txPackets', 'operations', 'bucketDuration'], ['st', 'activeTime', 'rb', 'rp', 'tb', 'tp', 'op', 'bucketDuration']];
const CPU_KEYS = ['user', 'kernel'];
const BATTERY_KEYS = ['power'];
const MEMORY_KEYS = ['totalPrivateDirty', 'nativePrivateDirty', 'dalvikPrivateDirty', 'eglPrivateDirty', 'glPrivateDirty', 'totalPss', 'nativePss', 'dalvikPss', 'eglPss', 'glPss', 'nativeHeapAllocatedSize', 'nativeHeapSize'];
  
const SUPPORTED_PERFORMANCE_DATA_TYPES = {
  cpuinfo: 'the amount of cpu by user and kernel process - cpu information for applications on real devices and simulators',
  memoryinfo: 'the amount of memory used by the process - memory information for applications on real devices and simulators',
  batteryinfo: 'the remaining battery power - battery power information for applications on real devices and simulators',
  networkinfo: 'the network statistics - network rx/tx information for applications on real devices and simulators'
};

//
// returns the information type of the system state which is supported to read as like cpu, memory, network traffic, and battery.
// output - array like below
//[cpuinfo, batteryinfo, networkinfo, memoryinfo] 
//
commands.getPerformanceDataTypes = function () {
  return _.keys(SUPPORTED_PERFORMANCE_DATA_TYPES);
};

// returns the information type of the system state which is supported to read as like cpu, memory, network traffic, and battery.
//input - (packageName) the package name of the application 
//        (dataType) the type of system state which wants to read. It should be one of the keys of the SUPPORTED_PERFORMANCE_DATA_TYPES
//        (dataReadTimeout) the number of attempts to read
// output - table of the performance data, The first line of the table represents the type of data. The remaining lines represent the values of the data.
//
// in case of battery info : [[power], [23]]
// in case of memory info :  [[totalPrivateDirty, nativePrivateDirty, dalvikPrivateDirty, eglPrivateDirty, glPrivateDirty, totalPss, nativePss, dalvikPss, eglPss, glPss, nativeHeapAllocatedSize, nativeHeapSize], [18360, 8296, 6132, null, null, 42588, 8406, 7024, null, null, 26519, 10344]]
// in case of network info : [[bucketStart, activeTime, rxBytes, rxPackets, txBytes, txPackets, operations, bucketDuration,], [1478091600000, null, 1099075, 610947, 928, 114362, 769, 0, 3600000], [1478095200000, null, 1306300, 405997, 509, 46359, 370, 0, 3600000]]
// in case of network info : [[st, activeTime, rb, rp, tb, tp, op, bucketDuration], [1478088000, null, null, 32115296, 34291, 2956805, 25705, 0, 3600], [1478091600, null, null, 2714683, 11821, 1420564, 12650, 0, 3600], [1478095200, null, null, 10079213, 19962, 2487705, 20015, 0, 3600], [1478098800, null, null, 4444433, 10227, 1430356, 10493, 0, 3600]]
// in case of cpu info : [[user, kernel], [0.9, 1.3]]
//
commands.getPerformanceData = async function (packageName, dataType, dataReadTimeout) {

  if (_.isEqual(dataType, 'batteryinfo')) {
    return this.getBatteryInfo(dataReadTimeout);
  } else if (_.isEqual(dataType, 'cpuinfo')) {
    return this.getCPUInfo(packageName, dataReadTimeout);
  } else if (_.isEqual(dataType, 'memoryinfo')) {
    return this.getMemoryInfo(packageName, dataReadTimeout);
  } else if (_.isEqual(dataType, 'networkinfo')) {
    return this.getNetworkTrafficInfo(dataReadTimeout);
  } else {
    throw new Error('No performance data of type \'' + dataType + '\' found.');
  }
};

helpers.getCPUInfo = async function (packageName, dataReadTimeout) {
    
  //sometimes, the function of 'adb.shell' fails. when I tested this function on the target of 'Galaxy Note5', 
  //adb.shell(dumpsys cpuinfo) returns cpu datas for other application packages, but I can't find the data for packageName.
  //It usually fails 30 times and success for the next time,  
  //Since then, he has continued to succeed.
  return await retryInterval(dataReadTimeout, 1000, async () => {
    let cmd, data, start, end, user, kernel;

    cmd = ['dumpsys', 'cpuinfo', '|', 'grep', `'${packageName}'`];

    data = await adb.shell(cmd); 

    if (!_.isEqual(data, "") && !_.isUndefined(data) && !_.isNull(data) ){
      start = data.indexOf(":");
      end   = data.indexOf("%", start+1);
      if (data.indexOf(":", start+1) > 0 && data.indexOf("faults", start+1) < 0)  
        start = data.indexOf(":", start+1);
      user = data.substring(start+1, end).trim();
      start = data.indexOf("+");
      end = data.indexOf("%", start+1);
      kernel = data.substring(start+1, end).trim();
            
      if ( !_.isEqual(user, "") && !_.isUndefined(user) && !_.isEqual(user, "nodex" )){
        let returnValue = [];
        returnValue[0] = [];
        for (let k = 0 ; k < CPU_KEYS.length ; ++ k)
          returnValue[0][k] = CPU_KEYS[k];
        returnValue[1] = [user, kernel];
        return returnValue;
      }
    }

  });

};

helpers.getBatteryInfo = async function (dataReadTimeout) {

  return await retryInterval(dataReadTimeout, 10000, async () => {
    let start, end, power;

    let cmd = ['dumpsys', 'battery', '|', 'grep', "\'level\'"];

    let data = await adb.shell(cmd);

    if (!_.isEqual(data, "") && !_.isUndefined(data) && !_.isNull(data)){
      start = data.indexOf(":");
      end = _.size(data);
      power = data.substring(start+1, end).trim();

      if ( !_.isEqual(power, "") && !_.isUndefined(power) && !_.isEqual(power, "nodex")){
        let returnValue = [];
        returnValue[0] = [];        
        for (let k = 0 ; k < BATTERY_KEYS.length ; ++ k)
          returnValue[0][k] = BATTERY_KEYS[k];
        returnValue[1] = [power];
        return returnValue;
      }            
    }
  });

};

helpers.getMemoryInfo = async function (packageName, dataReadTimeout) {

  return await retryInterval(dataReadTimeout, 1000, async () => {
      
    let cmd, data, totalPrivateDirty, nativePrivateDirty, dalvikPrivateDirty, eglPrivateDirty, glPrivateDirty, totalPss, nativePss, dalvikPss, eglPss, glPss, nativeHeapSize, nativeHeapAllocatedSize;

    cmd = ['dumpsys', 'meminfo', `'${packageName}'`, '|', 'grep', '-E', "\'Native|Dalvik|EGL|GL|TOTAL\'"];
    data = await adb.shell(cmd);

    if (!_.isEqual(data, "") && !_.isUndefined(data) && !_.isNull(data)){
      let arrayList = data.split("\n");
      let arrayList2;  
      for (let i=0 ; i < arrayList.length ; i++){
        let testString = arrayList[i].replace(/\s/g, ","); // remove spaces at the end of the string
        testString = testString.replace(/,{1,}/g, ","); // remove spaces at the end of the string
        arrayList2 = testString.split(",");

        if ( (_.isEqual(arrayList2[0], "Native") || _.isEqual(arrayList2[0], "Native")) && (_.isEqual(arrayList2[1], "Heap") || _.isEqual(arrayList2[2], "Heap")) ){//native heap
          nativePrivateDirty = arrayList2[3] ;
          nativePss = arrayList2[2];
          nativeHeapAllocatedSize = arrayList2[6];
          nativeHeapSize = arrayList2[8];
        } else if ( (_.isEqual(arrayList2[0], "Dalvik") || _.isEqual(arrayList2[1], "Dalvik")) && (_.isEqual(arrayList2[1], "Heap") || _.isEqual(arrayList2[2], "Heap")) ){ //dalvik heap
          dalvikPrivateDirty = arrayList2[4];
          dalvikPss = arrayList2[3];
        } else if ( (_.isEqual(arrayList2[0], "Dalvik") || _.isEqual(arrayList2[1], "Dalvik")) && (_.isEqual(arrayList2[1], "Other") || _.isEqual(arrayList2[2], "Other")) ){//dalvik others
        } else if ( (_.isEqual(arrayList2[0], "EGL") || _.isEqual(arrayList2[1], "EGL")) && (_.isEqual(arrayList2[1], "mtrack") || _.isEqual(arrayList2[2], "mtrack")) ){ //egl
          eglPrivateDirty = arrayList2[4];
          eglPss = arrayList2[3];
        } else if ( (_.isEqual(arrayList2[0], "GL") || _.isEqual(arrayList2[1], "GL")) && (_.isEqual(arrayList2[1], "mtrack") || _.isEqual(arrayList2[2], "mtrack")) ){ //gl
          glPrivateDirty = arrayList2[4];
          glPss = arrayList2[3];
        } else if ( _.isEqual(arrayList2[0], "TOTAL") || _.isEqual(arrayList2[1], "TOTAL") ){ //total
          totalPrivateDirty = arrayList2[3];
          totalPss = arrayList2[2];
        }
        
      }
        
      if ( !_.isEqual(totalPrivateDirty, "") && !_.isUndefined(totalPrivateDirty) && !_.isEqual(totalPrivateDirty, "nodex") ){
        let returnValue = [];
        returnValue[0] = [];
        for (let k = 0 ; k < MEMORY_KEYS.length ; ++ k)
          returnValue[0][k] = MEMORY_KEYS[k];
        returnValue[1] = [totalPrivateDirty, nativePrivateDirty, dalvikPrivateDirty, eglPrivateDirty, glPrivateDirty, totalPss, nativePss, dalvikPss, eglPss, glPss, nativeHeapAllocatedSize, nativeHeapSize];
        return returnValue;
      }
    }

  });

};

helpers.getNetworkTrafficInfo = async function (dataReadTimeout) {

  return await retryInterval(dataReadTimeout, 1000, async () => {
    
    let returnValue = [];
    let cmd, data, start, delimiter, end, pendingBytes, bucketDuration, bucketStart, activeTime, rxBytes, rxPackets, txBytes, txPackets, operations;  

    cmd = ['dumpsys', 'netstats'];

    data = await adb.shell(cmd);

    if ( !_.isEqual(data, "") && !_.isUndefined(data) && !_.isNull(data) ){
      //In case of network traffic information, it is different for the return data between emulator and real device.
      //the return data of emulator
      //Xt stats:
      //Pending bytes: 39250
      //History since boot:
      //ident=[[type=WIFI, subType=COMBINED, networkId="WiredSSID"]] uid=-1 set=ALL tag=0x0
      //NetworkStatsHistory: bucketDuration=3600000
      //bucketStart=1478098800000 activeTime=31824 rxBytes=21502 rxPackets=78 txBytes=17748 txPackets=90 operations=0
      //the return data of real device
      //
      //the return data of real device
      //Xt stats:
      //Pending bytes: 0
      //History since boot:
      //ident=[{type=MOBILE, subType=COMBINED, subscriberId=450050...}] uid=-1 set=ALL tag=0x0
      //NetworkStatsHistory: bucketDuration=3600
      //st=1478088000 rb=32115296 rp=34291 tb=2956805 tp=25705 op=0
      //st=1478091600 rb=2714683 rp=11821 tb=1420564 tp=12650 op=0
      //st=1478095200 rb=10079213 rp=19962 tb=2487705 tp=20015 op=0
      //st=1478098800 rb=4444433 rp=10227 tb=1430356 tp=10493 op=0
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

          for (let j = 0 ; j < NETWORK_KEYS.length ; ++ j){
            start = arrayList[0].indexOf(NETWORK_KEYS[j][0]);
              
            if (start >= 0 ){
              index = j;
              returnValue[0] = [];

              for (let k = 0 ; k < NETWORK_KEYS[j].length ; ++ k)
                returnValue[0][k] = NETWORK_KEYS[j][k];
              break;
            }
          }
              
          let returnIndex = 1;
          for (let i=0 ; i < arrayList.length ; i++){

            data = arrayList[i];
            start = data.indexOf(NETWORK_KEYS[index][0]);

            if (start >= 0 ){

              delimiter = data.indexOf("=", start+1);
              end = data.indexOf(" ", delimiter+1);
              bucketStart = data.substring(delimiter+1, end).trim();     

              if (end > delimiter){
                start = data.indexOf(NETWORK_KEYS[index][1], end+1);
                if (start >= 0){
                  delimiter = data.indexOf("=", start+1);
                  end = data.indexOf(" ", delimiter+1);
                  activeTime = data.substring(delimiter+1, end).trim();              
                }
              }
                    
              if (end > delimiter){
                start = data.indexOf(NETWORK_KEYS[index][2], end+1);
                if (start >= 0){
                  delimiter = data.indexOf("=", start+1);
                  end = data.indexOf(" ", delimiter+1);
                  rxBytes = data.substring(delimiter+1, end).trim(); 
                }             
              }
                    
              if (end > delimiter){
                start = data.indexOf(NETWORK_KEYS[index][3], end+1);
                if (start >= 0){
                  delimiter = data.indexOf("=", start+1);
                  end = data.indexOf(" ", delimiter+1);
                  rxPackets = data.substring(delimiter+1, end).trim(); 
                }             
              }
                    
              if (end > delimiter){
                start = data.indexOf(NETWORK_KEYS[index][4], end+1);
                if (start >= 0){
                  delimiter = data.indexOf("=", start+1);
                  end = data.indexOf(" ", delimiter+1);
                  txBytes = data.substring(delimiter+1, end).trim();   
                }           
              }
                    
              if (end > delimiter){
                start = data.indexOf(NETWORK_KEYS[index][5], end+1);
                if (start >= 0){
                  delimiter = data.indexOf("=", start+1);
                  end = data.indexOf(" ", delimiter+1);
                  txPackets = data.substring(delimiter+1, end).trim(); 
                }             
              }

              if (end > delimiter){
                start = data.indexOf(NETWORK_KEYS[index][6], end+1);
                if (start >= 0){
                  delimiter = data.indexOf("=", start+1);
                  end = data.length;
                  operations = data.substring(delimiter+1, end).trim(); 
                        
                }             
              }
              returnValue[returnIndex ++] = [bucketStart, activeTime, rxBytes, rxPackets, txBytes, txPackets, operations, bucketDuration];      
            }
          }
        }
        
      }

      if ( !_.isEqual(pendingBytes, "") && !_.isUndefined(pendingBytes) && !_.isEqual(pendingBytes, "nodex") )
        return returnValue;
    }
  
  });

};

Object.assign(extensions, commands, helpers);
export { commands, helpers };
export default extensions;
