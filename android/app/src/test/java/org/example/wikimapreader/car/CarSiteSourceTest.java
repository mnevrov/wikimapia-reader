package org.example.wikimapreader.car;

import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import java.util.LinkedHashMap;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class CarSiteSourceTest {
 @Test public void siteDetailExtractsPublicBlocksWithoutRunningScripts()throws Exception{
  String html="<html><h1>Исторический дом</h1><div id='place-description'><p>Строение 1920 года</p></div>"
    +"<div id='place-photos'><a class='thumb-link' data-id='5' data-full-url='https://photos.wikimapia.org/p/12/34/56/78/90_big.jpg'>Фото</a></div>"
    +"<div id='comments'><ul><li class='comment' id='comment-9'><span id='comment-creator-9'>Гость</span>"
    +"<span class='time'>12 июня</span><div class='comment-content'>Новая информация</div></li></ul></div>"
    +"<script>globalThis.evil = true</script></html>";
  JSONObject response=CarSiteSource.parseDetail(55,html);
  JSONObject place=response.getJSONObject("place");
  assertEquals("Исторический дом",place.getString("title"));
  assertEquals("Строение 1920 года",place.getString("description"));
  assertEquals(1,place.getJSONArray("photos").length());
  assertEquals(1,place.getJSONArray("comments").length());
  assertEquals("Гость",place.getJSONArray("comments").getJSONObject(0).getString("author"));
  assertFalse(response.toString().contains("globalThis.evil"));
 }
 @Test public void siteDetailDoesNotInventMissingMediaBlocks()throws Exception{
  JSONObject result=CarSiteSource.parseDetail(55,"<h1>Дом</h1><div id='place-description'>Есть описание</div>");
  assertEquals("unavailable",result.getJSONObject("blocks").getString("photos"));
  assertEquals("unavailable",result.getJSONObject("blocks").getString("comments"));
 }
 @Test public void photoUrlsRejectOffDomainOrUnrecognizedPaths()throws Exception{
  String html="<h1>Дом</h1><div id='place-photos'>"
   +"<a class='thumb-link' data-full-url='https://example.com/secret.jpg'></a>"
   +"<a class='thumb-link' data-full-url='https://photos.wikimapia.org/other.jpg'></a></div>";
  JSONObject result=CarSiteSource.parseDetail(55,html);
  assertEquals(0,result.getJSONObject("place").getJSONArray("photos").length());
  assertEquals("unavailable",result.getJSONObject("blocks").getString("photos"));
 }
 @Test public void siteTileAddressUsesTheSameQuadkeyAsWeb()throws Exception {
   assertEquals("03021323233220",CarSiteSource.tileId(4952,2561,13));
   assertEquals("https://wikimapia.org/z1/itiles/030/213/232/332/20.xy",CarSiteSource.tilePath("03021323233220"));
 }
 @Test public void parsesReadOnlyTileWithoutKey()throws Exception {
   java.util.Map<Long,JSONObject> places=new LinkedHashMap<>();
   assertTrue(CarSiteSource.parseTile("030|0|7\n55|100|376100000,376200000,557500000,557600000|16||!Место|1|??????","030",places));
   assertEquals("Место",places.get(55L).getString("title"));
   assertEquals(3,places.get(55L).getJSONArray("polygon").length());
 }
 @Test public void phoneFallbackUsesApiDirectlyWhileCarHostReadsWebsiteFirst()throws Exception {
   assertTrue(WikiApi.websiteFirst(new JSONObject()));
   assertFalse(WikiApi.websiteFirst(new JSONObject().put("apiOnly",true)));
 }
 @Test public void carDecoderMatchesSharedPhoneTileFixture()throws Exception {
   String fixtures=System.getProperty("wikireader.fixtures");
   assertNotNull("Shared fixtures root",fixtures);
   String raw=new String(java.nio.file.Files.readAllBytes(new java.io.File(fixtures,"car-site-parity.xy").toPath()),java.nio.charset.StandardCharsets.UTF_8);
   java.util.Map<Long,JSONObject> parsed=new LinkedHashMap<>();
   assertTrue(CarSiteSource.parseTile(raw,"030",parsed));
   assertEquals(2,parsed.size());
   JSONObject first=parsed.get(55L),second=parsed.get(56L);
   assertEquals("Первый объект",first.getString("title"));
   assertEquals("Второй объект",second.getString("title"));
   assertEquals(3,first.getJSONArray("polygon").length());
   assertEquals(3,second.getJSONArray("polygon").length());
   assertEquals(55.75,first.getJSONArray("polygon").getJSONObject(0).getDouble("y"),0.0000001);
   assertEquals(37.62,first.getJSONArray("polygon").getJSONObject(1).getDouble("x"),0.0000001);
   assertEquals(55.76,second.getJSONArray("polygon").getJSONObject(0).getDouble("y"),0.0000001);
   assertEquals(37.61999,second.getJSONArray("polygon").getJSONObject(1).getDouble("x"),0.0000001);
 }
 @Test public void siteFailureClassificationIsSafeAndActionable(){
   assertEquals("Wikimapia ограничил запросы AutoDev (HTTP 403)",WikiApi.siteError(new CarSiteSource.SiteFailure(403)));
   assertEquals("Wikimapia ограничил запросы AutoDev (HTTP 429)",WikiApi.siteError(new CarSiteSource.SiteFailure(429)));
   assertEquals("DNS Wikimapia недоступен в AutoDev",WikiApi.siteError(new java.net.UnknownHostException()));
   assertEquals("Тайм-аут Wikimapia в AutoDev",WikiApi.siteError(new java.net.SocketTimeoutException()));
   assertEquals("Данные Wikimapia не загрузились в AutoDev",WikiApi.siteError(new java.io.IOException("private-response-body")));
 }
 @Test public void firstSuccessfulTileSurvivesNeighborTimeout()throws Exception {
  JSONObject box=new JSONObject().put("bbox",new org.json.JSONArray()
   .put(37.61).put(55.75).put(37.635).put(55.77)).put("page",1);
  java.util.concurrent.atomic.AtomicInteger count=new java.util.concurrent.atomic.AtomicInteger();
  JSONObject area=CarSiteSource.areaWithReader(box,new java.util.concurrent.atomic.AtomicBoolean(),(id,cancelled)->{
   if(count.incrementAndGet()==1)return id+"|0|7\n55|100|376100000,376200000,557500000,557600000|16||!Дом|1|??????";
   throw new java.io.InterruptedIOException("Timeout");
  });
  assertTrue("One good tile survives",area.getJSONArray("folder").length()>0);
  assertFalse("Area must declare incomplete coverage",area.getBoolean("complete"));
  assertEquals("Часть тайлов Wikimapia недоступна",area.getString("warning"));
  assertEquals("Stop after second failed tile",3,count.get());
 }
 @Test public void noSuccessfulTilesMustStillReportError()throws Exception {
  JSONObject box=new JSONObject().put("bbox",new org.json.JSONArray()
   .put(37.61).put(55.75).put(37.635).put(55.77)).put("page",1);
  try{
   CarSiteSource.areaWithReader(box,new java.util.concurrent.atomic.AtomicBoolean(),
    (id,c)->{throw new java.io.IOException("offline");});
   fail("Expected real site failure");
  }catch(java.io.IOException expected){assertEquals("offline",expected.getMessage());}
 }
 @Test public void loadIsCenteredAndBoundedWithoutRequestAvalanche()throws Exception {
  JSONObject box=new JSONObject().put("bbox",new org.json.JSONArray()
   .put(37.60).put(55.74).put(37.634).put(55.774)).put("page",1);
  java.util.List<String> requested=new java.util.ArrayList<>();
  JSONObject area=CarSiteSource.areaWithReader(box,new java.util.concurrent.atomic.AtomicBoolean(),(id,cancelled)->{
   requested.add(id);return id+"|0|7";
  });
  assertTrue(requested.size()>0&&requested.size()<=9);
  assertTrue("A bounded parent-level request covers all tiles",area.getBoolean("complete"));
  assertEquals("No items in fixture",0,area.getJSONArray("folder").length());
  int expectedZ=CarSiteSource.zoomForArea(37.60,55.74,37.634,55.774);
  assertTrue("Zoom out chooses a parent tile level",expectedZ<15);
  for(String id:requested)assertEquals("All tiles use the selected LOD",expectedZ+1,id.length());
 }
 @Test public void cancellationDoesNotBecomePartialCoverage()throws Exception {
  JSONObject box=new JSONObject().put("bbox",new org.json.JSONArray()
   .put(37.61).put(55.75).put(37.635).put(55.77)).put("page",1);
  java.util.concurrent.atomic.AtomicBoolean cancelled=new java.util.concurrent.atomic.AtomicBoolean(true);
  try{
   CarSiteSource.areaWithReader(box,cancelled,(id,c)->id+"|0|7");
   fail("Expected cancellation");
  }catch(java.io.InterruptedIOException expected){}
 }
 @Test public void unknownSourceSchemaDoesNotSilentlyReturnNoObjects()throws Exception {
   try{CarSiteSource.parseTile("bad|0|7","030",new LinkedHashMap<>());fail("expected a schema failure");}
   catch(java.io.IOException expected){}
 }
 @Test public void parentTileWithChildrenIsIncompleteEvenWithFullViewportCoverage()throws Exception {
  JSONObject box=new JSONObject().put("bbox",new org.json.JSONArray()
   .put(37.60).put(55.74).put(37.634).put(55.774)).put("page",1);
  java.util.concurrent.atomic.AtomicInteger calls=new java.util.concurrent.atomic.AtomicInteger();
  JSONObject area=CarSiteSource.areaWithReader(box,new java.util.concurrent.atomic.AtomicBoolean(),(id,c)->{
   calls.incrementAndGet();return id+"|1|7";
  });
  assertTrue(calls.get()>0&&calls.get()<=9);
  assertFalse("Server declares deeper tiles, so coverage is partial",area.getBoolean("complete"));
 }
 @Test public void tightViewportStillUsesFullDetail()throws Exception {
  assertEquals(15,CarSiteSource.zoomForArea(37.615,55.749,37.622,55.755));
 }

}
