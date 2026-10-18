package org.example.wikimapreader.car;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.*;
import org.example.wikimapreader.CredentialRepository;
import java.util.concurrent.*;
@CapacitorPlugin(name="CarData")
public class CarDataPlugin extends Plugin {
 private final ExecutorService io=Executors.newSingleThreadExecutor();
 private CarStore store(){return CarStore.get(getContext());}
 @PluginMethod public void sync(PluginCall call){io.execute(()->{try{JSONArray legacy=call.getArray("legacy",new JSArray()),ops=call.getArray("operations",new JSArray());JSObject r=new JSObject();r.put("favorites",store().sync(legacy,ops,true));call.resolve(r);}catch(Exception e){call.reject("Данные не синхронизированы");}});}
 @PluginMethod public void areas(PluginCall call){io.execute(()->{try{JSArray rows=call.getArray("entries",new JSArray());for(int i=0;i<rows.length();i++)store().putArea(rows.getJSONObject(i));JSObject r=new JSObject();r.put("entries",store().areas());call.resolve(r);}catch(Exception e){call.reject("Кэш не синхронизирован");}});}
 @PluginMethod public void cache(PluginCall call){io.execute(()->{try{JSONObject r=store().cache(call.getString("action","read"),call.getObject("options",new JSObject()));call.resolve(JSObject.fromJSONObject(r));}catch(Exception e){call.reject("Не удалось изменить кэш");}});}
 @PluginMethod public void pending(PluginCall call){io.execute(()->{try{JSObject r=new JSObject();r.put("id",store().consumePending());call.resolve(r);}catch(Exception e){call.reject("Не удалось прочитать выбранный объект");}});}
 @PluginMethod public void request(PluginCall call){String id=call.getString("requestId");String method=call.getString("method");if(id==null||method==null){call.reject("Некорректный запрос");return;}WikiApi.INSTANCE.request("web:"+id,new CredentialRepository(getContext()),method,call.getObject("options",new JSObject()),(data,error)->{if(error!=null)call.reject(error);else{JSObject r=new JSObject();r.put("data",data);call.resolve(r);}});}
 @PluginMethod public void cancel(PluginCall call){WikiApi.INSTANCE.cancel("web:"+call.getString("requestId"));call.resolve();}
 @Override protected void handleOnDestroy(){io.shutdown();}
}
