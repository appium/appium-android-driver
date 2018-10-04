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

package io.appium.android.bootstrap.utils;

import com.android.uiautomator.core.UiSelector;
import io.appium.android.bootstrap.Logger;
import io.appium.android.bootstrap.exceptions.UiSelectorSyntaxException;

import java.util.ArrayList;
import java.util.List;

/**
 * For parsing strings passed in for the "-android uiautomator" locator strategy
 */
public class UiAutomatorParser {

  private String text;
  private List<UiSelector> selectors;
  private UiScrollableParser scrollableParser = new UiScrollableParser();
  private UiSelectorParser selectorParser = new UiSelectorParser();

  public List<UiSelector> parse(String textToParse) throws UiSelectorSyntaxException {
    if (textToParse.isEmpty()) {
      throw new UiSelectorSyntaxException("Tried to parse an empty string. Expected to see a string consisting of text to be interpreted as UiAutomator java code.");
    }
    selectors = new ArrayList<UiSelector>();
    text = textToParse.trim();
    removeTailingSemicolon();
    trimWhitespace();

    consumeStatement();
    while (text.length() > 0) {
      trimWhitespace();
      consumeSemicolon();
      trimWhitespace();
      consumeStatement();
    }

    return selectors;
  }

  private void trimWhitespace() {
    text = text.trim();
  }

  private void removeTailingSemicolon() {
    if (text.charAt(text.length()-1) == ';') {
      text = text.substring(0, text.length()-1);
    }
  }

  private void consumeSemicolon() throws UiSelectorSyntaxException {
    if (text.charAt(0) != ';') {
      throw new UiSelectorSyntaxException("Expected ';' but saw '" + text.charAt(0) +"'");
    }

    text = text.substring(1);
  }

  private void consumeStatement() throws UiSelectorSyntaxException {
    String statement;
    int index = 0;
    int parenCount = -1; // semicolons could appear inside String arguments, so we make sure we only count occurrences outside of a parenthesis pair
    while (index < text.length()) {
      if (text.charAt(index) == ';' && parenCount == 0) {
        break;
      }
      if (text.charAt(index) == '(') {
        if (parenCount < 0) {
          parenCount = 1;
        } else {
          parenCount++;
        }
      }
      if (text.charAt(index) == ')') {
        parenCount--;
      }
      index++;
    }

    statement = text.substring(0, index);
    if (UiScrollableParser.isUiScrollable(statement)) {
      Logger.debug("Parsing scrollable: " + statement);
      selectors.add(scrollableParser.parse(statement));
    } else {
      Logger.debug("Parsing selector: " + statement);
      selectors.add(selectorParser.parse(statement));
    }

    text = text.substring(index);
  }

}
