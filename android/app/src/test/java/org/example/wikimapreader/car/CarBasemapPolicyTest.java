package org.example.wikimapreader.car;

import org.junit.Test;
import static org.junit.Assert.*;

/** Contract: never apply a fake dark Yandex theme or recolor Yandex raster. */
public final class CarBasemapPolicyTest {
 @Test public void darkHostAutoNightUsesOsmAndDaytimeKeepsYandex(){
  assertEquals("yandex",CarBasemapPolicy.effectiveProvider("yandex",false,"auto"));
  assertEquals("osm",CarBasemapPolicy.effectiveProvider("yandex",true,"auto"));
  assertTrue(CarBasemapPolicy.nightFallback("yandex",true,"auto"));
  assertFalse(CarBasemapPolicy.nightFallback("yandex",false,"auto"));
 }
 @Test public void explicitKeepYandexNeverAltersProvider(){
  assertEquals("yandex",CarBasemapPolicy.effectiveProvider("yandex",true,"keep_yandex"));
  assertFalse(CarBasemapPolicy.nightFallback("yandex",true,"keep_yandex"));
  assertEquals("osm",CarBasemapPolicy.effectiveProvider("osm",true,"keep_yandex"));
  assertFalse(CarBasemapPolicy.validNightPolicy("unsupported"));
 }
 @Test public void osmNightPaletteInvertsLightPaperButPreservesTextContrast(){
  float[] matrix=CarBasemapPolicy.osmNightMatrix();
  assertEquals(20,matrix.length);
  int whiteRed=Math.round(255*(matrix[0]+matrix[1]+matrix[2])+matrix[4]);
  int blackRed=Math.round(matrix[4]);
  assertTrue("White paper should become dark",whiteRed>=0&&whiteRed<65);
  assertTrue("Dark labels should become bright",blackRed>170);
  assertTrue("Night labels need enough contrast",blackRed-whiteRed>125);
  assertEquals(1f,matrix[18],0f);
 }
}
