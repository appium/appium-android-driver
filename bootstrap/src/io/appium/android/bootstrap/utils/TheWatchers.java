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

package io.appium.android.bootstrap.utils;

import com.android.uiautomator.core.UiObject;
import com.android.uiautomator.core.UiSelector;
import io.appium.android.bootstrap.Logger;

public class TheWatchers {
  private static TheWatchers ourInstance = new TheWatchers();
  private boolean            alerted     = false;

  public static TheWatchers getInstance() {
    return ourInstance;
  }

  private TheWatchers() {
  }

  public boolean check() {
    // Send only one alert message...
    if (isDialogPresent() && (!alerted)) {
      Logger.debug("Emitting system alert message");
      alerted = true;
    }

    // if the dialog went away, make sure we can send an alert again
    if (!isDialogPresent() && alerted) {
      alerted = false;
    }
    return alerted;
  }

  public boolean isDialogPresent() {
    UiObject alertDialog = new UiObject(
        new UiSelector().packageName("com.android.systemui"));
    return alertDialog.exists();
  }
}
