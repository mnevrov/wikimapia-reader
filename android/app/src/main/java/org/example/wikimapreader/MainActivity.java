package org.example.wikimapreader;

import android.os.Bundle;
import android.content.Intent;
import com.getcapacitor.BridgeActivity;
import org.example.wikimapreader.car.CarDataPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppearancePlugin.class);
        registerPlugin(WikiReaderSitePlugin.class);
        registerPlugin(CredentialsVaultPlugin.class);
        registerPlugin(WikiReaderTransferPlugin.class);
        registerPlugin(CarDataPlugin.class);
        super.onCreate(savedInstanceState);
    }
    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (getBridge() != null) getBridge().triggerWindowJSEvent("wikireadercaropen", "{}");
    }
}
