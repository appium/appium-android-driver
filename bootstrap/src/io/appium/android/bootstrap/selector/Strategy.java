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

package io.appium.android.bootstrap.selector;

import io.appium.android.bootstrap.exceptions.InvalidStrategyException;

/**
 * An emumeration of possible strategies.
 */
public enum Strategy {
  CLASS_NAME("class name"),
  CSS_SELECTOR("css selector"),
  ID("id"),
  NAME("name"),
  LINK_TEXT("link text"),
  PARTIAL_LINK_TEXT("partial link text"),
  XPATH("xpath"),
  ACCESSIBILITY_ID("accessibility id"),
  ANDROID_UIAUTOMATOR("-android uiautomator");

  public static Strategy fromString(final String text)
      throws InvalidStrategyException {
    if (text != null) {
      for (final Strategy s : Strategy.values()) {
        if (text.equalsIgnoreCase(s.strategyName)) {
          return s;
        }
      }
    }
    throw new InvalidStrategyException("Locator strategy '" + text
        + "' is not supported on Android");
  }

  private final String strategyName;

  private Strategy(final String name) {
    strategyName = name;
  }

  public String getStrategyName() {
    return strategyName;
  }
}
