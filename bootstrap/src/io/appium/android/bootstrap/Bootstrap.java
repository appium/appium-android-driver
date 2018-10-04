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

import com.android.uiautomator.testrunner.UiAutomatorTestCase;
import io.appium.android.bootstrap.exceptions.SocketServerException;
import io.appium.android.bootstrap.handler.Find;

/**
 * The Bootstrap class runs the socket server.
 *
 */
public class Bootstrap extends UiAutomatorTestCase {

  public void testRunServer() {
    Find.params = getParams();
    boolean disableAndroidWatchers = Boolean.parseBoolean(getParams().getString("disableAndroidWatchers"));
    boolean acceptSSLCerts = Boolean.parseBoolean(getParams().getString("acceptSslCerts"));

    SocketServer server;
    try {
      server = new SocketServer(4724);
      server.listenForever(disableAndroidWatchers, acceptSSLCerts);
    } catch (final SocketServerException e) {
      Logger.error(e.getError());
      System.exit(1);
    }

  }
}
