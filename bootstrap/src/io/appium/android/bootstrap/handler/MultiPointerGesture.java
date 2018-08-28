/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * See the NOTICE file distributed with this work for additional
 * information regarding copyright ownership.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package io.appium.android.bootstrap.handler;

import android.os.SystemClock;
import android.view.InputDevice;
import android.view.MotionEvent;
import android.view.MotionEvent.PointerCoords;
import android.view.MotionEvent.PointerProperties;
import io.appium.android.bootstrap.AndroidCommand;
import io.appium.android.bootstrap.AndroidCommandResult;
import io.appium.android.bootstrap.AndroidElement;
import io.appium.android.bootstrap.CommandHandler;
import io.appium.android.bootstrap.Logger;
import io.appium.android.bootstrap.WDStatus;
import io.appium.uiautomator.core.UiAutomatorBridge;
import java.lang.RuntimeException;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import static io.appium.android.bootstrap.utils.API.API_18;

public class MultiPointerGesture extends CommandHandler {

  private static final int MOTION_EVENT_INJECTION_DELAY_MILLIS = 5;

  private PointerCoords createPointerCoords(final JSONObject obj)
      throws JSONException {
    final JSONObject o = obj.optJSONObject("touch");
    if (o == null) {
      return null;
    }

    final int x = o.getInt("x");
    final int y = o.getInt("y");

    final PointerCoords p = new PointerCoords();
    p.size = 1;
    p.pressure = 1;
    p.x = x;
    p.y = y;

    return p;
  }

  @Override
  public AndroidCommandResult execute(final AndroidCommand command)
      throws JSONException {
    try {
      final PointerCoords[][] pcs = parsePointerCoords(command);

      if (command.isElementCommand()) {
        final AndroidElement el = command.getElement();
        if (el.performMultiPointerGesture(pcs)) {
          return getSuccessResult("OK");
        } else {
          return getErrorResult("Unable to perform multi pointer gesture");
        }
      } else {
        if (API_18) {
          if (performMultiPointerGesture(pcs)) {
            return getSuccessResult("OK");
          } else {
            return getErrorResult("Unable to perform multi pointer gesture");
          }
        } else {
          Logger.error("Device does not support API < 18!");
          return new AndroidCommandResult(WDStatus.UNKNOWN_ERROR,
              "Cannot perform multi pointer gesture on device below API level 18");
        }
      }
    } catch (final Exception e) {
      Logger.debug("Exception: " + e);
      e.printStackTrace();
      return new AndroidCommandResult(WDStatus.UNKNOWN_ERROR, e.getMessage());
    }
  }

  private PointerCoords[] gesturesToPointerCoords(final JSONArray gestures)
      throws JSONException {
    // gestures, e.g.:
    // [
    // {"touch":{"y":529.5,"x":120},"time":0.2},
    // {"touch":{"y":529.5,"x":130},"time":0.4},
    // {"touch":{"y":454.5,"x":140},"time":0.6},
    // {"touch":{"y":304.5,"x":150},"time":0.8}
    // ]

    // From the docs:
    // "Steps are injected about 5 milliseconds apart, so 100 steps may take
    // around 0.5 seconds to complete."

    ArrayList<PointerCoords> pc = new ArrayList();
    PointerCoords lastPosition = null;

    int i = 1;
    JSONObject current = gestures.getJSONObject(0);
    double currentTime = current.getDouble("time");
    double runningTime = 0.0;
    final int gesturesLength = gestures.length();
    while (true) {
      if (runningTime > currentTime) {
        if (i == gesturesLength) {
          break;
        }
        current = gestures.getJSONObject(i++);
        currentTime = current.getDouble("time");
      }

      PointerCoords currentCoord = createPointerCoords(current);
      // Check if current action has no position (waiting before starting gesture)
      if (currentCoord != null)
        lastPosition = currentCoord;
      pc.add(lastPosition);

      runningTime += 0.005;
    }

    return pc.toArray(new PointerCoords[0]);
  }

  private PointerCoords[][] parsePointerCoords(final AndroidCommand command)
      throws JSONException {
    final JSONArray actions = (org.json.JSONArray) command.params().get(
        "actions");


    final PointerCoords[][] pcs = new PointerCoords[actions.length()][];
    for (int i = 0; i < actions.length(); i++) {
      pcs[i] = gesturesToPointerCoords(actions.getJSONArray(i));
    }

    return pcs;
  }

  // Based on https://android.googlesource.com/platform/frameworks/uiautomator/+/61ce05bd4fd5ffc1f036c7c02c9af7cb92d6ec50/src/com/android/uiautomator/core/InteractionController.java#686
  // But supports actions with pointers starting and ending at different moments.

  private int getPointerAction(int motionEvent, int index) {
    // Creates a pointer action in multi pointer events.
    // Notice that the index argument is the index of the touch up/down event
    // inside the array and not the pointer id (even the docs were confusing,
    // since the constant had a misleading ACTION_POINTER_ID_SHIFT name in early
    // API versions).
    return motionEvent + (index << MotionEvent.ACTION_POINTER_INDEX_SHIFT);
  }

  private boolean injectEventSync(MotionEvent event) {
    return UiAutomatorBridge.getInstance().injectInputEvent(event, true);
  }

  private boolean injectPointers(long downTime, int action,
      final List<PointerProperties> properties, final List<PointerCoords> coords) {
    // Injects pointers using some default values. Number of pointers is assumed
    // to be the length of the coords list.
    final MotionEvent event = MotionEvent.obtain(downTime,
        SystemClock.uptimeMillis(), action, coords.size(), properties.toArray(new PointerProperties[0]),
        coords.toArray(new PointerCoords[0]), 0, 0, 1, 1, 0, 0, InputDevice.SOURCE_TOUCHSCREEN, 0);
    return injectEventSync(event);
  }

  private PointerProperties fingerProperty(int id) {
    PointerProperties prop = new PointerProperties();
    prop.id = id;
    prop.toolType = MotionEvent.TOOL_TYPE_FINGER;
    return prop;
  }

  private int findIndex(ArrayList<PointerProperties> properties, int id) {
    int i = 0;
    for (PointerProperties prop : properties) {
      if (prop.id == id) {
        return i;
      }
      i++;
    }
    throw new RuntimeException("findIndex: touch id not found");
  }

  private boolean performMultiPointerGesture(final PointerCoords[][] pcs) {
    // Each element in pcs represents a contact as a series of PointerCoords.
    // Events are injected with an interval of about 5ms. Some contacts might
    // end earlier than others (if a finger was released earlier), indicated by
    // a shorter list of events, or start later, indicated by null entries at
    // the beginning of the contact.
    boolean hasEvents = true, success = true;
    int step = 0;
    long downTime = 0;
    ArrayList<PointerProperties> properties = new ArrayList();
    ArrayList<PointerCoords> coords = new ArrayList();
    while (hasEvents) {
      hasEvents = false;
      // Lists of new/released pointer id's
      ArrayList<Integer> pointerDown = new ArrayList();
      ArrayList<Integer> pointerUp = new ArrayList();
      for (int id = 0; id < pcs.length; id++) {
        if (step < pcs[id].length) {
          hasEvents = true;
          if (pcs[id][step] != null) {
            if (step == 0 || pcs[id][step - 1] == null) {
              pointerDown.add(id);
            }
          }
        } else if (step == pcs[id].length) {
          pointerUp.add(id);
        }
      }


      for (int id : pointerUp) {
        int index = findIndex(properties, id);
        if (coords.size() == 1) {
          // If no more pointers will be touching the screen, we send the final ACTION_UP
          success &= injectPointers(downTime, MotionEvent.ACTION_UP, properties, coords);
        } else {
          success &= injectPointers(downTime, getPointerAction(MotionEvent.ACTION_POINTER_UP,
              index), properties, coords);
        }
        properties.remove(index);
        coords.remove(index);
      }


      if (coords.size() > 0) {
        for (int i = 0; i < coords.size(); i++) {
          coords.set(i, pcs[properties.get(i).id][step]);
        }
        success &= injectPointers(downTime, MotionEvent.ACTION_MOVE, properties, coords);
      }

      if (pointerDown.size() > 0) {
        if (coords.size() == 0) {
          // If no pointers are touching the screen, send first ACTION_DOWN
          int id = pointerDown.remove(0);
          downTime = SystemClock.uptimeMillis();
          coords.add(pcs[id][step]);
          properties.add(fingerProperty(id));
          success &= injectPointers(downTime, MotionEvent.ACTION_DOWN, properties, coords);
        }
        for (int id : pointerDown) {
          coords.add(pcs[id][step]);
          properties.add(fingerProperty(id));
          success &= injectPointers(downTime, getPointerAction(MotionEvent.ACTION_POINTER_DOWN,
              coords.size() - 1), properties, coords);
        }
      }

      step++;
      SystemClock.sleep(MOTION_EVENT_INJECTION_DELAY_MILLIS);
    }
    return success;
  }
}
