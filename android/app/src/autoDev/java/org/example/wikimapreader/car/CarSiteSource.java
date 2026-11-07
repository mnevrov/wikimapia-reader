package org.example.wikimapreader.car;

import android.text.Html;
import org.example.wikimapreader.SiteHttp;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Website-first read-only source for the projected Auto host.
 * No API key, cookie export, scraper JS execution or third-party proxy.
 * The website format may change; failed/partial decoding is never called complete. */
final class CarSiteSource {
 private static final SiteHttp HTTP=new SiteHttp();
 private static final int TILE_Z=15, MAX_TILES=9, MAX_PLACES=30000;
 private static final Pattern H1=Pattern.compile("(?is)<h1\\b[^>]*>(.*?)</h1>");
 private static final Pattern DESCRIPTION=Pattern.compile("(?is)<[^>]*\\bid=[\"']place-description[\"'][^>]*>(.*?)</(?:div|section|p)>");
 private static final Pattern SEARCH_ITEM=Pattern.compile("(?is)<[^>]*\\bclass=[\"'][^\"']*search-result-item[^\"']*[\"'][^>]*>");
 private static final Pattern STRONG=Pattern.compile("(?is)<strong\\b[^>]*>(.*?)</strong>");
 private static final Pattern ATTR=Pattern.compile("(?is)\\b%s\\s*=\\s*[\"']([^\"']*)[\"']");
 static final class SiteFailure extends IOException {
  final int status;
  SiteFailure(int status){super("Site HTTP "+status);this.status=status;}
 }
 /** Public website tiles only. Cache parsed-valid bodies in memory to avoid repeated slow requests while driving. */
 private static final int TILE_CACHE_MAX=32, TILE_CACHE_BYTES=8*1024*1024;
 private static final long TILE_CACHE_TTL_MS=300_000L;
 private static final LinkedHashMap<String,CachedTile> TILE_CACHE=new LinkedHashMap<>(32,.75f,true);
 private static int tileBytes;
 private static volatile long siteDeniedUntil;
 private static volatile int siteDeniedCode;
 private static final class CachedTile {
  final String text;final long at;
  CachedTile(String text,long at){this.text=text;this.at=at;}
 }
 interface TileReader {String read(String id,AtomicBoolean cancelled)throws Exception;}
 private static synchronized String cachedText(String id){
  CachedTile e=TILE_CACHE.get(id);
  return e!=null&&System.currentTimeMillis()-e.at<TILE_CACHE_TTL_MS?e.text:null;
 }
 private static synchronized void cacheText(String id,String text){
  CachedTile old=TILE_CACHE.remove(id);if(old!=null)tileBytes-=old.text.length()*2;
  TILE_CACHE.put(id,new CachedTile(text,System.currentTimeMillis()));tileBytes+=text.length()*2;
  while(TILE_CACHE.size()>TILE_CACHE_MAX||tileBytes>TILE_CACHE_BYTES){
   String first=TILE_CACHE.keySet().iterator().next();
   tileBytes-=TILE_CACHE.remove(first).text.length()*2;
  }
 }
 private static String fetchTile(String id,AtomicBoolean cancelled)throws Exception{
  String existing=cachedText(id);
  if(existing!=null)return existing;
  if(System.currentTimeMillis()<siteDeniedUntil)throw new SiteFailure(siteDeniedCode);
  String value=checked(tilePath(id),null,cancelled).text;
  // Never cache malformed tiles.
  parseTile(value,id,new LinkedHashMap<Long,JSONObject>());
  cacheText(id,value);
  return value;
 }
 private CarSiteSource() {}

 static JSONObject request(String method,JSONObject opts,AtomicBoolean cancelled)throws Exception {
  if(cancelled.get())throw new IOException("Cancelled");
  switch(method){
   case "box":return area(opts,cancelled);
   case "place.getbyid":return details(opts,cancelled);
   case "search":return search(opts,cancelled);
   default:throw new IOException("Unsupported site action");
  }
 }
 private static SiteHttp.Result checked(String url,String body,AtomicBoolean cancelled)throws IOException {
  SiteHttp.Result response=HTTP.get(url,body,cancelled);
  if(response.status!=200){
   if(response.status==403||response.status==429){siteDeniedCode=response.status;siteDeniedUntil=System.currentTimeMillis()+60000;}
   throw new SiteFailure(response.status);
  }
  return response;
 }
 static String tileId(int x,int y,int z)throws IOException {
  int n=1<<z;if(z<1||z>15||x<0||x>=n||y<0||y>=n)throw new IOException("Invalid tile");
  int flipped=n-y-1;StringBuilder id=new StringBuilder("0");
  for(int bit=z-1;bit>=0;bit--)id.append(((x>>bit)&1)+2*((flipped>>bit)&1));
  return id.toString();
 }
 static String tilePath(String id){StringBuilder p=new StringBuilder("https://wikimapia.org/z1/itiles/");
  for(int i=0;i<id.length();i+=3){if(i>0)p.append('/');p.append(id, i, Math.min(id.length(),i+3));}
  return p.append(".xy").toString();
 }
 private static int tx(double lon,int z){return Math.max(0,Math.min((1<<z)-1,(int)Math.floor((lon+180)/360*(1<<z))));}
 private static int ty(double lat,int z){double rad=Math.toRadians(lat);double y=(1-Math.log(Math.tan(rad)+1/Math.cos(rad))/Math.PI)/2*(1<<z);return Math.max(0,Math.min((1<<z)-1,(int)Math.floor(y)));}
 /** Finest tile detail that covers the entire map within MAX_TILES requests. */
 static int zoomForArea(double w,double s,double e,double n){
  for(int z=TILE_Z;z>1;z--){
   long columns=(long)tx(e,z)-tx(w,z)+1,rows=(long)ty(s,z)-ty(n,z)+1;
   if(columns*rows<=MAX_TILES)return z;
  }
  return 1;
 }
 private static JSONObject area(JSONObject opts,AtomicBoolean cancelled)throws Exception {
  return areaWithReader(opts,cancelled,CarSiteSource::fetchTile);
 }
 /** Testable region loader: prioritize the center visible to the driver.
  * A single bad tile is partial coverage, not loss of already decoded objects. */
 static JSONObject areaWithReader(JSONObject opts,AtomicBoolean cancelled,TileReader reader)throws Exception {
  JSONArray box=opts.getJSONArray("bbox");if(box.length()!=4)throw new IOException("Invalid bbox");
  double w=box.getDouble(0),s=box.getDouble(1),e=box.getDouble(2),n=box.getDouble(3);
  if(!Double.isFinite(w)||!Double.isFinite(s)||!Double.isFinite(e)||!Double.isFinite(n)||w>=e||s>=n||w< -180||e>180||s< -85||n>85||e-w>.035||n-s>.035)throw new IOException("Invalid bbox");
  int page=opts.optInt("page",1);if(page<1)throw new IOException("Invalid page");
  if(page>1)return new JSONObject().put("folder",new JSONArray()).put("source","site").put("more",false).put("complete",false);
  // Parent tiles cover the complete viewport on wider zoom levels instead of
  // dropping all but the closest 9 detail tiles. A parent with children is
  // still reported incomplete until those children are loaded.
  final int tileZ=zoomForArea(w,s,e,n);
  final double centerX=(tx(w,tileZ)+tx(e,tileZ))/2.0,centerY=(ty(n,tileZ)+ty(s,tileZ))/2.0;
  java.util.List<int[]> candidates=new java.util.ArrayList<>();
  for(int x=tx(w,tileZ);x<=tx(e,tileZ);x++)for(int y=ty(n,tileZ);y<=ty(s,tileZ);y++)candidates.add(new int[]{x,y});
  candidates.sort((a,b)->Double.compare(
   (a[0]-centerX)*(a[0]-centerX)+(a[1]-centerY)*(a[1]-centerY),
   (b[0]-centerX)*(b[0]-centerX)+(b[1]-centerY)*(b[1]-centerY)));
  Map<Long,JSONObject> unique=new LinkedHashMap<>();
  boolean complete=candidates.size()<=MAX_TILES;int successes=0,failures=0;Exception firstFailure=null;
  for(int[] coords:candidates){
   if(successes+failures>=MAX_TILES)break;
   if(cancelled.get()||Thread.currentThread().isInterrupted())throw new java.io.InterruptedIOException("Cancelled");
   String id=tileId(coords[0],coords[1],tileZ);
   try{
    String raw=reader.read(id,cancelled);
    // Parse into a temporary map to avoid leaking partially decoded tiles.
    Map<Long,JSONObject> parsed=new LinkedHashMap<>();
    if(!parseTile(raw,id,parsed))complete=false;
    unique.putAll(parsed);successes++;
    if(unique.size()>MAX_PLACES)throw new IOException("Too many contours");
   }catch(Exception ex){
    if(cancelled.get()||Thread.currentThread().isInterrupted())throw ex;
    if(firstFailure==null)firstFailure=ex;
    failures++;complete=false;
    // Stop quickly on denial/quota or repeated failure; never create a request avalanche.
    if(ex instanceof SiteFailure&&(((SiteFailure)ex).status==403||((SiteFailure)ex).status==429))break;
    if(failures>=2)break;
   }
  }
  if(successes==0&&firstFailure!=null)throw firstFailure;
  JSONObject result=new JSONObject().put("folder",new JSONArray(unique.values()))
   .put("source","site").put("more",false).put("complete",complete);
  if(failures>0)result.put("warning","Часть тайлов Wikimapia недоступна");
  return result;
 }
 /** Returns true only when the tile explicitly declares no deeper tiles. */
 static boolean parseTile(String body,String id,Map<Long,JSONObject> places)throws Exception {
  if(body==null||body.length()>4194304)throw new IOException("Invalid tile");
  String[] lines=body.split("\n");if(lines.length<1)throw new IOException("Empty tile");
  String[] header=lines[0].trim().split("\\|");
  if(header.length<3||!header[0].equals(id)||(!header[1].equals("0")&&!header[1].equals("1")))throw new IOException("Unexpected tile");
  for(int i=1;i<lines.length;i++){
   if(lines[i].trim().isEmpty())continue;
   String[] f=lines[i].split("\\|",8);
   if(f.length<8)throw new IOException("Malformed tile row");
   long placeId=Long.parseLong(f[0]);
   if(placeId<1||placeId>9007199254740991L)throw new IOException("Invalid place id");
   String title="Без названия";for(String t:f[5].split("\u001f"))if(!t.isEmpty()&&t.charAt(0)=='!'){title=t.substring(1);break;}
   if(title.equals("Без названия")&&!f[5].isEmpty())title=f[5].substring(1);
   int type=Integer.parseInt(f[6]);JSONArray polygon=polygon(f[7],type);
   JSONObject object=new JSONObject().put("id",placeId).put("title",title).put("polygon",polygon);
   places.put(placeId,object);
  }
  return header[1].equals("0");
 }
 static JSONArray polygon(String encoded,int type)throws Exception {
  if(encoded.length()>500000)throw new IOException("Big polygon");
  JSONArray points=new JSONArray();
  long x=0,y=0;
  if(type==1){
   int i=0;
   while(i<encoded.length()){
    long[] a=new long[2];
    for(int k=0;k<2;k++){
     long v=0;int shift=0,c;
     do{if(i>=encoded.length()||shift>30)throw new IOException("Damaged polygon");
      c=encoded.charAt(i++)-63;if(c<0||c>63)throw new IOException("Damaged polygon");
      v|=(long)(c&31)<<shift;shift+=5;
     }while(c>=32);
     a[k]=(v&1)!=0?~(v>>1):(v>>1);
    }
    x+=a[0];y+=a[1];double scale=Math.abs(y)>90000000?1e7:1e6;
    point(points,y/scale,x/scale);
   }
  }else if(type==0){
   String[] a=encoded.split(";",3);if(a.length!=3||a[2].length()<2)throw new IOException("Unknown geometry");
   x=Long.parseLong(a[0]);y=Long.parseLong(a[1]);
   int width=Integer.parseInt(a[2].substring(0,2),16)+1;
   String hex=a[2].substring(2);if(width<1||width>4||hex.length()%(4*width)!=0)throw new IOException("Unknown geometry");
   point(points,y/1e7,x/1e7);
   for(int i=0;i<hex.length();i+=width*4){
    x-=delta(hex.substring(i,i+2*width),width);
    y-=delta(hex.substring(i+2*width,i+4*width),width);
    point(points,y/1e7,x/1e7);
   }
  }else throw new IOException("Unknown polygon encoding");
  if(points.length()<3)throw new IOException("Short polygon");
  return points;
 }
 private static long delta(String hex,int width)throws IOException {
  try{long v=Long.parseLong(hex,16),size=1L<<(8*width);return v>=size/2?v-size:v;}
  catch(NumberFormatException e){throw new IOException("Invalid delta");}
 }
 private static void point(JSONArray arr,double lat,double lon)throws Exception {
  if(arr.length()>=30000||!Double.isFinite(lat)||!Double.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)throw new IOException("Invalid geometry");
  arr.put(new JSONObject().put("x",lon).put("y",lat));
 }
 private static String plain(String html){
  String safe=html.replaceAll("(?is)<(?:script|style)\\b[^>]*>.*?</(?:script|style)>","");
  return Html.fromHtml(safe,Html.FROM_HTML_MODE_LEGACY).toString().replace('\u00a0',' ').trim();
 }
 private static JSONObject details(JSONObject opts,AtomicBoolean cancelled)throws Exception {
  long id=opts.getLong("id");if(id<1||id>9007199254740991L)throw new IOException("Invalid place id");
  SiteHttp.Result response=checked("https://wikimapia.org/"+id+"/ru/",null,cancelled);
  if(!response.url.matches("https://wikimapia\\.org/"+id+"/(?:ru/.*)?"))throw new IOException("Wrong place page");
  Matcher title=H1.matcher(response.text);if(!title.find())throw new IOException("Unknown place page");
  String name=plain(title.group(1));if(name.isEmpty())throw new IOException("No place title");
  Matcher desc=DESCRIPTION.matcher(response.text);String text=desc.find()?plain(desc.group(1)):"";
  if(text.matches("(?is).*RK\\s*n\\.?\\s*22.*"))text="";
  return new JSONObject().put("id",id).put("title",name).put("description",text).put("source","site");
 }
 private static String attr(String tag,String key){
  Pattern p=Pattern.compile(String.format(Locale.ROOT,ATTR.pattern(),Pattern.quote(key)));
  Matcher m=p.matcher(tag);return m.find()?m.group(1):"";
 }
 private static JSONObject search(JSONObject opts,AtomicBoolean cancelled)throws Exception {
  String query=opts.getString("query").trim();double lat=opts.getDouble("lat"),lon=opts.getDouble("lon");
  if(query.isEmpty()||query.length()>200||!Double.isFinite(lat)||!Double.isFinite(lon)||Math.abs(lat)>85||Math.abs(lon)>180)throw new IOException("Invalid search");
  String enc=URLEncoder.encode(query.toLowerCase(Locale.ROOT),"UTF-8");
  String body="y="+Math.round(lat*1e7)+"&x="+Math.round(lon*1e7)+"&z=16&qu="+URLEncoder.encode(query,"UTF-8")+"&jtype=simple&start=0&try=0";
  String html=checked("https://wikimapia.org/search/?q="+enc,body,cancelled).text;
  if(!html.contains("searchlist"))throw new IOException("Search schema changed");
  JSONArray locations=new JSONArray();Matcher items=SEARCH_ITEM.matcher(html);
  while(items.find()&&locations.length()<20){
   String tag=items.group(),a=attr(tag,"data-latitude"),b=attr(tag,"data-longitude");
   double rLat,rLon;try{rLat=Double.parseDouble(a);rLon=Double.parseDouble(b);}catch(Exception e){throw new IOException("Invalid search location");}
   if(!Double.isFinite(rLat)||!Double.isFinite(rLon)||Math.abs(rLat)>85||Math.abs(rLon)>180)throw new IOException("Invalid search location");
   String tail=html.substring(items.end(),Math.min(html.length(),items.end()+4000));
   Matcher title=STRONG.matcher(tail);if(!title.find())continue;
   String name=plain(title.group(1));if(name.isEmpty())continue;
   locations.put(new JSONObject().put("title",name).put("lat",rLat).put("lon",rLon));
  }
  return new JSONObject().put("locations",locations).put("source","site");
 }
}
