package org.example.wikimapreader.car;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.example.wikimapreader.SiteHttp;
import org.example.wikimapreader.CredentialRepository;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.LinkedHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import static org.junit.Assert.*;

/**
 * Real, keyless Android Auto data-path probe. This deliberately exercises the
 * Java decoder that the projected car Surface uses, not merely the shared HTTP transport.
 * Public fixed examples; no GPS, API keys, cookies, credentials or private IDs.
 */
@RunWith(AndroidJUnit4.class)
public final class CarSiteLiveTest {
 @Test public void liveTileDecodesWithCarParser() throws Exception {
  String path="https://wikimapia.org/z1/itiles/030/213/232/332/20.xy";
  SiteHttp.Result raw=new SiteHttp().get(path,null,new AtomicBoolean(false));
  assertEquals("Public itile HTTP",200,raw.status);
  String id="03021323233220";
  assertTrue("Expected itile",raw.text.startsWith(id+"|"));
  LinkedHashMap<Long,JSONObject> places=new LinkedHashMap<>();
  // The same decoder is called by CarSiteSource.area() on Android Auto.
  CarSiteSource.parseTile(raw.text,id,places);
  assertFalse("Public itile should contain contours",places.isEmpty());
  for(JSONObject place:places.values()){
   assertTrue(place.optLong("id")>0);
   assertFalse(place.optString("title").isEmpty());
   assertTrue(place.getJSONArray("polygon").length()>=3);
  }
 }

 @Test public void realAreaReturnsCarCompatibleContours() throws Exception {
  // Fixed, small public region: 15-zoom source should require <= 4 tiles.
  JSONObject opts=new JSONObject().put("bbox",new JSONArray()
   .put(37.615).put(55.749).put(37.622).put(55.755)).put("page",1);
  JSONObject response=CarSiteSource.request("box",opts,new AtomicBoolean(false));
  assertEquals("site",response.getString("source"));
  JSONArray areas=response.getJSONArray("folder");
  assertTrue("Public Moscow region should contain contours",areas.length()>0);
  assertTrue("Maximum number of objects",areas.length()<=30000);
  for(int i=0;i<areas.length();i++){
   Place decoded=Place.from(areas.getJSONObject(i));
   assertTrue(decoded.id>0);
   assertTrue(decoded.coords.length>=3);
  }
 }

 @Test public void livePlaceDescriptionParsesWithCarParser() throws Exception {
  JSONObject opts=new JSONObject().put("id",350);
  JSONObject place=CarSiteSource.request("place.getbyid",opts,new AtomicBoolean(false));
  assertEquals(350,place.getLong("id"));
  assertEquals("site",place.getString("source"));
  assertFalse("Real place title",place.getString("title").trim().isEmpty());
  Place normalized=Place.from(place);
  assertEquals(350,normalized.id);
  assertFalse(normalized.title.isEmpty());
  assertFalse("Known public place should contain an actual description",place.optString("description").trim().isEmpty());
 }
 @Test public void actualCarApiPipelineReadsWebsiteWithoutStoredKey() throws Exception {
  CountDownLatch done=new CountDownLatch(1);
  AtomicReference<JSONObject> answer=new AtomicReference<>();
  AtomicReference<String> failure=new AtomicReference<>();
  String requestId="probe:"+System.nanoTime();
  WikiApi.INSTANCE.request(requestId,
   new CredentialRepository(InstrumentationRegistry.getInstrumentation().getTargetContext()),
   "place.getbyid",new JSONObject().put("id",350),
   (data,error)->{answer.set(data);failure.set(error);done.countDown();});
  try{
   assertTrue("Car WikiApi callback timed out",done.await(45,TimeUnit.SECONDS));
   assertNull("Car WikiApi site-first failure: "+failure.get(),failure.get());
   assertNotNull("Car WikiApi response",answer.get());
   assertEquals(350,answer.get().getLong("id"));
   assertEquals("site",answer.get().getString("source"));
  }finally{WikiApi.INSTANCE.cancel(requestId);}
 }

}
