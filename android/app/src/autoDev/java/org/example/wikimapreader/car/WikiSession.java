package org.example.wikimapreader.car;
import android.Manifest;
import android.content.*;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.location.*;
import android.os.*;
import androidx.annotation.NonNull;
import androidx.car.app.*;
import androidx.lifecycle.*;
import java.util.*;
public final class WikiSession extends Session implements DefaultLifecycleObserver,LocationListener {
 CarStore store;Viewport view;MapRenderer renderer;WikiScreen root;double[] gps;String gpsStatus="Нет GPS: последняя позиция карты";
 private LocationManager location;private final Handler main=new Handler(Looper.getMainLooper());
 public WikiSession(){getLifecycle().addObserver(this);}
 @NonNull @Override public Screen onCreateScreen(@NonNull Intent intent){store=CarStore.get(getCarContext());view=store.viewport();root=new WikiScreen(getCarContext(),this);renderer=new MapRenderer(getCarContext(),view,new MapRenderer.Events(){public void changed(){main.post(()->root.viewportChanged());}public void tap(double a,double b){main.post(()->root.tap(a,b));}});if(getCarContext().getCarAppApiLevel()>=7)getCarContext().getCarService(AppManager.class).setSurfaceCallback(renderer);return root;}
 @Override public void onStart(@NonNull LifecycleOwner owner){startLocation();}
 void startLocation(){CarContext c=getCarContext();if(c.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)!=PackageManager.PERMISSION_GRANTED&&c.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED){gpsStatus="Разрешите геопозицию на телефоне";return;}location=(LocationManager)c.getSystemService(Context.LOCATION_SERVICE);try{String provider=c.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED?LocationManager.GPS_PROVIDER:LocationManager.NETWORK_PROVIDER;if(location.isProviderEnabled(provider)){Location last=location.getLastKnownLocation(provider);if(last!=null&&System.currentTimeMillis()-last.getTime()<120000)onLocationChanged(last);location.requestLocationUpdates(provider,2000,10,this,Looper.getMainLooper());}else gpsStatus="GPS выключен: используется последняя карта";}catch(SecurityException|IllegalArgumentException e){gpsStatus="Местоположение недоступно";}}
 void permission(){getCarContext().requestPermissions(Arrays.asList(Manifest.permission.ACCESS_COARSE_LOCATION,Manifest.permission.ACCESS_FINE_LOCATION),(approved,rejected)->{startLocation();root.refresh();});}
 @Override public void onLocationChanged(@NonNull Location p){gps=new double[]{p.getLatitude(),p.getLongitude()};gpsStatus="GPS ±"+Math.round(p.getAccuracy())+" м";boolean follow; synchronized(view){follow=view.follow;if(follow){view.lat=gps[0];view.lon=gps[1];}}if(follow&&root!=null)root.viewportChanged();if(root!=null)root.refresh();}
 @Override public void onProviderDisabled(@NonNull String p){gpsStatus="Сигнал GPS недоступен";if(root!=null)root.refresh();}
 @Override public void onStop(@NonNull LifecycleOwner owner){if(location!=null)location.removeUpdates(this);if(root!=null)root.suspend();}
 @Override public void onDestroy(@NonNull LifecycleOwner owner){if(root!=null)root.dispose();if(renderer!=null)renderer.close();if(location!=null)location.removeUpdates(this);}
 @Override public void onCarConfigurationChanged(@NonNull Configuration c){if(renderer!=null)renderer.draw();if(root!=null)root.refresh();}
}
