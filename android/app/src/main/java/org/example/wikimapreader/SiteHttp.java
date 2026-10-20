package org.example.wikimapreader;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.*;
import java.util.zip.GZIPInputStream;

/** Read-only public website transport. No app/API credentials, no script execution. */
public final class SiteHttp {
 public static final int MAX_BYTES=4*1024*1024;
 private volatile String session="";
 private long nextStart=0;
 private synchronized long reserve(){long now=System.nanoTime()/1000000;long at=Math.max(now,nextStart);nextStart=at+1000;return at;}
 private static int remaining(long deadline) throws InterruptedIOException {long left=deadline-System.nanoTime()/1000000;if(left<=0)throw new InterruptedIOException("Timeout");return (int)left;}
 public static URI validate(String value) throws IOException {
  try {
   URI u=new URI(value);String p=u.getPath();
   if(!"https".equals(u.getScheme())||!"wikimapia.org".equals(u.getHost())||u.getUserInfo()!=null||u.getPort()!=-1||u.getFragment()!=null||
      (u.getQuery()!=null&&Pattern.compile("(?i)(^|&)key=").matcher(u.getQuery()).find())||
      !(p.matches("/\\d+/(ru/.*)?")||p.matches("/z1/itiles/(?:[0-3]{3}/)*[0-3]{1,3}\\.xy")||p.equals("/search/")))throw new IOException("URL rejected");
   return u;
  }catch(URISyntaxException|IllegalArgumentException e){throw new IOException("URL rejected");}
 }
 public static String bootstrapCookie(String text){
  if(text.length()>1024||!text.contains("<script>")||!text.contains("document.cookie"))return null;
  Matcher m=Pattern.compile("document\\.cookie\\s*=\\s*[\"'](nsess=[a-f0-9]{32})[\"']").matcher(text);
  return m.find()?m.group(1):null;
 }
 public static final class Result {
  public final int status;public final String text,url;
  Result(int s,String t,String u){status=s;text=t;url=u;}
 }
 public Result get(String url,String body,AtomicBoolean cancelled) throws IOException {
  final long deadline=System.nanoTime()/1000000+12000;
  URI target=validate(url);
  if(body!=null&&(!target.getPath().equals("/search/")||body.length()>4096))throw new IOException("Body rejected");
  boolean bootstrapped=false;
  for(int redirect=0;redirect<5;redirect++){
   if(cancelled.get())throw new InterruptedIOException();
   long start=reserve();while(System.nanoTime()/1000000<start){if(cancelled.get())throw new InterruptedIOException();remaining(deadline);try{Thread.sleep(50);}catch(InterruptedException e){Thread.currentThread().interrupt();throw new InterruptedIOException();}}
   HttpURLConnection c=(HttpURLConnection)target.toURL().openConnection();
   c.setInstanceFollowRedirects(false);c.setConnectTimeout(remaining(deadline));c.setReadTimeout(remaining(deadline));
   c.setRequestProperty("Accept-Encoding","gzip");c.setRequestProperty("Accept-Language","ru");
   c.setRequestProperty("User-Agent","WikiReader-Next/0.14 (+https://github.com/mnevrov/wikimapia-reader)");
   if(!session.isEmpty())c.setRequestProperty("Cookie",session);
   try{
    if(body!=null){c.setRequestMethod("POST");c.setDoOutput(true);c.setRequestProperty("Content-Type","application/x-www-form-urlencoded");try(OutputStream out=c.getOutputStream()){out.write(body.getBytes(StandardCharsets.UTF_8));}}
    int status=c.getResponseCode();
    if(status>=300&&status<400){String loc=c.getHeaderField("Location");if(loc==null)throw new IOException("Redirect rejected");target=validate(target.resolve(loc).toString());if(status==303||status==302)body=null;continue;}
    if(status!=200)return new Result(status,"",target.toString());
    InputStream raw=c.getInputStream();
    try(InputStream in="gzip".equalsIgnoreCase(c.getContentEncoding())?new GZIPInputStream(raw):raw;ByteArrayOutputStream out=new ByteArrayOutputStream()){
     byte[] buffer=new byte[8192];int n;
     while(true){c.setReadTimeout(remaining(deadline));n=in.read(buffer);if(n==-1)break;if(cancelled.get())throw new InterruptedIOException();if(out.size()+n>MAX_BYTES)throw new IOException("Too large");out.write(buffer,0,n);}
     String text=out.toString(StandardCharsets.UTF_8.name()),cookie=bootstrapCookie(text);
     if(cookie!=null&&!bootstrapped){session=cookie;bootstrapped=true;continue;}
     return new Result(status,text,target.toString());
    }
   }finally{c.disconnect();}
  }
  throw new IOException("Too many redirects");
 }
}
