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

/** OSM or official Yandex Tiles API; bounded, cached and rate-limited. */
final class TileSource implements AutoCloseable {
 static final int MAX_MEMORY_TILES=128;
 private static final int MAX_PENDING=8;
 // 125 ms means <=8 Yandex requests/s from this process, well below the free 30 RPS.
 private static long nextYandexRequestAt;
 private final Map<String,Bitmap> memory=new LinkedHashMap<>(64,.75f,true);
 private final Set<String> pending=new HashSet<>();
 private final Map<String,Long> failed=new HashMap<>();
 private final ExecutorService io=Executors.newFixedThreadPool(2);
 private final YandexTileSettings settings;
 private volatile boolean closed;
 private volatile long yandexBlockedUntil;
 TileSource(Context context){
  settings=YandexTileSettings.get(context);
  try{if(HttpResponseCache.getInstalled()==null)
   HttpResponseCache.install(new File(context.getCacheDir(),"osm-http"),32L*1024*1024);}
  catch(IOException ignored){}
 }
 String source(){return "yandex".equals(settings.selected())&&System.currentTimeMillis()>=yandexBlockedUntil?"yandex":"osm";}
 synchronized Bitmap get(int z,int x,int y,Runnable done){
  int n=1<<z;if(y<0||y>=n)return null;
  x=((x%n)+n)%n;
  String tile=z+"/"+x+"/"+y;
  String provider=source(),key=provider+":"+tile;
  Bitmap hit=memory.get(key);if(hit!=null)return hit;
  if("yandex".equals(provider)&&failed.getOrDefault(key,0L)>System.currentTimeMillis())
   return osm(z,x,y,done);
  queue(provider,z,x,y,done);
  // Preserve OSM as fallback without faking Yandex status while loading.
  if("yandex".equals(provider))return memory.get("osm:"+tile);
  return null;
 }
 private synchronized Bitmap osm(int z,int x,int y,Runnable done){
  String key="osm:"+z+"/"+x+"/"+y;
  Bitmap hit=memory.get(key);if(hit!=null)return hit;
  queue("osm",z,x,y,done);return null;
 }
 private synchronized void queue(String provider,int z,int x,int y,Runnable done){
  String key=provider+":"+z+"/"+x+"/"+y;
  if(closed||pending.size()>=MAX_PENDING||pending.contains(key)
   ||failed.getOrDefault(key,0L)>System.currentTimeMillis())return;
  pending.add(key);
  try{io.execute(()->{
   boolean fallback=false;HttpURLConnection connection=null;
   try{
    if(closed)return;
    boolean isYandex="yandex".equals(provider);
    String endpoint;
    if(isYandex){
     String secret=settings.getKey();
     if(secret==null)throw new IOException("Tiles API unavailable");
     throttleYandex();
     endpoint=YandexTileRequest.url(secret,z,x,y);
    }else endpoint="https://tile.openstreetmap.org/"+z+"/"+x+"/"+y+".png";
    connection=(HttpURLConnection)new URL(endpoint).openConnection();
    connection.setConnectTimeout(8000);connection.setReadTimeout(8000);
    // Never cache URLs containing an API key on disk.
    connection.setUseCaches(!isYandex);
    connection.setInstanceFollowRedirects(false);
    connection.setRequestProperty("User-Agent","WikiReader/0.15.0 (+https://github.com/mnevrov/wikimapia-reader)");
    int status=connection.getResponseCode();
    if(status!=200){
     if(isYandex&&status==403||isYandex&&status==429)
      yandexBlockedUntil=System.currentTimeMillis()+YandexTileRequest.backoff(status);
     throw new IOException("Tile HTTP status "+status);
    }
    String type=connection.getContentType();
    if(type!=null&&!type.toLowerCase(Locale.ROOT).startsWith("image/"))
     throw new IOException("Non-image response");
    byte[] data=WikiApi.read(connection.getInputStream(),isYandex?2*1024*1024:512*1024);
    Bitmap bitmap=BitmapFactory.decodeByteArray(data,0,data.length);
    if(bitmap==null)throw new IOException("Invalid tile image");
    synchronized(this){if(!closed){
     memory.put(key,bitmap);
     while(memory.size()>MAX_MEMORY_TILES)memory.remove(memory.keySet().iterator().next());
    }}
   }catch(Exception error){
    fallback="yandex".equals(provider);
    synchronized(this){
     failed.put(key,System.currentTimeMillis()+(fallback?90000:60000));
     if(failed.size()>256)failed.clear();
    }
   }finally{
    if(connection!=null)connection.disconnect();
    synchronized(this){pending.remove(key);}
    if(!closed){
     if(fallback)osm(z,x,y,done);
     done.run();
    }
   }
  });}catch(RejectedExecutionException ex){pending.remove(key);}
 }
 private static synchronized void throttleYandex()throws InterruptedException{
  long now=System.currentTimeMillis();
  long wait=Math.max(0,nextYandexRequestAt-now);
  if(wait>0)Thread.sleep(wait);
  nextYandexRequestAt=Math.max(System.currentTimeMillis(),nextYandexRequestAt)+125L;
 }
 @Override public synchronized void close(){
  closed=true;io.shutdownNow();memory.clear();pending.clear();failed.clear();
 }
}
