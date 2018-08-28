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

import com.android.uiautomator.core.UiDevice;

import static io.appium.android.bootstrap.utils.API.API_18;

public abstract class NotImportantViews {
  // setCompressedLayoutHeirarchy doesn't exist on API <= 17
  // http://developer.android.com/reference/android/accessibilityservice/AccessibilityServiceInfo.html#FLAG_INCLUDE_NOT_IMPORTANT_VIEWS
  private static boolean canDiscard = API_18;

  public static void discard(boolean discard) {
    if (canDiscard) {
      UiDevice.getInstance().setCompressedLayoutHeirarchy(discard);
    }
  }
}
