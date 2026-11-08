package org.example.wikimapreader.car;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.IBinder;
import android.os.Looper;
import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;
import java.util.concurrent.CopyOnWriteArraySet;
import org.example.wikimapreader.MainActivity;

/** Explicitly started from the foreground AutoDev phone UI; no silent background tracking. */
public final class CarLocationService extends Service implements LocationListener {
 private static final String CHANNEL="wikireader-auto-gps";
 private static final int NOTIFICATION_ID=43;
 private static final CopyOnWriteArraySet<Observer> OBSERVERS=new CopyOnWriteArraySet<>();
 private static volatile boolean running;
 private static volatile Location last;
 private LocationManager location;
 interface Observer {void onFix(Location fix);}
 static boolean isRunning(){return running;}
 static void subscribe(Observer observer){
  OBSERVERS.add(observer);
  Location saved=last;
  if(saved!=null&&System.currentTimeMillis()-saved.getTime()<120000)
   observer.onFix(new Location(saved));
 }
 static void unsubscribe(Observer observer){OBSERVERS.remove(observer);}
 static void start(Context context){
  ContextCompat.startForegroundService(context,
   new Intent(context,CarLocationService.class));
 }
 static void stop(Context context){
  context.stopService(new Intent(context,CarLocationService.class));
 }
 @Override public void onCreate(){
  super.onCreate();
  if(Build.VERSION.SDK_INT>=26){
   NotificationChannel channel=new NotificationChannel(CHANNEL,"WikiReader Android Auto GPS",
    NotificationManager.IMPORTANCE_LOW);
   channel.setDescription("Слежение за положением для карты WikiReader в автомобиле");
   getSystemService(NotificationManager.class).createNotificationChannel(channel);
  }
 }
 @Override public int onStartCommand(Intent intent,int flags,int startId){
  boolean fine=ContextCompat.checkSelfPermission(this,Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED;
  boolean coarse=fine||ContextCompat.checkSelfPermission(this,Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED;
  if(!coarse){stopSelf();return START_NOT_STICKY;}
  try{
   Intent toApp=new Intent(this,MainActivity.class)
    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP);
   PendingIntent pending=PendingIntent.getActivity(this,43,toApp,
    PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
   Notification.Builder builder=Build.VERSION.SDK_INT>=26?
    new Notification.Builder(this,CHANNEL):new Notification.Builder(this);
   Notification notification=builder.setSmallIcon(org.example.wikimapreader.R.drawable.car_my_location)
    .setContentTitle("WikiReader AutoDev · GPS Follow")
    .setContentText("Геопозиция используется для карты Android Auto")
    .setContentIntent(pending).setOngoing(true).build();
   if(Build.VERSION.SDK_INT>=29)
    startForeground(NOTIFICATION_ID,notification,ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
   else startForeground(NOTIFICATION_ID,notification);
   running=true;
   location=(LocationManager)getSystemService(Context.LOCATION_SERVICE);
   if(location!=null){
    for(String provider:new String[]{LocationManager.GPS_PROVIDER,LocationManager.NETWORK_PROVIDER}){
     if(provider.equals(LocationManager.GPS_PROVIDER)&&!fine)continue;
     if(!location.isProviderEnabled(provider))continue;
     location.requestLocationUpdates(provider,1000L,0f,this,Looper.getMainLooper());
     Location previous=location.getLastKnownLocation(provider);
     if(previous!=null&&System.currentTimeMillis()-previous.getTime()<120000)onLocationChanged(previous);
    }
   }
  }catch(SecurityException|IllegalStateException|IllegalArgumentException e){
   running=false;stopSelf();return START_NOT_STICKY;
  }
  return START_NOT_STICKY;
 }
 @Override public void onLocationChanged(Location fix){
  if(!Double.isFinite(fix.getLatitude())||!Double.isFinite(fix.getLongitude()))return;
  last=new Location(fix);
  for(Observer observer:OBSERVERS)observer.onFix(new Location(fix));
 }
 @Override public void onDestroy(){
  if(location!=null)location.removeUpdates(this);
  running=false;last=null;
  super.onDestroy();
 }
 @Nullable @Override public IBinder onBind(Intent intent){return null;}
}
