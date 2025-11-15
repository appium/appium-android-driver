import {ExecuteMethodMap} from '@appium/types';

const INTENT_PARAMS = [
  'user',
  'intent',
  'action',
  'package',
  'uri',
  'mimeType',
  'identifier',
  'component',
  'categories',
  'extras',
  'flags',
] as const;

export const executeMethodMap = {
  'mobile: shell': {
    command: 'mobileShell',
    params: {
      required: ['command'],
      optional: ['args', 'timeout', 'includeStderr'],
    },
  },

  'mobile: execEmuConsoleCommand': {
    command: 'mobileExecEmuConsoleCommand',
    params: {
      required: ['command'],
      optional: ['execTimeout', 'connTimeout', 'initTimeout'],
    },
  },

  'mobile: startLogsBroadcast': {
    command: 'mobileStartLogsBroadcast',
  },
  'mobile: stopLogsBroadcast': {
    command: 'mobileStopLogsBroadcast',
  },

  'mobile: changePermissions': {
    command: 'mobileChangePermissions',
    params: {
      required: ['permissions'],
      optional: ['appPackage', 'action', 'target'],
    },
  },
  'mobile: getPermissions': {
    command: 'mobileGetPermissions',
    params: {
      optional: ['type', 'appPackage'],
    },
  },

  'mobile: performEditorAction': {
    command: 'mobilePerformEditorAction',
    params: {
      required: ['action'],
    },
  },

  'mobile: getDeviceTime': {
    command: 'mobileGetDeviceTime',
    params: {
      optional: ['format'],
    },
  },

  'mobile: startScreenStreaming': {
    command: 'mobileStartScreenStreaming',
    params: {
      optional: [
        'width',
        'height',
        'bitRate',
        'host',
        'port',
        'pathname',
        'tcpPort',
        'quality',
        'considerRotation',
        'logPipelineDetails',
      ],
    },
  },
  'mobile: stopScreenStreaming': {
    command: 'mobileStopScreenStreaming',
  },

  'mobile: getNotifications': {
    command: 'mobileGetNotifications',
  },

  'mobile: listSms': {
    command: 'mobileListSms',
  },

  'mobile: pushFile': {
    command: 'pushFile',
    params: {
      required: ['remotePath', 'payload'],
    },
  },
  'mobile: pullFolder': {
    command: 'pullFolder',
    params: {
      required: ['remotePath'],
    },
  },
  'mobile: pullFile': {
    command: 'pullFile',
    params: {
      required: ['remotePath'],
    },
  },
  'mobile: deleteFile': {
    command: 'mobileDeleteFile',
    params: {
      required: ['remotePath'],
    },
  },

  'mobile: isAppInstalled': {
    command: 'mobileIsAppInstalled',
    params: {
      required: ['appId'],
      optional: ['user'],
    },
  },
  'mobile: queryAppState': {
    command: 'queryAppState',
    params: {
      required: ['appId'],
    },
  },
  'mobile: activateApp': {
    command: 'activateApp',
    params: {
      required: ['appId'],
    },
  },
  'mobile: removeApp': {
    command: 'mobileRemoveApp',
    params: {
      required: ['appId'],
      optional: ['timeout', 'keepData', 'skipInstallCheck'],
    },
  },
  'mobile: terminateApp': {
    command: 'mobileTerminateApp',
    params: {
      required: ['appId'],
      optional: ['timeout'],
    },
  },
  'mobile: installApp': {
    command: 'mobileInstallApp',
    params: {
      required: ['appPath'],
      optional: [
        'checkVersion',
        'timeout',
        'allowTestPackages',
        'useSdcard',
        'grantPermissions',
        'replace',
        'noIncremental',
      ],
    },
  },
  'mobile: clearApp': {
    command: 'mobileClearApp',
    params: {
      required: ['appId'],
    },
  },
  'mobile: backgroundApp': {
    command: 'mobileBackgroundApp',
    params: {
      optional: ['seconds'],
    }
  },
  'mobile: startService': {
    command: 'mobileStartService',
    params: {
      optional: [
        'foreground',
        ...INTENT_PARAMS,
      ],
    },
  },
  'mobile: stopService': {
    command: 'mobileStopService',
    params: {
      optional: [
        ...INTENT_PARAMS,
      ],
    },
  },
  'mobile: startActivity': {
    command: 'mobileStartActivity',
    params: {
      optional: [
        'wait',
        'stop',
        'windowingMode',
        'activityType',
        'display',
        ...INTENT_PARAMS,
      ],
    },
  },
  'mobile: broadcast': {
    command: 'mobileBroadcast',
    params: {
      optional: [
        'receiverPermission',
        'allowBackgroundActivityStarts',
        ...INTENT_PARAMS,
      ],
    },
  },

  'mobile: getContexts': {
    command: 'mobileGetContexts',
    params: {
      optional: [
        'waitForWebviewMs',
      ],
    },
  },

  'mobile: getChromeCapabilities': {
    command: 'mobileGetChromeCapabilities',
  },

  'mobile: lock': {
    command: 'lock',
    params: {
      optional: [
        'seconds',
      ],
    },
  },
  'mobile: unlock': {
    command: 'mobileUnlock',
    params: {
      optional: [
        'key',
        'type',
        'strategy',
        'timeoutMs',
      ],
    },
  },
  'mobile: isLocked': {
    command: 'isLocked',
  },

  'mobile: refreshGpsCache': {
    command: 'mobileRefreshGpsCache',
    params: {
      optional: [
        'timeoutMs',
      ],
    },
  },

  'mobile: startMediaProjectionRecording': {
    command: 'mobileStartMediaProjectionRecording',
    params: {
      optional: [
        'resolution',
        'priority',
        'maxDurationSec',
        'filename',
      ],
    },
  },
  'mobile: isMediaProjectionRecordingRunning': {
    command: 'mobileIsMediaProjectionRecordingRunning',
  },
  'mobile: stopMediaProjectionRecording': {
    command: 'mobileStopMediaProjectionRecording',
    params: {
      optional: [
        'remotePath',
        'user',
        'pass',
        'method',
        'headers',
        'fileFieldName',
        'formFields',
        'uploadTimeout',
      ],
    },
  },

  'mobile: getConnectivity': {
    command: 'mobileGetConnectivity',
    params: {
      optional: ['services'],
    }
  },
  'mobile: setConnectivity': {
    command: 'mobileSetConnectivity',
    params: {
      optional: ['wifi', 'data', 'airplaneMode'],
    }
  },

  'mobile: hideKeyboard': {
    command: 'hideKeyboard',
  },
  'mobile: isKeyboardShown': {
    command: 'isKeyboardShown',
  },

  'mobile: deviceidle': {
    command: 'mobileDeviceidle',
    params: {
      required: ['action'],
      optional: ['packages'],
    }
  },

  'mobile: bluetooth': {
    command: 'mobileBluetooth',
    params: {
      required: ['action'],
    }
  },
  'mobile: nfc': {
    command: 'mobileNfc',
    params: {
      required: ['action'],
    }
  },

  'mobile: setUiMode': {
    command: 'mobileSetUiMode',
    params: {
      required: ['mode', 'value'],
    }
  },
  'mobile: getUiMode': {
    command: 'mobileGetUiMode',
    params: {
      required: ['mode'],
    }
  },

  'mobile: injectEmulatorCameraImage': {
    command: 'mobileInjectEmulatorCameraImage',
    params: {
      required: ['payload'],
    }
  },

  'mobile: sendTrimMemory': {
    command: 'mobileSendTrimMemory',
    params: {
      required: ['pkg', 'level'],
    }
  },

  'mobile: getPerformanceData': {
    command: 'mobileGetPerformanceData',
    params: {
      required: ['packageName', 'dataType'],
    }
  },
  'mobile: getPerformanceDataTypes': {
    command: 'getPerformanceDataTypes',
  },

  'mobile: toggleGps': {
    command: 'toggleLocationServices',
  },
  'mobile: isGpsEnabled': {
    command: 'isLocationServicesEnabled',
  },

  'mobile: getDisplayDensity': {
    command: 'getDisplayDensity',
  },
  'mobile: getSystemBars': {
    command: 'getSystemBars',
  },
  'mobile: statusBar': {
    command: 'mobilePerformStatusBarCommand',
    params: {
      required: ['command'],
      optional: ['component'],
    }
  },

  'mobile: fingerprint': {
    command: 'mobileFingerprint',
    params: {
      required: ['fingerprintId'],
    }
  },
  'mobile: sendSms': {
    command: 'mobileSendSms',
    params: {
      required: ['phoneNumber', 'message'],
    }
  },
  'mobile: gsmCall': {
    command: 'mobileGsmCall',
    params: {
      required: ['phoneNumber', 'action'],
    }
  },
  'mobile: gsmSignal': {
    command: 'mobileGsmSignal',
    params: {
      required: ['strength'],
    }
  },
  'mobile: gsmVoice': {
    command: 'mobileGsmVoice',
    params: {
      required: ['state'],
    }
  },
  'mobile: powerAc': {
    command: 'mobilePowerAc',
    params: {
      required: ['state'],
    }
  },
  'mobile: powerCapacity': {
    command: 'mobilePowerCapacity',
    params: {
      required: ['percent'],
    }
  },
  'mobile: networkSpeed': {
    command: 'mobileNetworkSpeed',
    params: {
      required: ['speed'],
    }
  },
  'mobile: sensorSet': {
    command: 'sensorSet',
    params: {
      required: ['sensorType', 'value'],
    }
  },

  'mobile: getCurrentActivity': {
    command: 'getCurrentActivity',
  },
  'mobile: getCurrentPackage': {
    command: 'getCurrentPackage',
  },

  'mobile: setGeolocation': {
    command: 'mobileSetGeolocation',
    params: {
      required: ['latitude', 'longitude'],
      optional: ['altitude', 'satellites', 'speed', 'bearing', 'accuracy'],
    }
  },
  'mobile: getGeolocation': {
    command: 'mobileGetGeolocation',
  },
  'mobile: resetGeolocation': {
    command: 'mobileResetGeolocation',
  },

  'mobile: getAppStrings': {
    command: 'getStrings',
    params: {
      optional: ['language'],
    }
  },
} as const satisfies ExecuteMethodMap<any>;
