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
 @Test public void unknownSourceSchemaDoesNotSilentlyReturnNoObjects()throws Exception {
   try{CarSiteSource.parseTile("bad|0|7","030",new LinkedHashMap<>());fail("expected a schema failure");}
   catch(java.io.IOException expected){}
 }
}
