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

import io.appium.android.bootstrap.utils.ReflectionUtils;
import io.appium.android.bootstrap.AndroidCommand;
import io.appium.android.bootstrap.AndroidCommandResult;
import io.appium.android.bootstrap.CommandHandler;
import io.appium.android.bootstrap.utils.XMLHierarchy;
import org.json.JSONException;
import org.w3c.dom.Document;

import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerConfigurationException;
import javax.xml.transform.TransformerException;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import java.io.StringWriter;

/**
 * Get page source. Return as string of XML doc
 */
public class Source extends CommandHandler {
  @Override
  public AndroidCommandResult execute(final AndroidCommand command) throws JSONException {
    ReflectionUtils.clearAccessibilityCache();

    final Document doc = (Document) XMLHierarchy.getFormattedXMLDoc();

    final TransformerFactory tf = TransformerFactory.newInstance();
    final StringWriter writer = new StringWriter();
    Transformer transformer;
    String xmlString;


    try {
      transformer = tf.newTransformer();
      transformer.transform(new DOMSource(doc), new StreamResult(writer));
      xmlString = writer.getBuffer().toString();

    } catch (final TransformerConfigurationException e) {
      e.printStackTrace();
      throw new RuntimeException("Something went terribly wrong while converting xml document to string");
    } catch (final TransformerException e) {
      return getErrorResult("Could not parse xml hierarchy to string: " + e.getMessage());
    }

    return getSuccessResult(xmlString);
  }
}
