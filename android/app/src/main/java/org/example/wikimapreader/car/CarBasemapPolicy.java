package org.example.wikimapreader.car;

/** Chooses a licensed map provider without inventing unsupported Yandex Tiles themes. */
final class CarBasemapPolicy {
 static final String AUTO_NIGHT="auto";
 static final String KEEP_YANDEX="keep_yandex";
 private CarBasemapPolicy(){}
 static boolean validNightPolicy(String policy){
  return AUTO_NIGHT.equals(policy)||KEEP_YANDEX.equals(policy);
 }
 static String effectiveProvider(String selected,boolean hostNight,String nightPolicy){
  // Tiles API currently documents no theme=dark; use a separately attributed
  // night-styled OSM raster. Never recolor the original Yandex cartographic data.
  if("yandex".equals(selected)&&hostNight&&AUTO_NIGHT.equals(nightPolicy))return "osm";
  return "yandex".equals(selected)?"yandex":"osm";
 }
 static boolean nightFallback(String selected,boolean hostNight,String nightPolicy){
  return "yandex".equals(selected)&&hostNight&&AUTO_NIGHT.equals(nightPolicy);
 }
 /** Visible contrast on an OSM tile rendered in the car's night mode.
     Luminance inversion: white backgrounds -> slate #202630, dark labels -> light.
     This matrix is NEVER used for Yandex tiles. */
 static float[] osmNightMatrix(){
  return new float[]{
   -.13819f,-.46488f,-.04693f,0f,197.75f,
   -.14882f,-.50064f,-.05054f,0f,216.50f,
   -.17008f,-.57216f,-.05776f,0f,250f,
   0f,0f,0f,1f,0f
  };
 }
}
