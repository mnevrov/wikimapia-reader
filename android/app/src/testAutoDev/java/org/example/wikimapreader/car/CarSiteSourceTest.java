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
   String raw=java.nio.file.Files.readString(java.nio.file.Path.of(fixtures,"car-site-parity.xy"));
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
 @Test public void unknownSourceSchemaDoesNotSilentlyReturnNoObjects()throws Exception {
   try{CarSiteSource.parseTile("bad|0|7","030",new LinkedHashMap<>());fail("expected a schema failure");}
   catch(java.io.IOException expected){}
 }
}
