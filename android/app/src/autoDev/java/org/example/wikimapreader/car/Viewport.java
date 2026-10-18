package org.example.wikimapreader.car;
public final class Viewport {
 public double lat,lon,zoom; public boolean follow=true;
 public Viewport(double a,double b,double z){lat=a;lon=b;zoom=z;}
 public double pixels(){return 256*Math.pow(2,zoom);}
 public double[] at(double x,double y,int w,int h){return new double[]{Geo.lat(Geo.y(lat)+(y-h/2.0)/pixels()),Geo.wrap(lon+(x-w/2.0)*360/pixels())};}
 public float[] point(double a,double b,int w,int h){return new float[]{(float)(w/2.0+Geo.delta(b,lon)*pixels()/360),(float)(h/2.0+(Geo.y(a)-Geo.y(lat))*pixels())};}
 public void pan(double dx,double dy){double[] p=at(dx,dy,0,0);lat=p[0];lon=p[1];follow=false;}
 public void scale(double factor,double x,double y,int w,int h){double[] old=at(x,y,w,h);zoom=Math.max(10,Math.min(19,zoom+Math.log(factor)/Math.log(2)));double[] now=at(x,y,w,h);lat=Geo.lat(Geo.y(lat)+Geo.y(old[0])-Geo.y(now[0]));lon=Geo.wrap(lon+Geo.delta(old[1],now[1]));}
 public java.util.List<double[]> boxes(int width,int height){
  java.util.List<double[]> out=new java.util.ArrayList<>();double[] tl=at(0,0,width,height),br=at(width,height,width,height);
  // A finite 3x3 budget prioritizes the visible centre; each API request remains <=.035°.
  double half=.0174;for(int ring=0;ring<=1;ring++)for(int dy=-ring;dy<=ring;dy++)for(int dx=-ring;dx<=ring;dx++){
   if(ring==1&&dx==0&&dy==0)continue;double a=lat+dy*half*2,c=Geo.wrap(lon+dx*half*2);
   if(a<Math.min(tl[0],br[0])-half||a>Math.max(tl[0],br[0])+half)continue;
   if(Math.abs(Geo.delta(c,lon))>width*180/pixels()+half)continue;
   double south=Math.max(-85,a-half),north=Math.min(85,a+half),west=Math.max(-180,c-half),east=Math.min(180,c+half);
   if(south<north&&west<east)out.add(new double[]{west,south,east,north});
  }return out;
 }
 public double[] box(){double a=Math.min(.0174,180/pixels()*800),b=Math.min(.0174,180/pixels()*480);double south=Math.max(-85,lat-b),north=Math.min(85,lat+b);double west=Math.max(-180,lon-a),east=Math.min(180,lon+a);return new double[]{west,south,east,north};}
}
