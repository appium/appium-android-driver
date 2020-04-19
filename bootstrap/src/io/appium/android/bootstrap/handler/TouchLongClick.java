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
import com.android.uiautomator.core.UiObjectNotFoundException;
import io.appium.android.bootstrap.Logger;
import io.appium.uiautomator.core.InteractionController;
import io.appium.uiautomator.core.UiAutomatorBridge;

/**
 * This handler is used to long click elements in the Android UI.
 *
 */
public class TouchLongClick extends TouchEvent {
  /*
   * UiAutomator has a broken longClick, so we'll try to implement it using the
   * touchDown / touchUp events.
   */
  protected static boolean correctLongClick(final int x, final int y, final int duration) {
    try {
      /*
       * bridge.getClass() returns ShellUiAutomatorBridge on API 18/19 so use
       * the super class.
       */

      InteractionController interactionController = UiAutomatorBridge.getInstance().getInteractionController();

      if (interactionController.touchDown(x, y)) {
        SystemClock.sleep(duration);
        if (interactionController.touchUp(x, y)) {
          return true;
        }
      }
      return false;

    } catch (final Exception e) {
      Logger.debug("Problem invoking correct long click: " + e);
      return false;
    }
  }

  @Override
  protected boolean executeTouchEvent() throws UiObjectNotFoundException {
    final Object paramDuration = params.get("duration");
    int duration = 2000; // two seconds
    if (paramDuration != null) {
      duration = Integer.parseInt(paramDuration.toString());
    }

    printEventDebugLine("TouchLongClick", duration);
    if (correctLongClick(clickX, clickY, duration)) {
      return true;
    }
    // if correctLongClick failed and we have an element
    // then uiautomator's longClick is used as a fallback.
    if (isElement) {
      Logger.debug("Falling back to broken longClick");

      return el.longClick();
    }
    return false;
  }
}
