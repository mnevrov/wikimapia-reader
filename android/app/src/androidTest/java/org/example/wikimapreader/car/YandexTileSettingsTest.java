package org.example.wikimapreader.car;
import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Test Android Keystore on an actual Android emulator; no real Yandex key is needed. */
@RunWith(AndroidJUnit4.class)
public final class YandexTileSettingsTest {
 @Test public void keyEncryptedOnDiskAndNeverIncludedInStatus()throws Exception{
  Context ctx=InstrumentationRegistry.getInstrumentation().getTargetContext();
  YandexTileSettings settings=YandexTileSettings.get(ctx);
  String fake="not-a-real-tiles-api-key-1234";
  settings.clearKey();
  try{
   assertEquals("osm",settings.selected());
   assertFalse(settings.configured());
   settings.saveKey(fake);
   assertTrue(settings.configured());
   settings.select("yandex");
   assertEquals("yandex",settings.selected());
   String record=ctx.getSharedPreferences("car-tiles-v1",Context.MODE_PRIVATE)
    .getString("key","");
   assertFalse("Plaintext credential must not be stored",record.contains(fake));
   assertFalse("Key must not be retained as a regular preference",
    ctx.getSharedPreferences("car-tiles-v1",Context.MODE_PRIVATE).getAll().toString().contains(fake));
   settings.clearKey();
   assertEquals("osm",settings.selected());
   assertFalse(settings.configured());
  }finally{settings.clearKey();}
 }
}
