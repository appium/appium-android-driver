import type { MethodMap } from '@appium/types';
import type { AndroidDriver } from './driver';

export const newMethodMap = {
  '/session/:sessionId/timeouts/implicit_wait': {
    POST: {
      command: 'implicitWait',
      payloadParams: {required: ['ms']},
      deprecated: true
    },
  },
  '/session/:sessionId/ime/available_engines': {GET: {command: 'availableIMEEngines'}},
  '/session/:sessionId/ime/active_engine': {GET: {command: 'getActiveIMEEngine'}},
  '/session/:sessionId/ime/activated': {GET: {command: 'isIMEActivated'}},
  '/session/:sessionId/ime/deactivate': {POST: {command: 'deactivateIMEEngine'}},
  '/session/:sessionId/ime/activate': {
    POST: {
      command: 'activateIMEEngine',
      payloadParams: {required: ['engine']},
    },
  },
  '/session/:sessionId/window/:windowhandle/size': {
    GET: {
      command: 'getWindowSize',
      deprecated: true
    }
  },
  '/session/:sessionId/keys': {
    POST: {
      command: 'keys',
      payloadParams: {required: ['value']},
      deprecated: true
    },
  },
  '/session/:sessionId/element/:elementId/location': {
    GET: {
      command: 'getLocation',
      deprecated: true
    }
  },
  '/session/:sessionId/element/:elementId/location_in_view': {
    GET: {
      command: 'getLocationInView',
      deprecated: true
    }
  },
  '/session/:sessionId/element/:elementId/size': {
    GET: {
      command: 'getSize',
      deprecated: true
    }
  },
  '/session/:sessionId/appium/device/lock': {
    POST: {
      command: 'lock',
      payloadParams: {optional: ['seconds']},
      deprecated: true
    },
  },
  '/session/:sessionId/appium/device/unlock': {
    POST: {
      command: 'unlock',
      deprecated: true
    }
  },
  '/session/:sessionId/appium/device/is_locked': {
    POST: {
      command: 'isLocked',
      deprecated: true
    }
  },
  '/session/:sessionId/appium/start_recording_screen': {
    POST: {
      command: 'startRecordingScreen',
      payloadParams: {optional: ['options']},
    },
  },
  '/session/:sessionId/appium/stop_recording_screen': {
    POST: {
      command: 'stopRecordingScreen',
      payloadParams: {optional: ['options']},
    },
  },
  '/session/:sessionId/appium/performanceData/types': {
    POST: {
      command: 'getPerformanceDataTypes',
      deprecated: true
    }
  },
  '/session/:sessionId/appium/getPerformanceData': {
    POST: {
      command: 'getPerformanceData',
      payloadParams: {
        required: ['packageName', 'dataType'],
        optional: ['dataReadTimeout'],
      },
      deprecated: true
    },
  },
  '/session/:sessionId/appium/device/press_keycode': {
    POST: {
      command: 'pressKeyCode',
      payloadParams: {required: ['keycode'], optional: ['metastate', 'flags']},
      deprecated: true
    },
  },
  '/session/:sessionId/appium/device/long_press_keycode': {
    POST: {
      command: 'longPressKeyCode',
      payloadParams: {required: ['keycode'], optional: ['metastate', 'flags']},
      deprecated: true
    },
  },
  '/session/:sessionId/appium/device/finger_print': {
    POST: {
      command: 'fingerprint',
      payloadParams: {required: ['fingerprintId']},
      deprecated: true
    },
  },
  '/session/:sessionId/appium/device/send_sms': {
    POST: {
      command: 'sendSMS',
      payloadParams: {required: ['phoneNumber', 'message']},
      deprecated: true
    },
  },
  '/session/:sessionId/appium/device/gsm_call': {
    POST: {
      command: 'gsmCall',
      payloadParams: {required: ['phoneNumber', 'action']},
      deprecated: true
    },
  },
  '/session/:sessionId/appium/device/gsm_signal': {
    POST: {
      command: 'gsmSignal',
      payloadParams: {required: ['signalStrength']},
      deprecated: true
    },
  },
  '/session/:sessionId/appium/device/gsm_voice': {
    POST: {
      command: 'gsmVoice',
      payloadParams: {required: ['state']},
      deprecated: true
    },
  },
  '/session/:sessionId/appium/device/power_capacity': {
    POST: {
      command: 'powerCapacity',
      payloadParams: {required: ['percent']},
      deprecated: true
    },
  },
  '/session/:sessionId/appium/device/power_ac': {
    POST: {
      command: 'powerAC',
      payloadParams: {required: ['state']},
      deprecated: true
    },
  },
  '/session/:sessionId/appium/device/network_speed': {
    POST: {
      command: 'networkSpeed',
      payloadParams: {required: ['netspeed']},
      deprecated: true
    },
  },
  '/session/:sessionId/appium/device/keyevent': {
    POST: {
      command: 'keyevent',
      payloadParams: {required: ['keycode'], optional: ['metastate']},
      deprecated: true
    },
  },
  '/session/:sessionId/appium/device/current_activity': {
    GET: {
      command: 'getCurrentActivity',
      deprecated: true
    }
  },
  '/session/:sessionId/appium/device/current_package': {
    GET: {
      command: 'getCurrentPackage',
      deprecated: true
    }
  },
  '/session/:sessionId/appium/device/app_state': {
    POST: {
      command: 'queryAppState',
      payloadParams: {required: [['appId'], ['bundleId']]},
      deprecated: true
    },
  },
  '/session/:sessionId/appium/device/toggle_airplane_mode': {
    POST: {
      command: 'toggleFlightMode',
      deprecated: true
    }
  },
  '/session/:sessionId/appium/device/toggle_data': {
    POST: {
      command: 'toggleData',
      deprecated: true
    }
  },
  '/session/:sessionId/appium/device/toggle_wifi': {
    POST: {
      command: 'toggleWiFi',
      deprecated: true
    }
  },
  '/session/:sessionId/appium/device/toggle_location_services': {
    POST: {
      command: 'toggleLocationServices',
      deprecated: true
    },
  },
  '/session/:sessionId/appium/device/open_notifications': {
    POST: {
      command: 'openNotifications',
      deprecated: true
    }
  },
  '/session/:sessionId/appium/device/start_activity': {
    POST: {
      command: 'startActivity',
      payloadParams: {
        required: ['appPackage', 'appActivity'],
        optional: [
          'appWaitPackage',
          'appWaitActivity',
          'intentAction',
          'intentCategory',
          'intentFlags',
          'optionalIntentArguments',
          'dontStopAppOnReset',
        ],
      },
      deprecated: true
    },
  },
  '/session/:sessionId/appium/device/system_bars': {
    GET: {
      command: 'getSystemBars',
      deprecated: true
    }
  },
  '/session/:sessionId/appium/device/display_density': {
    GET: {
      command: 'getDisplayDensity',
      deprecated: true
    }
  },
  '/session/:sessionId/appium/app/background': {
    POST: {
      command: 'background',
      payloadParams: {required: ['seconds']},
      deprecated: true
    },
  },
  '/session/:sessionId/appium/app/strings': {
    POST: {
      command: 'getStrings',
      payloadParams: {optional: ['language', 'stringFile']},
      deprecated: true
    },
  },
  '/session/:sessionId/appium/element/:elementId/value': {
    POST: {
      command: 'setValueImmediate',
      payloadParams: {required: ['text']},
      deprecated: true
    },
  },
  '/session/:sessionId/appium/element/:elementId/replace_value': {
    POST: {
      command: 'replaceValue',
      payloadParams: {required: ['text']},
      deprecated: true
    },
  },
  '/session/:sessionId/network_connection': {
    GET: {
      command: 'getNetworkConnection',
      deprecated: true
    },
    POST: {
      command: 'setNetworkConnection',
      payloadParams: {unwrap: 'parameters', required: ['type']},
      deprecated: true
    },
  },
  '/session/:sessionId/location': {
    GET: {
      command: 'getGeoLocation',
      deprecated: true,
    },
    POST: {
      command: 'setGeoLocation',
      payloadParams: {required: ['location']},
      deprecated: true,
    },
  },
} as const satisfies MethodMap<AndroidDriver>;

