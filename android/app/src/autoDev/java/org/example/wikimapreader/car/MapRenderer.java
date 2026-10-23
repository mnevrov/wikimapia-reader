package org.example.wikimapreader.car;
import android.graphics.*;
import android.view.Surface;
import androidx.car.app.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
final class MapRenderer implements SurfaceCallback,AutoCloseable {
 interface Events {void changed();void tap(double lat,double lon);}
 private final CarContext context;private final Viewport view;private final Events events;private final TileSource tiles;
 private final ExecutorService render=Executors.newSingleThreadExecutor();private final AtomicBoolean queued=new AtomicBoolean();
 private volatile boolean closed;private Surface surface;private int width=800,height=480;private Rect visible=new Rect(),stable=new Rect();
 private List<Place> places=Collections.emptyList();private long selected;private double[] gps;
 MapRenderer(CarContext c,Viewport v,Events e){context=c;view=v;events=e;tiles=new TileSource(c);}
 synchronized void update(List<Place> p,long selected,double[] gps){places=new ArrayList<>(p);this.selected=selected;this.gps=gps;draw();}
 @Override public synchronized void onSurfaceAvailable(SurfaceContainer c){if(surface!=null&&surface!=c.getSurface())surface.release();surface=c.getSurface();width=c.getWidth();height=c.getHeight();draw();}
 @Override public synchronized void onSurfaceDestroyed(SurfaceContainer c){if(surface!=null){surface.release();surface=null;}}
 @Override public synchronized void onVisibleAreaChanged(Rect r){visible=new Rect(r);draw();}
 @Override public synchronized void onStableAreaChanged(Rect r){stable=new Rect(r);draw();}
 /** The visible rectangle sets the map focal point; it does not limit surface drawing. */
 static Rect mapViewport(Rect visible,Rect stable,int width,int height){
  Rect surface=new Rect(0,0,Math.max(1,width),Math.max(1,height));
  Rect safe=new Rect();
  if(visible!=null&&!visible.isEmpty()&&safe.setIntersect(visible,surface))return safe;
  if(stable!=null&&!stable.isEmpty()&&safe.setIntersect(stable,surface))return safe;
  return surface;
 }
 /** Tiles cover the full host surface, including areas beneath overlays. */
 static int[] tileSpan(int surfaceSize,int safeOffset,int safeSize,double center,double tileSize){
  return new int[]{(int)Math.floor(center+(-safeOffset-safeSize/2.0)/tileSize)-1,
   (int)Math.ceil(center+(surfaceSize-safeOffset-safeSize/2.0)/tileSize)+1};
 }
 private Rect area(){return mapViewport(visible,stable,width,height);}
 @Override public void onScroll(float x,float y){synchronized(view){view.pan(x,y);}events.changed();draw();}
 @Override public void onScale(float x,float y,float scale){Rect a=area();synchronized(view){view.scale(scale,x-a.left,y-a.top,a.width(),a.height());view.follow=false;}events.changed();draw();}
 @Override public void onClick(float x,float y){double[] p;Rect a=area();synchronized(view){p=view.at(x-a.left,y-a.top,a.width(),a.height());}events.tap(p[0],p[1]);}
 private synchronized int offsetX(){return area().left;}private synchronized int offsetY(){return area().top;}
 synchronized int[] viewSize(){Rect a=area();return new int[]{a.width(),a.height()};}
 void zoom(int delta){synchronized(view){view.zoom=Math.max(10,Math.min(19,view.zoom+delta));}events.changed();draw();}
 void draw(){if(closed||!queued.compareAndSet(false,true))return;try{render.execute(()->{queued.set(false);if(!closed)frame();});}catch(RejectedExecutionException ignored){queued.set(false);}}
 private synchronized void frame(){if(surface==null||!surface.isValid())return;Viewport v;synchronized(view){v=new Viewport(view.lat,view.lon,view.zoom);}Canvas c=null;try{c=surface.lockCanvas(null);boolean dark=context.isDarkMode();c.drawColor(dark?Color.rgb(23,29,34):Color.rgb(230,235,238));Rect a=area();c.save();c.translate(a.left,a.top);int w=a.width(),h=a.height(),z=(int)Math.floor(v.zoom),n=1<<z;double tileSize=256*Math.pow(2,v.zoom-z),cx=Geo.x(v.lon)*n,cy=Geo.y(v.lat)*n;Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG);
 if(dark){ColorMatrix matrix=new ColorMatrix(new float[]{.45f,0,0,0,0,0,.48f,0,0,0,0,0,.52f,0,0,0,0,0,1,0});paint.setColorFilter(new ColorMatrixColorFilter(matrix));}
 int[] xs=tileSpan(width,a.left,w,cx,tileSize),ys=tileSpan(height,a.top,h,cy,tileSize);
 for(int y=ys[0];y<=ys[1];y++)for(int x=xs[0];x<=xs[1];x++){Bitmap b=tiles.get(z,x,y,this::draw);if(b!=null){float px=(float)(w/2.0+(x-cx)*tileSize),py=(float)(h/2.0+(y-cy)*tileSize);c.drawBitmap(b,null,new RectF(px,py,px+(float)tileSize,py+(float)tileSize),paint);}}
 paint.setColorFilter(null);paint.setStyle(Paint.Style.STROKE);float density=Math.max(1,context.getResources().getDisplayMetrics().density);for(Place p:places){if(p.coords.length<3)continue;Path path=new Path();float lastX=Float.NaN,lastY=Float.NaN;for(int i=0;i<p.coords.length;i++){double[] q=p.coords[i];float[] xy=v.point(q[0],q[1],w,h);if(i==0)path.moveTo(xy[0],xy[1]);else if(i==p.coords.length-1||Math.hypot(xy[0]-lastX,xy[1]-lastY)>1.5){path.lineTo(xy[0],xy[1]);lastX=xy[0];lastY=xy[1];}if(i==0){lastX=xy[0];lastY=xy[1];}}path.close();paint.setColor(p.id==selected?Color.rgb(255,175,40):dark?Color.CYAN:Color.rgb(0,80,170));paint.setStrokeWidth((p.id==selected?4:2)*density);c.drawPath(path,paint);}
 if(gps!=null){float[] xy=v.point(gps[0],gps[1],w,h);paint.setStyle(Paint.Style.FILL);paint.setColor(Color.WHITE);c.drawCircle(xy[0],xy[1],9*density,paint);paint.setColor(Color.rgb(25,120,250));c.drawCircle(xy[0],xy[1],6*density,paint);}
 // Attribution must remain visible when the host covers the map with panels.
 Rect hud=mapViewport(stable,visible,width,height);float hx=hud.left-a.left,hy=hud.bottom-a.top;
 paint.setStyle(Paint.Style.FILL);paint.setTextSize(13*density);String text="© OpenStreetMap contributors";float tw=paint.measureText(text);paint.setColor(dark?Color.BLACK:Color.WHITE);c.drawRect(hx,hy-22*density,hx+tw+12*density,hy,paint);paint.setColor(dark?Color.WHITE:Color.BLACK);c.drawText(text,hx+5*density,hy-6*density,paint);c.restore();
 }catch(RuntimeException ignored){}finally{if(c!=null)try{surface.unlockCanvasAndPost(c);}catch(RuntimeException ignored){}}}
 @Override public synchronized void close(){closed=true;tiles.close();render.shutdownNow();if(surface!=null){surface.release();surface=null;}}
}
