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

import io.appium.android.bootstrap.handler.*;
import org.json.JSONException;

import java.util.HashMap;

/**
 * Command execution dispatch class. This class relays commands to the various
 * handlers.
 *
 */
class AndroidCommandExecutor {

  private static HashMap<String, CommandHandler> map = new HashMap<String, CommandHandler>();

  static {
    map.put("waitForIdle", new WaitForIdle());
    map.put("clear", new Clear());
    map.put("orientation", new Orientation());
    map.put("swipe", new Swipe());
    map.put("flick", new Flick());
    map.put("drag", new Drag());
    map.put("pinch", new Pinch());
    map.put("click", new Click());
    map.put("touchLongClick", new TouchLongClick());
    map.put("touchDown", new TouchDown());
    map.put("touchUp", new TouchUp());
    map.put("touchMove", new TouchMove());
    map.put("getText", new GetText());
    map.put("setText", new SetText());
    map.put("getName", new GetName());
    map.put("getAttribute", new GetAttribute());
    map.put("getDeviceSize", new GetDeviceSize());
    map.put("scrollTo", new ScrollTo());
    map.put("find", new Find());
    map.put("getLocation", new GetLocation());
    map.put("getSize", new GetSize());
    map.put("getRect", new GetRect());
    map.put("wake", new Wake());
    map.put("pressBack", new PressBack());
    map.put("pressKeyCode", new PressKeyCode());
    map.put("longPressKeyCode", new LongPressKeyCode());
    map.put("takeScreenshot", new TakeScreenshot());
    map.put("updateStrings", new UpdateStrings());
    map.put("getDataDir", new GetDataDir());
    map.put("performMultiPointerGesture", new MultiPointerGesture());
    map.put("openNotification", new OpenNotification());
    map.put("source", new Source());
    map.put("compressedLayoutHierarchy", new CompressedLayoutHierarchy());
    map.put("configurator", new ConfiguratorHandler());
  }

  /**
   * Gets the handler out of the map, and executes the command.
   *
   * @param command
   *          The {@link AndroidCommand}
   * @return {@link AndroidCommandResult}
   */
  public AndroidCommandResult execute(final AndroidCommand command) {
    try {
      Logger.debug("Got command action: " + command.action());

      if (map.containsKey(command.action())) {
        return map.get(command.action()).execute(command);
      } else {
        return new AndroidCommandResult(WDStatus.UNKNOWN_COMMAND,
            "Unknown command: " + command.action());
      }
    } catch (final JSONException e) {
      Logger.error("Could not decode action/params of command");
      return new AndroidCommandResult(WDStatus.JSON_DECODER_ERROR,
          "Could not decode action/params of command, please check format!");
    }
  }
}
