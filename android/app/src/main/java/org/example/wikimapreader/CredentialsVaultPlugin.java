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
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private CredentialRepository repository(){return new CredentialRepository(getContext());}
    @Override protected void handleOnDestroy(){worker.shutdown();}
    @PluginMethod public void load(PluginCall call){worker.execute(()->{
        try{
            String key=repository().load();JSObject result=new JSObject();
            if(key!=null)result.put("key",key);
            call.resolve(result);
        }catch(Exception ignored){call.reject("Не удалось прочитать сохранённый ключ. Введите его заново.","VAULT_READ_FAILED");}
    });}
    @PluginMethod public void save(PluginCall call){
        String value=call.getString("key");
        if(value==null||value.trim().isEmpty()||value.length()>4096){call.reject("Некорректный ключ","INVALID_KEY");return;}
        worker.execute(()->{try{
            repository().save(value);
            call.resolve();
        }catch(Exception ignored){call.reject("Ключ не сохранён на устройстве. Попробуйте ещё раз.","VAULT_WRITE_FAILED");}});
    }
    @PluginMethod public void clear(PluginCall call){worker.execute(()->{try{
        repository().clear();call.resolve();
    }catch(Exception ignored){call.reject("Не удалось удалить сохранённый ключ. Повторите действие.","VAULT_CLEAR_FAILED");}});}
}

