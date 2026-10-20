package org.example.wikimapreader;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name="WikiReaderSite")
public class WikiReaderSitePlugin extends Plugin {
 private final ExecutorService worker=Executors.newFixedThreadPool(2);
 private final ConcurrentHashMap<String,AtomicBoolean> jobs=new ConcurrentHashMap<>();
 private final SiteHttp http=new SiteHttp();
 @PluginMethod public void request(PluginCall call){
  String id=call.getString("id"),url=call.getString("url"),body=call.getString("body");
  if(id==null||id.length()>32||url==null||jobs.size()>=16){call.reject("Запрос сайта отклонён");return;}
  AtomicBoolean cancelled=new AtomicBoolean();jobs.put(id,cancelled);
  worker.execute(()->{
   try{SiteHttp.Result r=http.get(url,body,cancelled);if(cancelled.get()){call.reject("Загрузка отменена");return;}
    JSObject result=new JSObject();result.put("status",r.status);result.put("text",r.text);result.put("finalUrl",r.url);call.resolve(result);
   }catch(Exception e){call.reject("Не удалось загрузить сайт Wikimapia");}finally{jobs.remove(id);}
  });
 }
 @PluginMethod public void cancel(PluginCall call){AtomicBoolean job=jobs.get(call.getString("id",""));if(job!=null)job.set(true);call.resolve();}
 @Override protected void handleOnDestroy(){for(AtomicBoolean job:jobs.values())job.set(true);worker.shutdownNow();super.handleOnDestroy();}
}
