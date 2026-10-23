package org.example.wikimapreader;
import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.security.KeyStore;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
public final class CredentialRepository {
 private final Context context;
 public CredentialRepository(Context context){this.context=context.getApplicationContext();}
    private static final String ALIAS="wikireader.api-key.v1";
    private SharedPreferences prefs(){return context.getSharedPreferences("credentials-v1",Context.MODE_PRIVATE);}
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

 public synchronized String load() throws Exception {String s=prefs().getString("record",null);return s==null?null:CredentialCipher.decrypt(Base64.decode(s,Base64.NO_WRAP),secret(false));}
 public synchronized void save(String value) throws Exception {if(value==null||value.trim().isEmpty()||value.length()>4096)throw new IllegalArgumentException();byte[] b=CredentialCipher.encrypt(value.trim(),secret(true));if(!prefs().edit().putString("record",Base64.encodeToString(b,Base64.NO_WRAP)).commit())throw new java.io.IOException();}
 public synchronized void clear() throws Exception {if(!prefs().edit().remove("record").commit())throw new java.io.IOException();keyStore().deleteEntry(ALIAS);}
}
