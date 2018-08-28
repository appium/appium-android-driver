package io.appium.uiautomator.core;

import android.view.accessibility.AccessibilityNodeInfo;

import com.android.uiautomator.core.Configurator;
import com.android.uiautomator.core.UiObject;

import static io.appium.android.bootstrap.utils.ReflectionUtils.invoke;
import static io.appium.android.bootstrap.utils.ReflectionUtils.method;

/**
 * Static helper class for getting {@link AccessibilityNodeInfo} instances.
 *
 * Created by guysmoilov on 2/18/2016.
 */
public abstract class AccessibilityNodeInfoGetter {

    private static Configurator configurator = Configurator.getInstance();

    /**
     * Gets the {@link AccessibilityNodeInfo} associated with the given {@link UiObject}
     */
    public static AccessibilityNodeInfo fromUiObject(UiObject uiObject) {
        return (AccessibilityNodeInfo)
                invoke(method(UiObject.class, "findAccessibilityNodeInfo", long.class),
                        uiObject,
                        configurator.getWaitForSelectorTimeout());
    }
}
