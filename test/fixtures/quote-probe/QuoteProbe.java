package io.appium.quoteargs;

import android.app.*;
import android.content.*;
import android.os.*;
import android.text.*;
import android.widget.EditText;
import android.webkit.WebView;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import org.json.*;

/** Tiny debuggable fixture: records values received by Android, rather than shell output. */
public class QuoteProbe extends Activity {
  static void write(Context context, String name, String value) {
    try (FileOutputStream out = context.openFileOutput(name, Context.MODE_PRIVATE)) {
      out.write(value.getBytes(StandardCharsets.UTF_8));
    } catch (Exception e) { throw new RuntimeException(e); }
  }
  static void capture(Context context, String name, Intent intent) {
    try {
      JSONObject data = new JSONObject();
      data.put("action", intent.getAction());
      data.put("uri", intent.getDataString());
      JSONObject extras = new JSONObject();
      if (intent.getExtras() != null) for (String key : intent.getExtras().keySet()) {
        extras.put(key, intent.getExtras().get(key));
      }
      data.put("extras", extras);
      write(context, name, data.toString());
    } catch (Exception e) { throw new RuntimeException(e); }
  }
  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    capture(this, "activity.json", getIntent());
    if (getIntent().getBooleanExtra("stream", false)) {
      android.view.View view = new android.view.View(this);
      setContentView(view);
      android.animation.ValueAnimator animation = android.animation.ValueAnimator.ofArgb(0xffff0000, 0xff0000ff);
      animation.setDuration(500);
      animation.setRepeatCount(android.animation.ValueAnimator.INFINITE);
      animation.setRepeatMode(android.animation.ValueAnimator.REVERSE);
      animation.addUpdateListener(value -> view.setBackgroundColor((Integer) value.getAnimatedValue()));
      animation.start();
      return;
    }
    if (getIntent().getBooleanExtra("webview", false)) {
      WebView.setWebContentsDebuggingEnabled(true);
      WebView webview = new WebView(this);
      setContentView(webview);
      webview.loadDataWithBaseURL("https://appium.example/", "<html><head><title>Appium quote probe</title></head><body>Local test page</body></html>", "text/html", "UTF-8", null);
      return;
    }
    EditText input = new EditText(this);
    input.setSingleLine(true);
    // Test injected key events without IME startup or autocorrection changing the text.
    input.setRawInputType(InputType.TYPE_NULL);
    input.setShowSoftInputOnFocus(false);
    input.addTextChangedListener(new TextWatcher() {
      public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
      public void onTextChanged(CharSequence s, int start, int before, int count) {
        write(QuoteProbe.this, "text.txt", s.toString());
      }
      public void afterTextChanged(Editable e) {}
    });
    setContentView(input);
    input.requestFocus();
  }
  @Override public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    write(this, "focused.txt", Boolean.toString(hasFocus));
  }
  public static class Receiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) { capture(context, "broadcast.json", intent); }
  }
  public static class ProbeService extends Service {
    @Override public IBinder onBind(Intent intent) { return null; }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
      capture(this, "service.json", intent);
      NotificationManager manager = getSystemService(NotificationManager.class);
      manager.createNotificationChannel(new NotificationChannel("test", "Test", NotificationManager.IMPORTANCE_LOW));
      startForeground(1, new Notification.Builder(this, "test").setContentTitle("Quote test").setSmallIcon(android.R.drawable.ic_dialog_info).build());
      return START_NOT_STICKY;
    }
    @Override public void onDestroy() { write(this, "stopped.txt", "stopped"); super.onDestroy(); }
  }
  public static class Tile extends android.service.quicksettings.TileService {}
}
