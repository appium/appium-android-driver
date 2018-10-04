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

import android.os.RemoteException;
import com.android.uiautomator.core.UiDevice;
import io.appium.android.bootstrap.*;
import org.json.JSONException;

import java.util.Hashtable;

/**
 * This handler is used to get or set the orientation of the device.
 *
 */
public class Orientation extends CommandHandler {

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
    final String orientation = (String) params.get("orientation");
    boolean isNaturalOrientation = false;
    if (params.containsKey("naturalOrientation")) {
      isNaturalOrientation = Boolean.valueOf(String.valueOf(params.get("naturalOrientation")));
    }
    if (params.containsKey("orientation")) {
      // Set the rotation

      try {
        return handleRotation(orientation, isNaturalOrientation);
      } catch (final Exception e) {
        return getErrorResult("Unable to rotate screen: " + e.getMessage());
      }
    } else {
      // Get the rotation
      return getRotation(isNaturalOrientation);
    }

  }

  /**
   * Returns the current rotation
   *
   * @return {@link AndroidCommandResult}
   */
  private AndroidCommandResult getRotation(boolean isNaturalOrientation) {
    String res = null;
    final UiDevice d = UiDevice.getInstance();
    final OrientationEnum currentRotation = OrientationEnum.fromInteger(d
        .getDisplayRotation());
    Logger.debug("Current rotation: " + currentRotation);
    boolean naturalOrientationRequired = isNaturalOrientation && isWideScreenDevice(d);
    if (naturalOrientationRequired) {
      Logger.debug("Device's natural display recognized as landscape");
    }
    switch (currentRotation) {
      case ROTATION_0:
      case ROTATION_180:
        res = naturalOrientationRequired ? "LANDSCAPE" : "PORTRAIT";
        break;
      case ROTATION_90:
      case ROTATION_270:
        res = naturalOrientationRequired ? "PORTRAIT" : "LANDSCAPE";
        break;
    }

    if (res != null) {
      return getSuccessResult(res);
    } else {
      return getErrorResult("Get orientation did not complete successfully");
    }
  }

  /**
   * Set the desired rotation
   *
   * @param orientation
   *          The rotation desired (LANDSCAPE or PORTRAIT)
   * @return {@link AndroidCommandResult}
   * @throws RemoteException
   * @throws InterruptedException
   */
  private AndroidCommandResult handleRotation(String orientation, boolean isNaturalOrientation)
      throws RemoteException, InterruptedException {
    final UiDevice d = UiDevice.getInstance();
    OrientationEnum desired;
    OrientationEnum current = OrientationEnum.fromInteger(d
        .getDisplayRotation());

    Logger.debug("Desired orientation: " + orientation);
    Logger.debug("Current rotation: " + current);
    
    if (isNaturalOrientation && isWideScreenDevice(d)) {
      Logger.debug("Device's natural display recognized as landscape");
      orientation = orientation.equalsIgnoreCase("LANDSCAPE") ? "PORTRAIT" : "LANDSCAPE";
    }
    
    if (orientation.equalsIgnoreCase("LANDSCAPE")) {
      switch (current) {
        case ROTATION_0:
          d.setOrientationRight();
          desired = OrientationEnum.ROTATION_270;
          break;
        case ROTATION_180:
          d.setOrientationLeft();
          desired = OrientationEnum.ROTATION_270;
          break;
        default:
          return getSuccessResult("Already in landscape mode.");
      }
    } else {
      switch (current) {
        case ROTATION_90:
        case ROTATION_270:
          d.setOrientationNatural();
          desired = OrientationEnum.ROTATION_0;
          break;
        default:
          return getSuccessResult("Already in portrait mode.");
      }
    }
    current = OrientationEnum.fromInteger(d.getDisplayRotation());
    // If the orientation has not changed,
    // busy wait until the TIMEOUT has expired
    final int TIMEOUT = 2000;
    final long then = System.currentTimeMillis();
    long now = then;
    while (current != desired && now - then < TIMEOUT) {
      Thread.sleep(100);
      now = System.currentTimeMillis();
      current = OrientationEnum.fromInteger(d.getDisplayRotation());
    }
    if (current != desired) {
      return getErrorResult("Set the orientation, but app refused to rotate.");
    }
    return getSuccessResult("Rotation (" + orientation + ") successful.");
  }
  /**
  * this method will determine if the device natural display is landscape.
  */
  private static boolean isWideScreenDevice(UiDevice uiDevice){
    OrientationEnum rotation = OrientationEnum.fromInteger(uiDevice.getDisplayRotation());
    int width = uiDevice.getDisplayWidth();
    int height = uiDevice.getDisplayHeight();
    // if the device's natural orientation is portrait, false will be returned. Otherwise, true will be returned.
    return (!((rotation == OrientationEnum.ROTATION_0 || rotation == OrientationEnum.ROTATION_180) && height > width ||
            (rotation == OrientationEnum.ROTATION_90 || rotation == OrientationEnum.ROTATION_270) && width > height));
  }
}
