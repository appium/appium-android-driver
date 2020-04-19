/*
 * Copyright (C) 2012 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package io.appium.uiautomator.core;

import android.view.InputEvent;

import static io.appium.android.bootstrap.utils.ReflectionUtils.invoke;
import static io.appium.android.bootstrap.utils.ReflectionUtils.method;

public class InteractionController {

  private static final String CLASS_INTERACTION_CONTROLLER = "com.android.uiautomator.core.InteractionController";
  private static final String METHOD_SEND_KEY = "sendKey";
  private static final String METHOD_INJECT_EVENT_SYNC = "injectEventSync";
  private static final String METHOD_TOUCH_DOWN = "touchDown";
  private static final String METHOD_TOUCH_UP = "touchUp";
  private static final String METHOD_TOUCH_MOVE = "touchMove";

  private final Object interactionController;

  public InteractionController(Object interactionController) {
    this.interactionController = interactionController;
  }

  public boolean sendKey(int keyCode, int metaState){
    return (Boolean) invoke(method(CLASS_INTERACTION_CONTROLLER, METHOD_SEND_KEY, int.class, int.class), interactionController, keyCode, metaState);
  }

  public boolean injectEventSync(InputEvent event) {
    return (Boolean) invoke(method(CLASS_INTERACTION_CONTROLLER, METHOD_INJECT_EVENT_SYNC, InputEvent.class), interactionController, event);
  }

  public boolean touchDown(int x, int y) {
    return (Boolean) invoke(method(CLASS_INTERACTION_CONTROLLER, METHOD_TOUCH_DOWN, int.class, int.class), interactionController, x, y);
  }

  public boolean touchUp(int x, int y) {
    return (Boolean) invoke(method(CLASS_INTERACTION_CONTROLLER, METHOD_TOUCH_UP, int.class, int.class), interactionController, x, y);
  }

  public boolean touchMove(int x, int y) {
    return (Boolean) invoke(method(CLASS_INTERACTION_CONTROLLER, METHOD_TOUCH_MOVE, int.class, int.class), interactionController, x, y);
  }
}
