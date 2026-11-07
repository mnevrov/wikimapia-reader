package org.example.wikimapreader.car;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Arrays;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Separate per-installation Tiles API secret. Never returned to the JavaScript layer. */
public final class YandexTileSettings {
 private static final String ALIAS="wikireader.yandex-tiles.v1";
 private static final byte[] AAD="wikireader:yandex-tiles-key:v1".getBytes(StandardCharsets.UTF_8);
 private static volatile YandexTileSettings instance;
 private final Context app;
 private final SharedPreferences preferences;
 private volatile String cachedKey;

 public static synchronized YandexTileSettings get(Context context){
  if(instance==null)instance=new YandexTileSettings(context);
  return instance;
 }
 private YandexTileSettings(Context context){
  app=context.getApplicationContext();
  preferences=app.getSharedPreferences("car-tiles-v1",Context.MODE_PRIVATE);
 }
 private KeyStore keyStore()throws Exception {
  KeyStore s=KeyStore.getInstance("AndroidKeyStore");s.load(null);return s;
 }
 private SecretKey secret(boolean create)throws Exception {
  KeyStore store=keyStore();SecretKey k=(SecretKey)store.getKey(ALIAS,null);
  if(k!=null)return k;
  if(!create)throw new GeneralSecurityException("Missing key");
  KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
  generator.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
   .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
   .setKeySize(256).setRandomizedEncryptionRequired(true).build());
  return generator.generateKey();
 }
 static boolean valid(String value){return value!=null&&value.matches("[A-Za-z0-9_\\-]{16,128}");}
 public synchronized boolean configured(){
  return getKey()!=null;
 }
 public synchronized String getKey(){
  if(cachedKey!=null)return cachedKey;
  String record=preferences.getString("key",null);
  if(record==null)return null;
  try{
   byte[] raw=Base64.decode(record,Base64.NO_WRAP);
   if(raw.length<29||raw[0]!=1)throw new GeneralSecurityException("Invalid record");
   Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
   cipher.init(Cipher.DECRYPT_MODE,secret(false),new GCMParameterSpec(128,Arrays.copyOfRange(raw,1,13)));
   cipher.updateAAD(AAD);
   String value=new String(cipher.doFinal(raw,13,raw.length-13),StandardCharsets.UTF_8);
   if(!valid(value))throw new GeneralSecurityException("Invalid key");
   cachedKey=value;return value;
  }catch(Exception ex){return null;}
 }
 public synchronized void saveKey(String value)throws Exception{
  if(value!=null)value=value.trim();
  if(!valid(value))throw new IllegalArgumentException("Tiles API key format");
  Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
  cipher.init(Cipher.ENCRYPT_MODE,secret(true));cipher.updateAAD(AAD);
  byte[] iv=cipher.getIV();if(iv.length!=12)throw new GeneralSecurityException("Unsupported IV");
  byte[] encrypted=cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
  byte[] record=new byte[1+iv.length+encrypted.length];record[0]=1;
  System.arraycopy(iv,0,record,1,iv.length);System.arraycopy(encrypted,0,record,13,encrypted.length);
  if(!preferences.edit().putString("key",Base64.encodeToString(record,Base64.NO_WRAP)).commit())
   throw new java.io.IOException("Unable to persist key");
  cachedKey=value;
 }
 public synchronized void clearKey()throws Exception{
  if(!preferences.edit().remove("key").putString("provider","osm").commit())
   throw new java.io.IOException("Unable to clear Tiles API key");
  cachedKey=null;
  try{keyStore().deleteEntry(ALIAS);}catch(Exception ignored){}
 }
 public synchronized String selected(){
  return "yandex".equals(preferences.getString("provider","osm"))&&configured()?"yandex":"osm";
 }
 public synchronized void select(String provider){
  if(!"osm".equals(provider)&&!"yandex".equals(provider))
   throw new IllegalArgumentException("Unsupported map provider");
  if("yandex".equals(provider)&&!configured())
   throw new IllegalStateException("Tiles API key is missing");
  if(!preferences.edit().putString("provider",provider).commit())
   throw new IllegalStateException("Cannot save map provider");
 }
}
