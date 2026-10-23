package org.example.wikimapreader.car;
public final class Geo {
 private Geo(){}
 public static double wrap(double lon){return ((lon+180)%360+360)%360-180;}
 public static double delta(double a,double b){return wrap(a-b);}
 public static double x(double lon){return (lon+180)/360;}
 public static double y(double lat){double r=Math.toRadians(Math.max(-85.05112878,Math.min(85.05112878,lat)));return (1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2;}
 public static double lat(double y){return Math.toDegrees(Math.atan(Math.sinh(Math.PI*(1-2*y))));}
 public static boolean inside(double[][] p,double lat,double lon){boolean in=false;for(int i=0,j=p.length-1;i<p.length;j=i++){double a=delta(p[i][1],lon),b=delta(p[j][1],lon);if((p[i][0]>lat)!=(p[j][0]>lat)&&0<(b-a)*(lat-p[i][0])/(p[j][0]-p[i][0])+a)in=!in;}return in;}
 public static double[] representative(double[][] p){if(p.length==0)return null;double a=0,b=0;for(double[] q:p){a+=q[0];b+=delta(q[1],p[0][1]);}a/=p.length;b=wrap(p[0][1]+b/p.length);if(inside(p,a,b))return new double[]{a,b};for(int i=0;i<p.length;i++){double[] q=p[i],r=p[(i+1)%p.length];for(double k:new double[]{.001,.01,.1}){double la=q[0]*(1-k)+a*k,lo=wrap(q[1]+delta(b,q[1])*k);if(inside(p,la,lo))return new double[]{la,lo};}}return p[0].clone();}
 public static void validateBox(double[] b){if(b==null||b.length!=4)throw new IllegalArgumentException("Границы карты");for(double n:b)if(!Double.isFinite(n))throw new IllegalArgumentException("Границы карты");if(b[0]<-180||b[2]>180||b[1]<-90||b[3]>90||b[0]>=b[2]||b[1]>=b[3]||b[2]-b[0]>.035||b[3]-b[1]>.035)throw new IllegalArgumentException("Увеличьте масштаб карты");}
 public static double distance(double a,double b,double c,double d){double x=Math.toRadians(c-a),y=Math.toRadians(delta(d,b));double h=Math.sin(x/2)*Math.sin(x/2)+Math.cos(Math.toRadians(a))*Math.cos(Math.toRadians(c))*Math.sin(y/2)*Math.sin(y/2);return 6371000*2*Math.asin(Math.sqrt(Math.min(1,h)));}
}
