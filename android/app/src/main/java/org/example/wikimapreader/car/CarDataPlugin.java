package org.example.wikimapreader.car;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.*;
import org.example.wikimapreader.CredentialRepository;
import java.util.concurrent.*;
@CapacitorPlugin(name="CarData")
public class CarDataPlugin extends Plugin {
 private final java.util.Set<String> requests=java.util.concurrent.ConcurrentHashMap.newKeySet();
 private final ExecutorService io=Executors.newSingleThreadExecutor();
 private CarStore store(){return CarStore.get(getContext());}
 @PluginMethod public void sync(PluginCall call){io.execute(()->{try{JSONArray legacy=call.getArray("legacy",new JSArray()),ops=call.getArray("operations",new JSArray());JSObject r=new JSObject();r.put("favorites",store().sync(legacy,ops,true));call.resolve(r);}catch(Exception e){call.reject("Данные не синхронизированы");}});}
 @PluginMethod public void areas(PluginCall call){io.execute(()->{try{JSArray rows=call.getArray("entries",new JSArray());for(int i=0;i<rows.length();i++)store().putArea(rows.getJSONObject(i));JSObject r=new JSObject();r.put("entries",store().areas());call.resolve(r);}catch(Exception e){call.reject("Кэш не синхронизирован");}});}
 @PluginMethod public void cache(PluginCall call){io.execute(()->{try{JSONObject r=store().cache(call.getString("action","read"),call.getObject("options",new JSObject()));call.resolve(JSObject.fromJSONObject(r));}catch(Exception e){call.reject("Не удалось изменить кэш");}});}
 @PluginMethod public void pending(PluginCall call){io.execute(()->{try{JSObject r=new JSObject();r.put("id",store().consumePending());call.resolve(r);}catch(Exception e){call.reject("Не удалось прочитать выбранный объект");}});}
 @PluginMethod public void request(PluginCall call){String id=call.getString("requestId");String method=call.getString("method");if(id==null||method==null){call.reject("Некорректный запрос");return;}requests.add(id);WikiApi.INSTANCE.request("web:"+id,new CredentialRepository(getContext()),method,call.getObject("options",new JSObject()),(data,error)->{requests.remove(id);if(error!=null)call.reject(error);else{JSObject r=new JSObject();r.put("data",data);call.resolve(r);}});}
 @PluginMethod public void cancel(PluginCall call){WikiApi.INSTANCE.cancel("web:"+call.getString("requestId"));call.resolve();}
 /** Explicit user action from the phone is required on Android 14+ for a location FGS. */
 @PluginMethod public void gpsStatus(PluginCall call){
  JSObject result=new JSObject();result.put("running",CarLocationService.isRunning());call.resolve(result);
 }
 @PluginMethod public void gpsStart(PluginCall call){
  try{
   boolean fine=androidx.core.content.ContextCompat.checkSelfPermission(getContext(),
    android.Manifest.permission.ACCESS_FINE_LOCATION)==android.content.pm.PackageManager.PERMISSION_GRANTED;
   boolean coarse=fine||androidx.core.content.ContextCompat.checkSelfPermission(getContext(),
    android.Manifest.permission.ACCESS_COARSE_LOCATION)==android.content.pm.PackageManager.PERMISSION_GRANTED;
   if(!coarse){call.reject("Разрешите геопозицию для AutoDev на телефоне");return;}
   CarLocationService.start(getContext());
   JSObject result=new JSObject();result.put("starting",true);call.resolve(result);
  }catch(SecurityException|IllegalStateException e){
   call.reject("Запустите GPS Follow из открытого AutoDev на телефоне");
  }
 }
 @PluginMethod public void gpsStop(PluginCall call){
  CarLocationService.stop(getContext());call.resolve();
 }
 @Override protected void handleOnDestroy(){for(String id:requests)WikiApi.INSTANCE.cancel("web:"+id);requests.clear();io.shutdown();}
}
