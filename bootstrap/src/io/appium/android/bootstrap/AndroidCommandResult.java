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

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Results class that converts status to JSON messages.
 *
 */
public class AndroidCommandResult {

  JSONObject json;

  public AndroidCommandResult(final WDStatus status) {
    try {
      json = new JSONObject();
      json.put("status", status.code());
      json.put("value", status.message());
    } catch (final JSONException e) {
      Logger.error("Couldn't create android command result!");
    }
  }

  public AndroidCommandResult(final WDStatus status, final JSONObject val) {
    json = new JSONObject();
    try {
      json.put("status", status.code());
      json.put("value", val);
    } catch (final JSONException e) {
      Logger.error("Couldn't create android command result!");
    }
  }

  public AndroidCommandResult(final WDStatus status, final Object val) {
    json = new JSONObject();
    try {
      json.put("status", status.code());
      json.put("value", val);
    } catch (final JSONException e) {
      Logger.error("Couldn't create android command result!");
    }
  }

  public AndroidCommandResult(final WDStatus status, final String val) {
    try {
      json = new JSONObject();
      json.put("status", status.code());
      json.put("value", val);
    } catch (final JSONException e) {
      Logger.error("Couldn't create android command result!");
    }
  }

  @Override
  public String toString() {
    return json.toString();
  }

}
