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

import android.graphics.Rect;
import io.appium.android.bootstrap.*;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * This handler is used to get the text of elements that support it.
 *
 */
public class GetLocation extends CommandHandler {

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
    if (!command.isElementCommand()) {
      return getErrorResult("Unable to get location without an element.");
    }

    try {
      final JSONObject res = new JSONObject();
      final AndroidElement el = command.getElement();
      final Rect bounds = el.getBounds();
      res.put("x", bounds.left);
      res.put("y", bounds.top);
      return getSuccessResult(res);
    } catch (final Exception e) {
      return new AndroidCommandResult(WDStatus.NO_SUCH_ELEMENT, e.getMessage());
    }
  }
}
