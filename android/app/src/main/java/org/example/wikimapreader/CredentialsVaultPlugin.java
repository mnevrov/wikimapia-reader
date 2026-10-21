package org.example.wikimapreader;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.security.KeyStore;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;

/** Only ciphertext is persisted. Native methods are serialized off the UI thread. */
@CapacitorPlugin(name="CredentialsVault")
public class CredentialsVaultPlugin extends Plugin {
    private static final String ALIAS="wikireader.api-key.v1";
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private SharedPreferences prefs(){return getContext().getSharedPreferences("credentials-v1",Context.MODE_PRIVATE);}
    private KeyStore keyStore() throws Exception {KeyStore s=KeyStore.getInstance("AndroidKeyStore");s.load(null);return s;}
    private SecretKey secret(boolean create) throws Exception {
        KeyStore s=keyStore();SecretKey key=(SecretKey)s.getKey(ALIAS,null);
        if(key!=null)return key;
        if(!create)throw new java.security.GeneralSecurityException("Missing key");
        KeyGenerator g=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
        g.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256).setRandomizedEncryptionRequired(true).build());
        return g.generateKey();
    }
    @Override protected void handleOnDestroy(){worker.shutdown();}
    @PluginMethod public void load(PluginCall call){worker.execute(()->{
        try{
            String encoded=prefs().getString("record",null);JSObject result=new JSObject();
            if(encoded!=null)result.put("key",CredentialCipher.decrypt(Base64.decode(encoded,Base64.NO_WRAP),secret(false)));
            call.resolve(result);
        }catch(Exception ignored){call.reject("Не удалось прочитать сохранённый ключ. Введите его заново.","VAULT_READ_FAILED");}
    });}
    @PluginMethod public void save(PluginCall call){
        String value=call.getString("key");
        if(value==null||value.trim().isEmpty()||value.length()>4096){call.reject("Некорректный ключ","INVALID_KEY");return;}
        worker.execute(()->{try{
            byte[] encrypted=CredentialCipher.encrypt(value.trim(),secret(true));
            if(!prefs().edit().putString("record",Base64.encodeToString(encrypted,Base64.NO_WRAP)).commit())throw new java.io.IOException();
            call.resolve();
        }catch(Exception ignored){call.reject("Ключ не сохранён на устройстве. Попробуйте ещё раз.","VAULT_WRITE_FAILED");}});
    }
    @PluginMethod public void clear(PluginCall call){worker.execute(()->{try{
        if(!prefs().edit().remove("record").commit())throw new java.io.IOException();
        keyStore().deleteEntry(ALIAS);call.resolve();
    }catch(Exception ignored){call.reject("Не удалось удалить сохранённый ключ. Повторите действие.","VAULT_CLEAR_FAILED");}});}
}
