package org.example.wikimapreader.car;

/** Official Yandex Tiles API request format. This type never stores or prints the key. */
final class YandexTileRequest {
 static final String HOST="https://tiles.api-maps.yandex.ru/v1/tiles/";
 private YandexTileRequest(){}
 static String url(String key,int z,int x,int y) {
  if(!YandexTileSettings.valid(key)||z<0||z>20||(long)x<0||(long)y<0
   ||(long)x>=(1L<<z)||(long)y>=(1L<<z))throw new IllegalArgumentException("Invalid tile");
  return HOST+"?apikey="+key+"&lang=ru_RU&x="+x+"&y="+y+"&z="+z
   +"&l=map&scale=2&projection=web_mercator";
 }
 static long backoff(int status){
  return status==403?300000L:status==429?120000L:60000L;
 }
}
