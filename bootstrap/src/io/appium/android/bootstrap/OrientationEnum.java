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

package io.appium.android.bootstrap;

/**
 * An enumeration that mirrors {@link android.view.Surface}.
 *
 */
public enum OrientationEnum {
  ROTATION_0(0), ROTATION_90(1), ROTATION_180(2), ROTATION_270(3);

  public static OrientationEnum fromInteger(final int x) {
    switch (x) {
      case 0:
        return ROTATION_0;
      case 1:
        return ROTATION_90;
      case 2:
        return ROTATION_180;
      case 3:
        return ROTATION_270;
    }
    return null;
  }

  private final int value;

  private OrientationEnum(final int value) {
    this.value = value;
  }

  public int getValue() {
    return value;
  }
}
