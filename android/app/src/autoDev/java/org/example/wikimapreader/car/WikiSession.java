package org.example.wikimapreader.car;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import androidx.annotation.NonNull;
import androidx.car.app.AppManager;
import androidx.car.app.CarContext;
import androidx.car.app.Screen;
import androidx.car.app.Session;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;
import java.util.Arrays;

/** Projected session owns location subscriptions; the map stays alive while the driver is moving. */
public final class WikiSession extends Session implements DefaultLifecycleObserver,LocationListener {
 CarStore store;
 Viewport view;
 MapRenderer renderer;
 WikiScreen root;
 double[] gps;
 String gpsStatus="Нет GPS: последняя позиция карты";
 private LocationManager location;
 private Location lastFix;
 private final Handler main=new Handler(Looper.getMainLooper());

 public WikiSession(){getLifecycle().addObserver(this);}

 @NonNull @Override public Screen onCreateScreen(@NonNull Intent intent){
  store=CarStore.get(getCarContext());
  view=store.viewport();
  root=new WikiScreen(getCarContext(),this);
  renderer=new MapRenderer(getCarContext(),view,new MapRenderer.Events(){
   @Override public void changed(){main.post(()->root.viewportChanged());}
   @Override public void tap(double lat,double lon){main.post(()->root.tap(lat,lon));}
  });
  if(getCarContext().getCarAppApiLevel()>=7)
   getCarContext().getCarService(AppManager.class).setSurfaceCallback(renderer);
  return root;
 }

 @Override public void onStart(@NonNull LifecycleOwner owner){startLocation();}

 void startLocation(){
  CarContext c=getCarContext();
  boolean fine=c.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED;
  boolean coarse=fine||c.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED;
  if(!coarse){gpsStatus="Разрешите геопозицию для AutoDev на телефоне";if(root!=null)root.refresh();return;}
  try{
   if(location==null)location=(LocationManager)c.getSystemService(Context.LOCATION_SERVICE);
   if(location==null){gpsStatus="Служба геопозиции недоступна";return;}
   location.removeUpdates(this);
   // Android Auto is projected from the phone, not a separate GPS receiver.
   // Subscribe to both sources: GPS can disappear in a city canyon while network remains available.
   boolean subscribed=false;
   for(String provider:new String[]{LocationManager.GPS_PROVIDER,LocationManager.NETWORK_PROVIDER}){
    if(provider.equals(LocationManager.GPS_PROVIDER)&&!fine)continue;
    if(!location.isProviderEnabled(provider))continue;
    subscribed=true;
    Location old=location.getLastKnownLocation(provider);
    if(old!=null&&System.currentTimeMillis()-old.getTime()<120000)onLocationChanged(old);
    location.requestLocationUpdates(provider,1000L,0f,this,Looper.getMainLooper());
   }
   if(!subscribed)gpsStatus="Включите геолокацию на телефоне";
  }catch(SecurityException|IllegalArgumentException e){gpsStatus="Местоположение недоступно";}
  if(root!=null)root.refresh();
 }

 void permission(){
  getCarContext().requestPermissions(
   Arrays.asList(Manifest.permission.ACCESS_COARSE_LOCATION,Manifest.permission.ACCESS_FINE_LOCATION),
   (approved,rejected)->{startLocation();if(root!=null)root.refresh();});
 }

 /** Reject stale or extremely imprecise fixes rather than moving the map to a wrong position. */
 static boolean acceptFix(Location candidate,Location previous){
  if(candidate==null||!Double.isFinite(candidate.getLatitude())||!Double.isFinite(candidate.getLongitude()))return false;
  if(candidate.hasAccuracy()&&candidate.getAccuracy()>1500f)return false;
  if(previous==null)return true;
  long ageMs=(candidate.getElapsedRealtimeNanos()-previous.getElapsedRealtimeNanos())/1_000_000;
  return ageMs>=-2000 || (candidate.hasAccuracy()&&previous.hasAccuracy()
    &&candidate.getAccuracy()+30<previous.getAccuracy()&&ageMs>=-8000);
 }

 @Override public void onLocationChanged(@NonNull Location p){
  if(!acceptFix(p,lastFix))return;
  lastFix=new Location(p);
  gps=new double[]{p.getLatitude(),p.getLongitude()};
  gpsStatus=p.hasAccuracy()?"GPS ±"+Math.round(p.getAccuracy())+" м":"Положение получено";
  boolean follow;
  synchronized(view){
   follow=view.follow;
   if(follow){view.lat=gps[0];view.lon=gps[1];}
  }
  if(root!=null){
   // Repaint on every fix; fetching contours is separately distance-throttled.
   if(follow)root.viewportChanged(true);
   root.refresh();
  }
 }

 @Override public void onProviderDisabled(@NonNull String provider){
  if(location!=null && !location.isProviderEnabled(LocationManager.GPS_PROVIDER)
   && !location.isProviderEnabled(LocationManager.NETWORK_PROVIDER))
   gpsStatus="Геолокация отключена";
  if(root!=null)root.refresh();
 }
 @Override public void onStop(@NonNull LifecycleOwner owner){
  if(location!=null)location.removeUpdates(this);
  if(root!=null)root.suspend();
 }
 @Override public void onDestroy(@NonNull LifecycleOwner owner){
  if(root!=null)root.dispose();
  if(renderer!=null)renderer.close();
  if(location!=null)location.removeUpdates(this);
 }
 @Override public void onCarConfigurationChanged(@NonNull Configuration config){
  if(renderer!=null)renderer.draw();
  if(root!=null)root.refresh();
 }
}
