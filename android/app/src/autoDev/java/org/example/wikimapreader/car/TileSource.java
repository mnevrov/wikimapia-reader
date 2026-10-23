package org.example.wikimapreader.car;
import android.content.Context;
import android.graphics.*;
import android.net.http.HttpResponseCache;
import java.io.*;
import java.net.*;
import java.util.*;
import java.util.concurrent.*;
/** Only tiles needed by the current surface; bounded memory and HTTP disk cache. */
final class TileSource implements AutoCloseable {
 private final Map<String,Bitmap> memory=new LinkedHashMap<>(64,.75f,true);
 private final Set<String> pending=new HashSet<>();private final Map<String,Long> failed=new HashMap<>();
 private final ExecutorService io=Executors.newFixedThreadPool(2);private volatile boolean closed;
 TileSource(Context c){try{if(HttpResponseCache.getInstalled()==null)HttpResponseCache.install(new File(c.getCacheDir(),"osm-http"),32L*1024*1024);}catch(IOException ignored){}}
 synchronized Bitmap get(int z,int x,int y,Runnable done){int n=1<<z;if(y<0||y>=n)return null;x=((x%n)+n)%n;String key=z+"/"+x+"/"+y;Bitmap b=memory.get(key);if(b!=null)return b;if(closed||pending.size()>=8||pending.contains(key)||failed.getOrDefault(key,0L)>System.currentTimeMillis())return null;pending.add(key);io.execute(()->{HttpURLConnection c=null;try{if(closed)return;c=(HttpURLConnection)new URL("https://tile.openstreetmap.org/"+key+".png").openConnection();c.setConnectTimeout(8000);c.setReadTimeout(8000);c.setUseCaches(true);c.setInstanceFollowRedirects(false);c.setRequestProperty("User-Agent","WikiReader-AutoDev/0.7.3 (+https://github.com/mnevrov/wikimapia-reader)");if(c.getResponseCode()!=200)throw new IOException();byte[] raw=WikiApi.read(c.getInputStream(),512*1024);Bitmap image=BitmapFactory.decodeByteArray(raw,0,raw.length);if(image==null)throw new IOException();synchronized(this){if(!closed){memory.put(key,image);while(memory.size()>48)memory.remove(memory.keySet().iterator().next());}}}catch(Exception e){synchronized(this){failed.put(key,System.currentTimeMillis()+60000);if(failed.size()>128)failed.clear();}}finally{if(c!=null)c.disconnect();synchronized(this){pending.remove(key);}if(!closed)done.run();}});return null;}
 @Override public synchronized void close(){closed=true;io.shutdownNow();memory.clear();pending.clear();failed.clear();}
}
