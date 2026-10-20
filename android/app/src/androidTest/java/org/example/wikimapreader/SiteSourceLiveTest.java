package org.example.wikimapreader;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.concurrent.atomic.AtomicBoolean;
import static org.junit.Assert.*;

/** Three public read operations. No API key, login, private location or edits. */
@RunWith(AndroidJUnit4.class)
public class SiteSourceLiveTest {
 @Test public void publicWebsiteWorksThroughAndroidHttpsTransport() throws Exception {
  SiteHttp http=new SiteHttp();AtomicBoolean cancelled=new AtomicBoolean();
  SiteHttp.Result card=http.get("https://wikimapia.org/350/ru/",null,cancelled);
  assertEquals("Public card HTTP",200,card.status);
  assertTrue("Description markup",card.text.contains("id=\"place-description\""));
  assertFalse("Description must be available",card.text.contains("RK n.22"));
  assertTrue("Photo gallery",card.text.contains("thumb-link"));
  assertTrue("Comments content",card.text.contains("comment-content"));
  SiteHttp.Result search=http.get("https://wikimapia.org/search/?q=park","qu=park&x=376100000&y=557500000&z=16&jtype=simple&start=0&try=0",cancelled);
  assertEquals("Public search HTTP",200,search.status);
  assertTrue("Search schema",search.text.contains("search-result-item"));
  assertTrue("Search coordinates",search.text.contains("data-latitude"));
  SiteHttp.Result tile=http.get("https://wikimapia.org/z1/itiles/030/213/232/332/20.xy",null,cancelled);
  assertEquals("Public tile HTTP",200,tile.status);
  assertTrue("Tile ID",tile.text.startsWith("03021323233220|"));
 }
}
