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

/**
 * Log to standard out so that the Appium framework can pick it up.
 *
 */
public class Logger {

  private static String prefix = "[APPIUM-UIAUTO]";
  private static String suffix = "[/APPIUM-UIAUTO]";

  public static void debug(final String msg) {
    System.out.println(Logger.prefix + " [debug] " + msg + Logger.suffix);
  }

  public static void error(final String msg) {
    System.out.println(Logger.prefix + " [error] " + msg + Logger.suffix);
  }

  public static void info(final String msg) {
    System.out.println(Logger.prefix + " [info] " + msg + Logger.suffix);
  }
}
