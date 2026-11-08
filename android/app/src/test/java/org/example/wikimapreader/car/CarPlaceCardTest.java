package org.example.wikimapreader.car;

import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class CarPlaceCardTest {
 private final Place fallback=new Place(55,"Дом","",new double[0][]);

 @Test public void websiteDescriptionCommentsAndPhotosUseThePhoneBlockShape()throws Exception {
  JSONObject data=new JSONObject("{\"place\":{\"id\":55,\"title\":\"Дом\",\"description\":\"<p>История &amp; жизнь</p>\",\"photos\":[{\"url\":\"https://photos.wikimapia.org/p/12/34/56/78/90_big.jpg\"}],\"comments\":[{\"author\":\"Автор\",\"text\":\"<b>Сохранился</b> фасад\",\"dateLabel\":\"вчера\"}]},\"blocks\":{\"photos\":\"ok\",\"comments\":\"ok\"}}");
  CarPlaceCard card=CarPlaceCard.from(data,fallback);
  assertEquals("История & жизнь",card.description);
  assertEquals(1,card.photoCount);
  assertTrue(card.photosKnown);
  assertTrue(card.commentsKnown);
  assertEquals("Автор",card.comments.get(0).author);
  assertEquals("Сохранился фасад",card.comments.get(0).text);
  assertEquals("вчера",card.comments.get(0).date);
 }
 @Test public void apiWrappedCollectionsAndDeletedCommentsAreHandled()throws Exception{
  JSONObject data=new JSONObject("{\"id\":55,\"main\":{\"title\":\"Дом\",\"description\":\"Описание\"},\"photos\":{\"photo\":[{\"url\":\"https://photos.wikimapia.org/a.jpg\"}]},\"comments\":{\"comment\":[{\"is_deleted\":1,\"text\":\"Удалён\"},{\"text\":\"Важная деталь\",\"author_name\":\"Редактор\"}]}}");
  CarPlaceCard card=CarPlaceCard.from(data,fallback);
  assertEquals("Дом",card.title);
  assertEquals(1,card.photoCount);
  assertEquals(1,card.comments.size());
  assertEquals("Редактор",card.comments.get(0).author);
 }
 @Test public void missingSiteSectionsAreNotMisrepresentedAsEmpty()throws Exception{
  JSONObject data=new JSONObject("{\"place\":{\"id\":55,\"title\":\"Дом\",\"photos\":[],\"comments\":[]},\"blocks\":{\"photos\":\"unavailable\",\"comments\":\"unavailable\"}}");
  CarPlaceCard card=CarPlaceCard.from(data,fallback);
  assertFalse(card.photosKnown);
  assertFalse(card.commentsKnown);
  assertTrue(card.mediaSummary().contains("нет данных"));
 }
 @Test public void mismatchedIdNeverReplacesSelectedObject()throws Exception{
  assertThrows(IllegalArgumentException.class,()->CarPlaceCard.from(new JSONObject("{\"id\":56,\"title\":\"Подмена\"}"),fallback));
 }
 @Test public void longUntrustedMarkupIsPlainAndBounded(){
  String text="<script>SECRET</script><p>А</p>"+"Б".repeat(7000);
  String clean=CarPlaceCard.clean(text,6000);
  assertFalse(clean.contains("SECRET"));assertTrue(clean.length()<=6000);
  assertTrue(CarPlaceCard.excerpt(clean,105).length()<=105);
 }
}
