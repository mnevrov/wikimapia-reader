package org.example.wikimapreader;

import android.os.Bundle;
import android.content.Intent;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppearancePlugin.class);
        registerPlugin(CredentialsVaultPlugin.class);
        try { registerPlugin((Class<? extends com.getcapacitor.Plugin>) Class.forName("org.example.wikimapreader.car.CarDataPlugin")); }
        catch (ClassNotFoundException ignored) { /* mobile has no car dependencies */ }
        super.onCreate(savedInstanceState);
    }
    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (getBridge() != null) getBridge().triggerWindowJSEvent("wikireadercaropen", "{}");
    }
}


