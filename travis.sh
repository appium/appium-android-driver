#!/bin/bash

set -ev

if [ ${START_EMU} = "1" ] && [ ${FIRST_CALL} = "1" ]; then
    echo no | android create avd --force -n test -t android-21 --abi armeabi-v7a
    emulator -avd test -no-audio -no-window &
fi

if [ ${START_EMU} = "1" ] && [ ${SECOND_CALL} = "1" ]; then
    android-wait-for-emulator
    adb shell input keyevent 82 &
fi

exit 0;
