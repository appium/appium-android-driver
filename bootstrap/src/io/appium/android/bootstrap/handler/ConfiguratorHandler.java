package io.appium.android.bootstrap.handler;

import com.android.uiautomator.core.Configurator;
import io.appium.android.bootstrap.AndroidCommand;
import io.appium.android.bootstrap.AndroidCommandResult;
import io.appium.android.bootstrap.CommandHandler;
import org.json.JSONException;

import java.util.Hashtable;

import static io.appium.android.bootstrap.utils.API.API_18;

/**
 * This handler set {@link com.android.uiautomator.core.Configurator} related settings including
 * ActionAcknowledgmentTimeout, KeyInjectionDelay, ScrollAcknowledgmentTimeout, WaitForIdleTimeout and WaitForSelectorTimeout
 * <br/>command example {"cmd" :"action", "params":{"config":"actionAcknowledgmentTimeout", "value":5000}}
 * <br/>example is the same as invoking {@link com.android.uiautomator.core.Configurator#setActionAcknowledgmentTimeout} to 5 seconds
 */
public class ConfiguratorHandler extends CommandHandler {

    private static final String ACTION_ACKNOWLEDGMENT_TIMEOUT = "actionAcknowledgmentTimeout";
    private static final String KEY_INJECTION_DELAY = "keyInjectionDelay";
    private static final String SCROLL_ACKNOWLEDGMENT_TIMEOUT = "scrollAcknowledgmentTimeout";
    private static final String WAIT_FOR_IDLE_TIMEOUT = "waitForIdleTimeout";
    private static final String WAIT_FOR_SELECTOR_TIMEOUT = "waitForSelectorTimeout";

    @Override
    public AndroidCommandResult execute(AndroidCommand command) throws JSONException {
        if (!API_18) {
            return getErrorResult("Device API version must >= 18!");
        }
        final Hashtable<String, Object> params = command.params();
        int value = -1; // negative value means default
        if (params.containsKey("value")) {
            value = (Integer) params.get("value");
        }
        String methodName = ((String) params.get("config"));
        //TODO: use reflection to invoke method would be more expandable; but Configurator is singleton
        Configurator configurator = Configurator.getInstance();
        switch (methodName) {
            case ACTION_ACKNOWLEDGMENT_TIMEOUT:
                if (value < 0) { // set to default when negative value
                    value = 3000;
                }
                configurator.setActionAcknowledgmentTimeout(value);
                break;
            case KEY_INJECTION_DELAY:
                if (value < 0) { // set to default when negative value
                    value = 0;
                }
                configurator.setKeyInjectionDelay(value);
                break;
            case SCROLL_ACKNOWLEDGMENT_TIMEOUT:
                if (value < 0) { // set to default when negative value
                    value = 200;
                }
                configurator.setScrollAcknowledgmentTimeout(value);
                break;
            case WAIT_FOR_IDLE_TIMEOUT:
                if (value < 0) { // set to default when negative value
                    value = 10000;
                }
                configurator.setWaitForIdleTimeout(value);
                break;
            case WAIT_FOR_SELECTOR_TIMEOUT:
                if (value < 0) { // set to default when negative value
                    value = 10000;
                }
                configurator.setWaitForSelectorTimeout(value);
                break;
            default:
                return getErrorResult("'configurator' command must contain 'config' key!");
        }
        return getSuccessResult(value);
    }
}
