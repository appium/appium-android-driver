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

/**
 * This handler is used to get the size of the screen.
 *
 */
public class GetDeviceSize extends CommandHandler {

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
  public AndroidCommandResult execute(final AndroidCommand command) {
    if (!command.isElementCommand()) {
      // only makes sense on a device
      final UiDevice d = UiDevice.getInstance();
      final JSONObject res = new JSONObject();
      try {
        res.put("height", d.getDisplayHeight());
        res.put("width", d.getDisplayWidth());
      } catch (final JSONException e) {
        getErrorResult("Error serializing height/width data into JSON");
      }
      return getSuccessResult(res);
    } else {
      return getErrorResult("Unable to get device size on an element.");
    }
  }
}
