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
import com.android.uiautomator.core.UiObjectNotFoundException;
import io.appium.android.bootstrap.*;
import io.appium.android.bootstrap.exceptions.InvalidCoordinatesException;
import io.appium.android.bootstrap.utils.Point;
import org.json.JSONException;

import java.util.Hashtable;

/**
 * This handler is used to swipe.
 *
 */
public class Swipe extends CommandHandler {

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
    final Hashtable<String, Object> params = command.params();
    final Point start = new Point(params.get("startX"), params.get("startY"));
    final Point end = new Point(params.get("endX"), params.get("endY"));
    final Integer steps = (Integer) params.get("steps");
    final UiDevice device = UiDevice.getInstance();

    Point absStartPos = new Point();
    Point absEndPos = new Point();

    try {
      if (command.isElementCommand()) {
        final AndroidElement el = command.getElement();
        absStartPos = el.getAbsolutePosition(start);
        absEndPos = el.getAbsolutePosition(end);
      } else {
        absStartPos = PositionHelper.getDeviceAbsPos(start);
        absEndPos = PositionHelper.getDeviceAbsPos(end);
      }
    } catch (final UiObjectNotFoundException e) {
      return getErrorResult(e.getMessage());
    } catch (final InvalidCoordinatesException e) {
      return getErrorResult(e.getMessage());
    } catch (final Exception e) { // handle NullPointerException
      return getErrorResult("Unknown error");
    }

    Logger.debug("Swiping from " + absStartPos.toString() + " to "
        + absEndPos.toString() + " with steps: " + steps.toString());
    final boolean rv = device.swipe(absStartPos.x.intValue(),
        absStartPos.y.intValue(), absEndPos.x.intValue(),
        absEndPos.y.intValue(), steps);
    if (!rv) {
      return getErrorResult("The swipe did not complete successfully");
    }
    return getSuccessResult(rv);
  }
}
