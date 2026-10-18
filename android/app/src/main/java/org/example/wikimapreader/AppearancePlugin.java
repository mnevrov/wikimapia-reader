package org.example.wikimapreader;

import android.graphics.Color;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Only appearance is passed over this bridge; no credentials or URLs. */
@CapacitorPlugin(name = "Appearance")
public class AppearancePlugin extends Plugin {
    @PluginMethod
    public void apply(PluginCall call) {
        String theme = call.getString("theme", "dark");
        if (!"dark".equals(theme) && !"light".equals(theme)) {
            call.reject("Unsupported appearance");
            return;
        }
        boolean light = "light".equals(theme);
        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(window, window.getDecorView());
            bars.setAppearanceLightStatusBars(light);
            bars.setAppearanceLightNavigationBars(light);
            // Android 15+ draws bars over the app; these colours support older Android versions.
            window.setStatusBarColor(light ? Color.WHITE : Color.BLACK);
            window.setNavigationBarColor(light ? Color.WHITE : Color.BLACK);
            getBridge().getWebView().setBackgroundColor(light ? Color.WHITE : Color.BLACK);
            call.resolve();
        });
    }
}
