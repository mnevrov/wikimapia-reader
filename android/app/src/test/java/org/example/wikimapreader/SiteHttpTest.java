package org.example.wikimapreader;
import org.junit.Test;
import static org.junit.Assert.*;
public class SiteHttpTest {
 @Test public void rejectsForeignAndWriteUrls() throws Exception {
  SiteHttp.validate("https://wikimapia.org/350/ru/");
  for(String s:new String[]{"http://wikimapia.org/350/","https://evil.test/350/","https://wikimapia.org/object/edit/","https://u:p@wikimapia.org/350/","https://wikimapia.org/350/?key=private"}){
   try{SiteHttp.validate(s);fail(s);}catch(java.io.IOException expected){}
  }
 }
 @Test public void onlyRecognizesExactSessionBootstrap() {
  assertEquals("nsess=0123456789abcdef0123456789abcdef",SiteHttp.bootstrapCookie("<html><script>document.cookie=\"nsess=0123456789abcdef0123456789abcdef\";</script></html>"));
  assertNull(SiteHttp.bootstrapCookie("<h1>Verify you are human</h1>"));
  assertNull(SiteHttp.bootstrapCookie("document.cookie=\"auth=secret\""));
 }
}
