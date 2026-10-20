package org.example.wikimapreader;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppearancePlugin.class);
        registerPlugin(CredentialsVaultPlugin.class);
        registerPlugin(WikiReaderTransferPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
