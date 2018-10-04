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

import com.android.uiautomator.core.UiDevice;
import io.appium.android.bootstrap.AndroidCommand;
import io.appium.android.bootstrap.AndroidCommandResult;
import io.appium.android.bootstrap.CommandHandler;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Hashtable;

/**
 * This handler is used to PressKeyCode.
 *
 */
public class PressKeyCode extends CommandHandler {
  public Integer keyCode;
  public Integer metaState;

  /*
   * @param command The {@link AndroidCommand} used for this handler.
   *
   * @return {@link AndroidCommandResult}
   *
   * @throws JSONException
   *
   * @see io.appium.android.bootstrap.CommandHandler#execute(io.appium.android.
   * bootstrap.AndroidCommand)
   */
  @Override
  public AndroidCommandResult execute(final AndroidCommand command)
      throws JSONException {
    try {
      final Hashtable<String, Object> params = command.params();
      Object kc = params.get("keycode");
      if (kc instanceof Integer) {
        keyCode = (Integer) kc;
      } else if (kc instanceof String) {
        keyCode = Integer.parseInt((String) kc);
      } else {
        throw new IllegalArgumentException("Keycode of type " + kc.getClass() + "not supported.");
      }

      if (params.get("metastate") != JSONObject.NULL) {
        metaState = (Integer) params.get("metastate");
        UiDevice.getInstance().pressKeyCode(keyCode, metaState);
      } else {
        UiDevice.getInstance().pressKeyCode(keyCode);
      }

      return getSuccessResult(true);
    } catch (final Exception e) {
      return getErrorResult(e.getMessage());
    }
  }
}
