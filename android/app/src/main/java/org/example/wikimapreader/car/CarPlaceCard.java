package org.example.wikimapreader.car;

import android.text.Html;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Read-only, bounded projection of the same place blocks used by the phone card. */
final class CarPlaceCard {
 static final class Comment {
  final String author,text,date;
  Comment(String author,String text,String date){this.author=author;this.text=text;this.date=date;}
 }
 final long id;
 final String title,description;
 final List<Comment> comments;
 final int photoCount,commentCount;
 final boolean photosKnown,commentsKnown;

 private CarPlaceCard(long id,String title,String description,List<Comment> comments,
                      int photoCount,int commentCount,boolean photosKnown,boolean commentsKnown) {
  this.id=id;this.title=title;this.description=description;
  this.comments=Collections.unmodifiableList(comments);
  this.photoCount=photoCount;this.commentCount=commentCount;
  this.photosKnown=photosKnown;this.commentsKnown=commentsKnown;
 }
 static CarPlaceCard fallback(Place place) {
  return new CarPlaceCard(place.id,place.title,clean(place.description,6000),
   new ArrayList<>(),0,0,false,false);
 }
 static CarPlaceCard from(JSONObject payload,Place fallback) {
  JSONObject place=payload.optJSONObject("place");
  if(place==null)place=payload;
  JSONObject main=place.optJSONObject("main");
  if(main==null)main=place;
  long id=place.optLong("id",main.optLong("id",fallback.id));
  if(id!=fallback.id)throw new IllegalArgumentException("Another Wikimapia object");
  String title=clean(main.optString("title",place.optString("title",fallback.title)),200);
  if(title.isEmpty())title=fallback.title;
  String description=clean(main.optString("description",place.optString("description",fallback.description)),6000);
  JSONArray photos=items(place,"photos","photo");
  JSONArray rawComments=items(place,"comments","comment");
  JSONObject blocks=payload.optJSONObject("blocks");
  boolean photosKnown=photos!=null && !(blocks!=null&&"unavailable".equals(blocks.optString("photos")));
  boolean commentsKnown=rawComments!=null && !(blocks!=null&&"unavailable".equals(blocks.optString("comments")));
  List<Comment> comments=new ArrayList<>();
  if(rawComments!=null)for(int i=0;i<rawComments.length()&&comments.size()<8;i++){
   JSONObject c=rawComments.optJSONObject(i);
   if(c==null||c.optBoolean("is_deleted")||"1".equals(c.optString("is_deleted")))continue;
   String text=clean(value(c,"text","comment","message"),1000);
   if(text.isEmpty())continue;
   String author=clean(value(c,"author_name","user_name","name","author"),100);
   String date=clean(value(c,"dateLabel","date_label"),100);
   comments.add(new Comment(author.isEmpty()?"Участник Wikimapia":author,text,date));
  }
  int photoTotal=photos==null?0:photos.length(),commentTotal=comments.size();
  return new CarPlaceCard(id,title,description,comments,
   Math.max(photoTotal,place.optInt("photos_count",photoTotal)),
   Math.max(comments.size(),place.optInt("comments_count",commentTotal)),photosKnown,commentsKnown);
 }
 private static String value(JSONObject o,String... names){
  for(String name:names){Object value=o.opt(name);if(value instanceof String&&!((String)value).isEmpty())return (String)value;}
  return "";
 }
 private static JSONArray items(JSONObject source,String plural,String singular){
  Object raw=source.opt(plural);
  if(raw instanceof JSONArray)return (JSONArray)raw;
  if(raw instanceof JSONObject){
   JSONObject wrapper=(JSONObject)raw;
   Object nested=wrapper.opt(singular);
   if(nested instanceof JSONArray)return (JSONArray)nested;
   if(nested instanceof JSONObject)return new JSONArray().put(nested);
   nested=wrapper.opt("items");
   if(nested instanceof JSONArray)return (JSONArray)nested;
  }
  return null;
 }
 static String clean(String value,int maximum){
  if(value==null)return "";
  String withoutScripts=value.replaceAll("(?is)<(?:script|style)\\b[^>]*>.*?</(?:script|style)>","");
  String plain=Html.fromHtml(withoutScripts,Html.FROM_HTML_MODE_LEGACY).toString()
   .replace('\u00a0',' ').replaceAll("[\\p{Cntrl}&&[^\\n]]"," ")
   .replaceAll("[ \\t]+"," ").replaceAll(" *\\n *","\n").replaceAll("\\n{3,}","\n\n").trim();
  if(plain.length()>maximum)return plain.substring(0,maximum-1)+"…";
  return plain;
 }
 static String excerpt(String text,int maximum){
  String oneLine=text.replaceAll("\\s+"," ").trim();
  return oneLine.length()>maximum?oneLine.substring(0,maximum-1)+"…":oneLine;
 }
 String mediaSummary(){
  String photo=photosKnown?("Фото: "+photoCount):"Фото: нет данных";
  String comment=commentsKnown?("Комментарии: "+commentCount):"Комментарии: нет данных";
  return photo+" · "+comment;
 }
}
