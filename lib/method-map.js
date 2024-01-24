export const newMethodMap = /** @type {const} */ ({
  '/session/:sessionId/timeouts/implicit_wait': {
    POST: {command: 'implicitWait', payloadParams: {required: ['ms']}},
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
  '/session/:sessionId/window/:windowhandle/size': {GET: {command: 'getWindowSize'}},
  '/session/:sessionId/keys': {
    POST: {command: 'keys', payloadParams: {required: ['value']}},
  },
  '/session/:sessionId/element/:elementId/location': {GET: {command: 'getLocation'}},
  '/session/:sessionId/element/:elementId/location_in_view': {GET: {command: 'getLocationInView'}},
  '/session/:sessionId/element/:elementId/size': {GET: {command: 'getSize'}},
  '/session/:sessionId/touch/click': {
    POST: {command: 'click', payloadParams: {required: ['element']}},
  },
  '/session/:sessionId/touch/down': {
    POST: {command: 'touchDown', payloadParams: {required: ['x', 'y']}},
  },
  '/session/:sessionId/touch/up': {
    POST: {command: 'touchUp', payloadParams: {required: ['x', 'y']}},
  },
  '/session/:sessionId/touch/move': {
    POST: {command: 'touchMove', payloadParams: {required: ['x', 'y']}},
  },
  '/session/:sessionId/touch/longclick': {
    POST: {
      command: 'touchLongClick',
      payloadParams: {required: ['elements']},
    },
  },
  '/session/:sessionId/touch/perform': {
    POST: {
      command: 'performTouch',
      payloadParams: {wrap: 'actions', required: ['actions']},
    },
  },
  '/session/:sessionId/touch/multi/perform': {
    POST: {
      command: 'performMultiAction',
      payloadParams: {required: ['actions'], optional: ['elementId']},
    },
  },
  '/session/:sessionId/appium/device/lock': {
    POST: {command: 'lock', payloadParams: {optional: ['seconds']}},
  },
  '/session/:sessionId/appium/device/unlock': {POST: {command: 'unlock'}},
  '/session/:sessionId/appium/device/is_locked': {POST: {command: 'isLocked'}},
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
  '/session/:sessionId/appium/performanceData/types': {POST: {command: 'getPerformanceDataTypes'}},
  '/session/:sessionId/appium/getPerformanceData': {
    POST: {
      command: 'getPerformanceData',
      payloadParams: {
        required: ['packageName', 'dataType'],
        optional: ['dataReadTimeout'],
      },
    },
  },
  '/session/:sessionId/appium/device/press_keycode': {
    POST: {
      command: 'pressKeyCode',
      payloadParams: {required: ['keycode'], optional: ['metastate', 'flags']},
    },
  },
  '/session/:sessionId/appium/device/long_press_keycode': {
    POST: {
      command: 'longPressKeyCode',
      payloadParams: {required: ['keycode'], optional: ['metastate', 'flags']},
    },
  },
  '/session/:sessionId/appium/device/finger_print': {
    POST: {
      command: 'fingerprint',
      payloadParams: {required: ['fingerprintId']},
    },
  },
  '/session/:sessionId/appium/device/send_sms': {
    POST: {
      command: 'sendSMS',
      payloadParams: {required: ['phoneNumber', 'message']},
    },
  },
  '/session/:sessionId/appium/device/gsm_call': {
    POST: {
      command: 'gsmCall',
      payloadParams: {required: ['phoneNumber', 'action']},
    },
  },
  '/session/:sessionId/appium/device/gsm_signal': {
    POST: {
      command: 'gsmSignal',
      payloadParams: {required: ['signalStrength']},
    },
  },
  '/session/:sessionId/appium/device/gsm_voice': {
    POST: {command: 'gsmVoice', payloadParams: {required: ['state']}},
  },
  '/session/:sessionId/appium/device/power_capacity': {
    POST: {
      command: 'powerCapacity',
      payloadParams: {required: ['percent']},
    },
  },
  '/session/:sessionId/appium/device/power_ac': {
    POST: {command: 'powerAC', payloadParams: {required: ['state']}},
  },
  '/session/:sessionId/appium/device/network_speed': {
    POST: {
      command: 'networkSpeed',
      payloadParams: {required: ['netspeed']},
    },
  },
  '/session/:sessionId/appium/device/keyevent': {
    POST: {
      command: 'keyevent',
      payloadParams: {required: ['keycode'], optional: ['metastate']},
    },
  },
  '/session/:sessionId/appium/device/current_activity': {GET: {command: 'getCurrentActivity'}},
  '/session/:sessionId/appium/device/current_package': {GET: {command: 'getCurrentPackage'}},
  '/session/:sessionId/appium/device/app_state': {
    POST: {
      command: 'queryAppState',
      payloadParams: {required: [['appId'], ['bundleId']]},
    },
  },
  '/session/:sessionId/appium/device/toggle_airplane_mode': {POST: {command: 'toggleFlightMode'}},
  '/session/:sessionId/appium/device/toggle_data': {POST: {command: 'toggleData'}},
  '/session/:sessionId/appium/device/toggle_wifi': {POST: {command: 'toggleWiFi'}},
  '/session/:sessionId/appium/device/toggle_location_services': {
    POST: {command: 'toggleLocationServices'},
  },
  '/session/:sessionId/appium/device/open_notifications': {POST: {command: 'openNotifications'}},
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
    },
  },
  '/session/:sessionId/appium/device/system_bars': {GET: {command: 'getSystemBars'}},
  '/session/:sessionId/appium/device/display_density': {GET: {command: 'getDisplayDensity'}},
  '/session/:sessionId/appium/app/background': {
    POST: {
      command: 'background',
      payloadParams: {required: ['seconds']},
    },
  },
  '/session/:sessionId/appium/app/strings': {
    POST: {
      command: 'getStrings',
      payloadParams: {optional: ['language', 'stringFile']},
    },
  },
  '/session/:sessionId/appium/element/:elementId/value': {
    POST: {
      command: 'setValueImmediate',
      payloadParams: {required: ['text']},
    },
  },
  '/session/:sessionId/appium/element/:elementId/replace_value': {
    POST: {
      command: 'replaceValue',
      payloadParams: {required: ['text']},
    },
  },
});
