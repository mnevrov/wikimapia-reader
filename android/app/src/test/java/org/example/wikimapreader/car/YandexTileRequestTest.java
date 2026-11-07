package org.example.wikimapreader.car;
import org.junit.Test;
import static org.junit.Assert.*;

/** No network or key in logs; contract tests for official Tiles API. */
public class YandexTileRequestTest {
 private static final String KEY="test-only-not-real-key-123456";
 @Test public void buildsDocumentedWebMercator512pxUrl(){
  String url=YandexTileRequest.url(KEY,14,9902,5137);
  assertEquals("https://tiles.api-maps.yandex.ru/v1/tiles/?apikey="+KEY+
   "&lang=ru_RU&x=9902&y=5137&z=14&l=map&scale=2&projection=web_mercator",url);
 }
 @Test public void rejectsInvalidTileCoordinatesAndKeys(){
  assertThrows(IllegalArgumentException.class,()->YandexTileRequest.url("",14,2,3));
  assertThrows(IllegalArgumentException.class,()->YandexTileRequest.url("abc&x=0",14,2,3));
  assertThrows(IllegalArgumentException.class,()->YandexTileRequest.url(KEY,21,2,3));
  assertThrows(IllegalArgumentException.class,()->YandexTileRequest.url(KEY,14,-1,3));
  assertThrows(IllegalArgumentException.class,()->YandexTileRequest.url(KEY,14,2,1<<14));
 }
 @Test public void unauthorizedAndQuotaBackOff(){
  assertTrue(YandexTileRequest.backoff(403)>=300000);
  assertTrue(YandexTileRequest.backoff(429)>=120000);
  assertTrue(YandexTileRequest.backoff(500)>=60000);
 }
 @Test public void noEmbeddingProductionCredentials(){
  assertFalse(YandexTileSettings.valid(null));
  assertFalse(YandexTileSettings.valid("short"));
  assertTrue(YandexTileSettings.valid(KEY));
 }
}
