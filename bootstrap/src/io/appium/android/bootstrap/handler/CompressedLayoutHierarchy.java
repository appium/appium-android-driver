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

import io.appium.android.bootstrap.AndroidCommand;
import io.appium.android.bootstrap.AndroidCommandResult;
import io.appium.android.bootstrap.CommandHandler;
import io.appium.android.bootstrap.utils.NotImportantViews;
import org.json.JSONException;

import java.util.Hashtable;

/**
 * Calls the uiautomator setCompressedLayoutHierarchy() function. If set to true, ignores some views during all Accessibility operations.
 */
public class CompressedLayoutHierarchy extends CommandHandler {
  @Override
  public AndroidCommandResult execute(AndroidCommand command) throws JSONException {

    boolean compressLayout;

    try {
      final Hashtable<String, Object> params = command.params();
      compressLayout = (Boolean) params.get("compressLayout");
      NotImportantViews.discard(compressLayout);
    } catch (ClassCastException  e) {
      return getErrorResult("must supply a 'compressLayout' boolean parameter");
    } catch (Exception e) {
      return getErrorResult("error setting compressLayoutHierarchy " + e.getMessage());
    }

    return getSuccessResult(compressLayout);
  }
}
