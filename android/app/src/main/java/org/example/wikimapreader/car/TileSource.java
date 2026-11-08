package org.example.wikimapreader.car;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.http.HttpResponseCache;
import java.io.File;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.*;
import java.util.concurrent.*;

/** Native Yandex/OSM tile source: honest provider status, bounded caching and recovery. */
final class TileSource implements AutoCloseable {
 static final int MAX_MEMORY_TILES=128;
 private static final int MAX_PENDING=8;
 // <=8 Yandex requests/s from this process, under the documented 30 RPS limit.
 private static long nextYandexRequestAt;
 private final Map<String,Bitmap> memory=new LinkedHashMap<>(64,.75f,true);
 private final Set<String> pending=new HashSet<>();
 private final Map<String,Long> failed=new HashMap<>();
 private final ExecutorService io=Executors.newFixedThreadPool(2);
 private final YandexTileSettings settings;
 private final Runnable stateChanged;
 private volatile boolean closed;
 private int epoch, lastRevision=-1;
 private boolean confirmedYandex;
 private long yandexBlockedUntil;
 private String failureReason="";

 TileSource(Context context,Runnable stateChanged){
  settings=YandexTileSettings.get(context);
  this.stateChanged=stateChanged;
  try{if(HttpResponseCache.getInstalled()==null)
    HttpResponseCache.install(new File(context.getCacheDir(),"osm-http"),32L*1024*1024);}
  catch(IOException ignored){}
 }
 private void syncSettings(){
  int revision=settings.revision();
  if(lastRevision==revision)return;
  lastRevision=revision;epoch++;
  confirmedYandex=false;yandexBlockedUntil=0;failureReason="";
  memory.keySet().removeIf(key->key.startsWith("yandex:"));
  failed.keySet().removeIf(key->key.startsWith("yandex:"));
 }
 /** Desired provider for scheduling; do not confuse it with confirmed displayed tiles. */
 synchronized String source(){
  syncSettings();
  return "yandex".equals(settings.selected())&&System.currentTimeMillis()>=yandexBlockedUntil
   ?"yandex":"osm";
 }
 synchronized boolean displaysYandex(){
  return "yandex".equals(source())&&confirmedYandex;
 }
 synchronized String status(){
  syncSettings();
  if(!"yandex".equals(settings.selected()))return "Подложка: OpenStreetMap";
  if(System.currentTimeMillis()<yandexBlockedUntil)
   return "Яндекс: "+failureReason+" · резервная OSM";
  if(!confirmedYandex)return "Яндекс: загружаем тайлы…";
  return "Подложка: Яндекс Tiles API";
 }
 synchronized Bitmap get(int z,int x,int y,Runnable done){
  if(z<0||z>20)return null;
  int n=1<<z;if(y<0||y>=n)return null;
  x=((x%n)+n)%n;
  String provider=source(),tile=z+"/"+x+"/"+y,key=provider+":"+tile;
  Bitmap cached=memory.get(key);if(cached!=null)return cached;
  // All-or-nothing fallback per request: never silently label OSM as Yandex.
  if(failed.getOrDefault(key,0L)>System.currentTimeMillis())return null;
  queue(provider,z,x,y,done);
  return null;
 }
 private synchronized void queue(String provider,int z,int x,int y,Runnable done){
  final int requestEpoch=epoch;
  String key=provider+":"+z+"/"+x+"/"+y;
  String requestKey=key+"#"+requestEpoch;
  if(closed||pending.size()>=MAX_PENDING||pending.contains(requestKey)
    ||failed.getOrDefault(key,0L)>System.currentTimeMillis())return;
  pending.add(requestKey);
  try{io.execute(()->{
   HttpURLConnection connection=null;int responseCode=0;boolean notify=false;
   final boolean yandex="yandex".equals(provider);
   try{
    if(closed)return;
    String endpoint;
    if(yandex){
     String apiKey=settings.getKey();
     if(apiKey==null)throw new IOException("No Tiles API key");
     throttleYandex();
     endpoint=YandexTileRequest.url(apiKey,z,x,y);
    }else endpoint="https://tile.openstreetmap.org/"+z+"/"+x+"/"+y+".png";
    connection=(HttpURLConnection)new URL(endpoint).openConnection();
    connection.setConnectTimeout(8000);connection.setReadTimeout(10000);
    // Never write credentials in cache keys or diagnostic output.
    connection.setUseCaches(!yandex);
    connection.setInstanceFollowRedirects(false);
    connection.setRequestProperty("User-Agent","WikiReader/0.15.0 (+https://github.com/mnevrov/wikimapia-reader)");
    responseCode=connection.getResponseCode();
    if(responseCode!=200)throw new IOException("Tile HTTP "+responseCode);
    // Decode a limited response; some CDNs use application/octet-stream for PNG.
    byte[] bytes=WikiApi.read(connection.getInputStream(),2*1024*1024);
    Bitmap bitmap=BitmapFactory.decodeByteArray(bytes,0,bytes.length);
    if(bitmap==null)throw new IOException("Tile image could not be decoded");
    synchronized(this){
     if(closed||requestEpoch!=epoch)return;
     memory.put(key,bitmap);
     while(memory.size()>MAX_MEMORY_TILES)memory.remove(memory.keySet().iterator().next());
     if(yandex&&!confirmedYandex){confirmedYandex=true;failureReason="";notify=true;}
    }
   }catch(Exception error){
    synchronized(this){
     if(!closed&&requestEpoch==epoch){
      if(yandex){
       long delay=YandexTileRequest.backoff(responseCode);
       yandexBlockedUntil=System.currentTimeMillis()+delay;
       confirmedYandex=false;
       failureReason=errorLabel(responseCode,error);
       notify=true;
      }else{
       failed.put(key,System.currentTimeMillis()+45000L);
       if(failed.size()>256)failed.clear();
      }
     }
    }
   }finally{
    if(connection!=null)connection.disconnect();
    synchronized(this){pending.remove(requestKey);}
    if(!closed){
     if(notify)stateChanged.run();
     done.run();
    }
   }
  });}catch(RejectedExecutionException e){pending.remove(requestKey);}
 }
 static String errorLabel(int status,Exception error){
  if(status==400)return "HTTP 400 (параметры запроса)";
  if(status==401||status==403)return "HTTP "+status+" (проверьте ключ Tiles API)";
  if(status==429)return "HTTP 429 (лимит запросов)";
  if(status>=400)return "HTTP "+status;
  return "ошибка сети или ответа сервера";
 }
 private static synchronized void throttleYandex()throws InterruptedException{
  long wait=Math.max(0,nextYandexRequestAt-System.currentTimeMillis());
  if(wait>0)Thread.sleep(wait);
  nextYandexRequestAt=Math.max(System.currentTimeMillis(),nextYandexRequestAt)+125L;
 }
 @Override public synchronized void close(){
  closed=true;io.shutdownNow();memory.clear();pending.clear();failed.clear();
 }
}
