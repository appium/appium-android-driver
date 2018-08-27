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

import android.graphics.Rect;
import com.android.uiautomator.core.UiObject;
import com.android.uiautomator.core.UiObjectNotFoundException;
import com.android.uiautomator.core.UiSelector;
import io.appium.android.bootstrap.exceptions.ElementNotFoundException;

import java.util.ArrayList;
import java.util.Hashtable;
import java.util.regex.Pattern;

import io.appium.android.bootstrap.Logger;

/**
 * A cache of elements that the app has seen.
 *
 */
public class AndroidElementsHash {

  private static final Pattern endsWithInstancePattern = Pattern.compile(".*INSTANCE=\\d+]$");

  public static AndroidElementsHash getInstance() {
    if (AndroidElementsHash.instance == null) {
      AndroidElementsHash.instance = new AndroidElementsHash();
    }
    return AndroidElementsHash.instance;
  }

  private final Hashtable<String, AndroidElement> elements;
  private       Integer                           counter;

  private static AndroidElementsHash instance;

  /**
   * Constructor
   */
  public AndroidElementsHash() {
    counter = 0;
    elements = new Hashtable<String, AndroidElement>();
  }

  /**
   * @param element
   * @return
   */
  public AndroidElement addElement(final UiObject element) {
    counter++;
    final String key = counter.toString();
    final AndroidElement el = new AndroidElement(key, element);
    elements.put(key, el);
    return el;
  }

  /**
   * Return an element given an Id.
   *
   * @param key
   * @return {@link AndroidElement}
   */
  public AndroidElement getElement(final String key) {
    return elements.get(key);
  }

  /**
   * Return an elements child given the key (context id), or uses the selector
   * to get the element.
   *
   * @param sel
   * @param key
   *          Element id.
   * @return {@link AndroidElement}
   * @throws ElementNotFoundException
   */
  public AndroidElement getElement(final UiSelector sel, final String key)
      throws ElementNotFoundException {
    AndroidElement baseEl;
    baseEl = elements.get(key);
    UiObject el;

    if (baseEl == null) {
      el = new UiObject(sel);
    } else {
      try {
        el = baseEl.getChild(sel);
      } catch (final UiObjectNotFoundException e) {
        throw new ElementNotFoundException();
      }
    }

    if (el.exists()) {
      // there are times when UiAutomator returns an element from another parent
      // so we need to see if it is within the bounds of the parent
      try {
        if (baseEl != null && !Rect.intersects(baseEl.getBounds(), el.getBounds())) {
            Logger.debug("UiAutomator returned a child element but it is " +
                         "outside the bounds of the parent. Assuming no " +
                         "child element found");
            throw new ElementNotFoundException();
        }
      } catch (final UiObjectNotFoundException e) {
        throw new ElementNotFoundException();
      }
      return addElement(el);
    } else {
      throw new ElementNotFoundException();
    }
  }

  /**
   * Same as {@link #getElement(UiSelector, String)} but for multiple elements
   * at once.
   *
   * @param sel
   * @param key
   * @return ArrayList<{@link AndroidElement}>
   * @throws UiObjectNotFoundException
   */
  public ArrayList<AndroidElement> getElements(final UiSelector sel,
                                               final String key) throws UiObjectNotFoundException {
    boolean keepSearching = true;
    final String selectorString = sel.toString();
    final boolean useIndex = selectorString.contains("CLASS_REGEX=");
    final boolean endsWithInstance = endsWithInstancePattern.matcher(selectorString).matches();
    Logger.debug("getElements selector:" + selectorString);
    final ArrayList<AndroidElement> elements = new ArrayList<AndroidElement>();

    final AndroidElement baseEl = this.getElement(key);
    // If sel is UiSelector[CLASS=android.widget.Button, INSTANCE=0]
    // then invoking instance with a non-0 argument will corrupt the selector.
    //
    // sel.instance(1) will transform the selector into:
    // UiSelector[CLASS=android.widget.Button, INSTANCE=1]
    //
    // The selector now points to an entirely different element.
    if (endsWithInstance) {
      Logger.debug("Selector ends with instance.");
      UiObject instanceObj;
      if (baseEl != null) {
        instanceObj = baseEl.getChild(sel);
      } else {
        instanceObj = new UiObject(sel);
      }
      // There's exactly one element when using instance.
      if (instanceObj != null && instanceObj.exists()) {
        elements.add(addElement(instanceObj));
      }
      return elements;
    }

    UiObject lastFoundObj;

    UiSelector tmp;
    int counter = 0;
    while (keepSearching) {
      if (baseEl == null) {
        Logger.debug("Element[" + key + "] is null: (" + counter + ")");

        if (useIndex) {
          Logger.debug("  using index...");
          tmp = sel.index(counter);
        } else {
          tmp = sel.instance(counter);
        }

        Logger.debug("getElements tmp selector:" + tmp.toString());
        lastFoundObj = new UiObject(tmp);
      } else {
        Logger.debug("Element[" + key + "] is " + baseEl.getId() + ", counter: "
            + counter);
        lastFoundObj = baseEl.getChild(sel.instance(counter));
      }
      counter++;
      if (lastFoundObj != null && lastFoundObj.exists()) {
        elements.add(addElement(lastFoundObj));
      } else {
        keepSearching = false;
      }
    }
    return elements;
  }
}
