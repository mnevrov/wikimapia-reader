package org.example.wikimapreader.car;
import android.content.*;
import android.net.Uri;
import android.os.*;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import androidx.annotation.NonNull;
import androidx.car.app.*;
import androidx.car.app.model.*;
import androidx.car.app.navigation.model.*;
import androidx.car.app.constraints.ConstraintManager;
import androidx.core.graphics.drawable.IconCompat;
import androidx.lifecycle.*;
import org.example.wikimapreader.*;
import org.json.*;
import java.util.*;
import java.util.concurrent.*;
public final class WikiScreen extends Screen implements DefaultLifecycleObserver {
 private final WikiSession session;private final Handler main=new Handler(Looper.getMainLooper());
 private final ExecutorService io=Executors.newSingleThreadExecutor();private List<Place> places=new ArrayList<>();private List<Place> pagePlaces=new ArrayList<>();
 private String status="Сохранённые контуры · данные могут быть устаревшими",requestId="car:"+UUID.randomUUID();private boolean visible,loading,more,viewportDirty,blockedError,showNearby;private volatile int generation;private int page;private double[] bbox;private long selected;
 private Place previewPlace;private String previewText="";
 private CarPlaceCard previewCard;private boolean previewExpanded;
 private List<Place> previewHits=Collections.emptyList();private int previewIndex,previewGeneration;
 private final String previewRequestId="preview:"+UUID.randomUUID();
 private final Map<Long,CarPlaceCard> previewCache=new LinkedHashMap<Long,CarPlaceCard>(32,.75f,true){
  @Override protected boolean removeEldestEntry(Map.Entry<Long,CarPlaceCard> entry){return size()>32;}
 };
 private final Runnable refreshRequest=()->load(false);
 private double lastLoadLat=Double.NaN,lastLoadLon=Double.NaN,lastLoadZoom=Double.NaN;
 private long lastFailureAt;
 private final Map<Integer,CarIcon> highResIcons=new HashMap<>();
 WikiScreen(CarContext c,WikiSession s){super(c);session=s;selected=s.store.selected();getLifecycle().addObserver(this);}
 @Override public void onStart(@NonNull LifecycleOwner owner){visible=true;io.execute(()->{List<Place> rows=session.store.cached();main.post(()->{places=rows;refresh();if(visible)load(false);});});}
 @Override public void onStop(@NonNull LifecycleOwner owner){suspend();}
 void suspend(){visible=false;generation++;previewGeneration++;loading=false;main.removeCallbacks(refreshRequest);WikiApi.INSTANCE.cancel(requestId);WikiApi.INSTANCE.cancel(previewRequestId);}
 void dispose(){suspend();io.shutdownNow();}
 void viewportChanged(){viewportChanged(false);}
 void viewportChanged(boolean gpsMotion){
  if(!visible)return;
  if(gpsMotion){
   synchronized(session.view){
    if(Double.isFinite(lastLoadLat)&&Math.abs(lastLoadZoom-session.view.zoom)<0.01
      &&Geo.distance(lastLoadLat,lastLoadLon,session.view.lat,session.view.lon)<100){refresh();return;}
   }
   if(blockedError&&SystemClock.elapsedRealtime()-lastFailureAt<30000){refresh();return;}
  }
  viewportDirty=true;
  if(!loading){
   main.removeCallbacks(refreshRequest);
   main.postDelayed(refreshRequest,gpsMotion?1200:900);
  }
  refresh();
 }
 void refresh(){if(session.renderer!=null)session.renderer.update(places,selected,session.gps);invalidate();}
 private void persist(){io.execute(()->{try{synchronized(session.view){session.store.viewport(session.view,selected);}}catch(Exception ignored){}});}
 void load(boolean next){load(next,false);}
 void load(boolean next,boolean force){if(!visible)return;
 synchronized(session.view){lastLoadLat=session.view.lat;lastLoadLon=session.view.lon;lastLoadZoom=session.view.zoom;}
 blockedError=false;viewportDirty=false;loading=false;generation++;final int g=generation;WikiApi.INSTANCE.cancel(requestId);double[] b;int[] size=session.renderer!=null?session.renderer.viewSize():new int[]{800,480};synchronized(session.view){if(next&&bbox!=null)b=bbox;else{List<double[]> boxes=session.view.boxes(size[0],size[1]);b=boxes.isEmpty()?session.view.box():boxes.get(0);if(!force)for(double[] candidate:boxes)if(session.store.fresh(candidate)==null){b=candidate;break;}}}final double[] targetBox=b;bbox=b;if(!next){page=0;pagePlaces=new ArrayList<>();JSONObject cached=force?null:session.store.fresh(b);if(cached!=null){try{JSONArray cachedBox=cached.getJSONArray("bbox");bbox=new double[]{cachedBox.getDouble(0),cachedBox.getDouble(1),cachedBox.getDouble(2),cachedBox.getDouble(3)};JSONArray cachedRows=cached.getJSONObject("state").getJSONArray("places");for(int i=0;i<cachedRows.length();i++)pagePlaces.add(Place.contour(cachedRows.getJSONObject(i)));page=cached.getJSONObject("state").optInt("page",1);more=cached.getJSONObject("state").optBoolean("more");status=more?"Кэш · неполное покрытие · доступны ещё страницы":cached.getJSONObject("state").optBoolean("complete",false)?"Свежий кэш области":"Кэш · покрытие неполное";refresh();persist();return;}catch(Exception ignored){}}}final int requested=page+1;JSONObject opts=new JSONObject();try{opts.put("bbox",new JSONArray(b)).put("page",requested);}catch(JSONException ignored){}loading=true;status="Загрузка · сохранённые контуры видны";refresh();WikiApi.INSTANCE.request(requestId,new CredentialRepository(getCarContext()),"box",opts,(data,error)->{if(error!=null){main.post(()->{if(g!=generation)return;loading=false;more=false;blockedError=true;lastFailureAt=SystemClock.elapsedRealtime();status=error+" · кэш может быть устаревшим";refresh();});return;}try{List<Place> incoming=Place.area(data);Map<Long,Place> unique=new LinkedHashMap<>();for(Place p:pagePlaces)unique.put(p.id,p);int before=unique.size();for(Place p:incoming)unique.put(p.id,p);List<Place> accumulated=new ArrayList<>(unique.values());boolean site="site".equals(data.optString("source"));
 boolean hasMore=site?data.optBoolean("more",false):(unique.size()>before&&!incoming.isEmpty()&&(data.has("found")?unique.size()<data.optInt("found"):incoming.size()==50));
 boolean complete=site?data.optBoolean("complete",false):(!hasMore&&(data.has("found")?unique.size()>=data.optInt("found"):incoming.size()<50));JSONArray contours=new JSONArray();for(Place p:accumulated)contours.put(p.contour());JSONObject r=new JSONObject().put("bbox",new JSONArray(targetBox)).put("updated",System.currentTimeMillis()).put("state",new JSONObject().put("places",contours).put("page",requested).put("more",hasMore).put("complete",complete));
 synchronized(this){if(g!=generation)return;session.store.putArea(r);}List<Place> cached=session.store.cached();main.post(()->{if(g!=generation)return;pagePlaces=accumulated;places=cached;page=requested;more=hasMore;loading=false;status=hasMore?"Неполное покрытие · ещё страницы доступны":(complete?"Загружена область":data.has("warning")?data.optString("warning"):"Загружено частично · не все контуры подтверждены");refresh();persist();if(shouldReloadAfterSuccess(viewportDirty,visible)){main.removeCallbacks(refreshRequest);main.postDelayed(refreshRequest,1000);}});}catch(Exception e){main.post(()->{if(g==generation){loading=false;blockedError=true;status="Не удалось сохранить область";refresh();}});}});}
 /** Reload only when camera changed while a request was running; never poll the same area. */
 static boolean shouldReloadAfterSuccess(boolean viewportChanged,boolean visible){return viewportChanged&&visible;}
 private String mapStatus(){
  boolean follow;
  synchronized(session.view){follow=session.view.follow;}
  String prefix=session.gps==null?session.gpsStatus:follow?"GPS Follow: вкл":"GPS Follow: пауза";
  String contour=blockedError?"Контуры Wikimapia: ошибка · обновите область"
   :loading?"Контуры Wikimapia: загрузка…"
   :"Контуры Wikimapia: "+status;
  return prefix+" · "+contour;
 }
 /** Rasterize source vectors at 96px to avoid host-side mdpi resource upscaling. */
 private CarIcon icon(int id){
  CarIcon existing=highResIcons.get(id);if(existing!=null)return existing;
  Drawable drawable=getCarContext().getDrawable(id);
  if(drawable==null)return new CarIcon.Builder(IconCompat.createWithResource(getCarContext(),id)).build();
  Bitmap bitmap=Bitmap.createBitmap(96,96,Bitmap.Config.ARGB_8888);
  Canvas canvas=new Canvas(bitmap);drawable.setBounds(0,0,96,96);drawable.draw(canvas);
  CarIcon result=new CarIcon.Builder(IconCompat.createWithBitmap(bitmap)).build();
  highResIcons.put(id,result);return result;
 }
 private Action action(String title,int image,Runnable run){
  return new Action.Builder().setIcon(icon(image)).setOnClickListener(run::run).build();
 }
 private void toggleNearby(){showNearby=!showNearby;if(showNearby)clearPreview();invalidate();}
 private ActionStrip controls(){return new ActionStrip.Builder().addAction(Action.PAN).addAction(action("Приблизить",org.example.wikimapreader.R.drawable.car_zoom_in,()->session.renderer.zoom(1))).addAction(action("Отдалить",org.example.wikimapreader.R.drawable.car_zoom_out,()->session.renderer.zoom(-1))).addAction(action("GPS Follow / к автомобилю",org.example.wikimapreader.R.drawable.car_my_location,()->{if(session.gps==null){session.permission();return;}synchronized(session.view){session.view.follow=true;session.view.lat=session.gps[0];session.view.lon=session.gps[1];}viewportChanged();})).build();}
 private int limit(){try{return Math.min(20,getCarContext().getCarService(ConstraintManager.class).getContentLimit(ConstraintManager.CONTENT_LIMIT_TYPE_LIST));}catch(Exception e){return 6;}}
 private List<Place> nearest(){List<Place> out=new ArrayList<>(places);double a=session.gps!=null?session.gps[0]:session.view.lat,b=session.gps!=null?session.gps[1]:session.view.lon;out.sort(Comparator.comparingDouble(p->{double[] q=p.point();return q==null?Double.MAX_VALUE:Geo.distance(a,b,q[0],q[1]);}));return out;}
 private ItemList rows(List<Place> source,boolean map){return rows(source,map,false);}
 private ItemList rows(List<Place> source,boolean map,boolean inlinePreview){ItemList.Builder rows=new ItemList.Builder().setNoItemsMessage("Нет объектов. Переместите карту или догрузите область");int n=0;for(Place p:source){if(n>=limit())break;double[] q=p.point();if(map&&q==null)continue;Row.Builder row=new Row.Builder().setTitle(p.title).setOnClickListener(()->{if(inlinePreview)showPreview(Collections.singletonList(p),0);else detail(p);});if(session.gps!=null&&q!=null)row.addText(Math.round(Geo.distance(session.gps[0],session.gps[1],q[0],q[1]))+" м");else row.addText("Wikimapia #"+p.id);if(map)row.setBrowsable(true);if(map)row.setMetadata(new Metadata.Builder().setPlace(new androidx.car.app.model.Place.Builder(CarLocation.create(q[0],q[1])).setMarker(new PlaceMarker.Builder().setLabel(String.valueOf(n+1)).build()).build()).build());rows.addItem(row.build());n++;}return rows.build();}
 @NonNull @Override public Template onGetTemplate(){
  ActionStrip top=new ActionStrip.Builder()
   .addAction(action("Поиск",org.example.wikimapreader.R.drawable.car_search,()->getScreenManager().push(new Search(getCarContext()))))
   .addAction(action("Избранное",org.example.wikimapreader.R.drawable.car_favorite,this::favorites))
   .addAction(previewPlace!=null?action("Закрыть карточку",org.example.wikimapreader.R.drawable.car_close,this::clearPreview)
    :action(showNearby?"Скрыть список":"Объекты рядом",org.example.wikimapreader.R.drawable.car_nearby,this::toggleNearby))
   .addAction(action("Подложка карты",org.example.wikimapreader.R.drawable.car_layers,()->getScreenManager().push(new Basemaps(getCarContext())))).build();
  if(getCarContext().getCarAppApiLevel()<7)
   return new PlaceListMapTemplate.Builder().setTitle("WikiReader").setHeaderAction(Action.APP_ICON)
    .setItemList(rows(nearest(),true)).setActionStrip(top).build();
  Header header=new Header.Builder().setTitle("WikiReader").setStartHeaderAction(Action.APP_ICON).build();
  Template content;
  if(previewPlace!=null&&!showNearby&&previewExpanded){
   content=new ListTemplate.Builder().setHeader(header)
    .setSingleList(objectRows(previewPlace,previewCard,previewText,true)).build();
  }else if(previewPlace!=null&&!showNearby){
   Pane.Builder pane=new Pane.Builder().addRow(new Row.Builder()
    .setTitle(previewCard!=null?previewCard.title:previewPlace.title)
    .addText(previewText+(previewHits.size()>1?" · "+(previewIndex+1)+"/"+previewHits.size():"")).build());
   pane.addRow(new Row.Builder().setTitle("Wikimapia #"+previewPlace.id)
    .addText(previewCard==null?"Сведения загружаются":previewCard.mediaSummary()).build());
   pane.addAction(new Action.Builder().setTitle("Подробнее")
    .setIcon(icon(org.example.wikimapreader.R.drawable.car_info))
    .setOnClickListener(()->{previewExpanded=true;invalidate();}).build());
   if(previewPlace.point()!=null){
    pane.addAction(new Action.Builder().setTitle("Маршрут")
     .setIcon(icon(org.example.wikimapreader.R.drawable.car_route))
     .setOnClickListener(this::navigatePreview).build());
   }else{
    pane.addAction(new Action.Builder().setTitle("Закрыть")
     .setIcon(icon(org.example.wikimapreader.R.drawable.car_close))
     .setOnClickListener(this::clearPreview).build());
   }
   content=new PaneTemplate.Builder(pane.build()).setHeader(header).build();
  }else if(showNearby){
   ItemList.Builder nearby=new ItemList.Builder()
    .addItem(new Row.Builder().setTitle(loading?"Загрузка области":status)
     .addText(session.gpsStatus).addText(session.renderer==null?"Подложка: ожидание":session.renderer.tileStatus()).build());
   int shown=1;for(Item item:rows(nearest(),false,true).getItems()){
    if(shown++>=limit())break;
    nearby.addItem(item);
   }
   content=new ListTemplate.Builder().setHeader(header).setSingleList(nearby.build()).build();
  }else{
   Pane pane=new Pane.Builder().addRow(new Row.Builder()
    .setTitle(places.isEmpty()?"Карта Wikimapia":"Объектов в области: "+places.size())
    .addText(mapStatus())
     .addText(session.renderer==null?"Подложка: ожидание":session.renderer.tileStatus()).build()).build();
   content=new PaneTemplate.Builder(pane).setHeader(header).build();
  }
  return new MapWithContentTemplate.Builder().setContentTemplate(content)
   .setMapController(new MapController.Builder().setMapActionStrip(controls())
     .setPanModeListener(panning->{}).build()).setActionStrip(top).build();
 }

 /** Native car host can deliver map taps while driving; no screen push or parked-only listener. */
 void tap(double lat,double lon){
  List<Place> hits=new ArrayList<>();
  for(Place p:places)if(Geo.inside(p.coords,lat,lon))hits.add(p);
  hits.sort(Comparator.comparingDouble(WikiScreen::area).thenComparingLong(p->p.id));
  if(hits.isEmpty()){clearPreview();return;}
  int next=0;
  if(previewPlace!=null)for(int i=0;i<hits.size();i++)
   if(hits.get(i).id==previewPlace.id){next=(i+1)%hits.size();break;}
  showPreview(hits,next);
 }
 static String shortPreview(String html){
  if(html==null)return "";
  String s=html.replaceAll("(?is)<[^>]*>"," ").replace("&nbsp;"," ")
   .replace("&quot;","\"").replace("&amp;","&").replaceAll("\\s+"," ").trim();
  return s.length()>105?s.substring(0,102)+"…":s;
 }
 private void clearPreview(){
  previewGeneration++;WikiApi.INSTANCE.cancel(previewRequestId);
  previewPlace=null;previewCard=null;previewExpanded=false;previewHits=Collections.emptyList();previewText="";
  selected=0;persist();refresh();
 }
 private void showPreview(List<Place> hits,int index){
  if(hits.isEmpty()){clearPreview();return;}
  previewGeneration++;WikiApi.INSTANCE.cancel(previewRequestId);
  previewHits=new ArrayList<>(hits);previewIndex=index;previewPlace=hits.get(index);
  previewExpanded=false;selected=previewPlace.id;showNearby=false;
  previewCard=previewCache.get(previewPlace.id);
  String description=previewCard==null?CarPlaceCard.clean(previewPlace.description,6000):previewCard.description;
  previewText=description.isEmpty()?"Загружаем описание объекта":shortPreview(description);
  persist();refresh();
  if(previewCard!=null)return;
  final int requestGeneration=previewGeneration;final long id=previewPlace.id;
  try{
   JSONObject opts=new JSONObject().put("id",id);
   WikiApi.INSTANCE.request(previewRequestId,new CredentialRepository(getCarContext()),"place.getbyid",opts,
    (data,error)->main.post(()->{
     if(requestGeneration!=previewGeneration||previewPlace==null||previewPlace.id!=id)return;
     if(error==null)try{
      CarPlaceCard details=CarPlaceCard.from(data,previewPlace);
      previewCard=details;previewCache.put(id,details);
      previewText=details.description.isEmpty()?"Описание не добавлено":shortPreview(details.description);
     }catch(Exception ignored){previewText="Не удалось разобрать карточку объекта";}
     else if(description.isEmpty())previewText=error;
     invalidate();
    }));
  }catch(Exception ignored){previewText="Не удалось загрузить карточку объекта";invalidate();}
 }
 private void navigatePreview(){
  if(previewPlace==null)return;
  double[] q=previewPlace.point();
  if(q==null)return;
  try{getCarContext().startCarApp(new Intent(CarContext.ACTION_NAVIGATE,Uri.parse("geo:"+q[0]+","+q[1])));}
  catch(RuntimeException e){previewText="Совместимый навигатор не найден";invalidate();}
 }
 private static double area(Place p){double sum=0;for(int i=0,j=p.coords.length-1;i<p.coords.length;j=i++)sum+=Geo.delta(p.coords[j][1],p.coords[0][1])*p.coords[i][0]-Geo.delta(p.coords[i][1],p.coords[0][1])*p.coords[j][0];return Math.abs(sum);}
 private void openPhone(Place p){
  try{
   session.store.pending(p.id);
   Intent intent=new Intent(getCarContext(),MainActivity.class)
    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP);
   getCarContext().startActivity(intent);
  }catch(Exception ignored){}
 }
 private void navigate(Place p){
  double[] q=p.point();if(q==null)return;
  try{getCarContext().startCarApp(new Intent(CarContext.ACTION_NAVIGATE,Uri.parse("geo:"+q[0]+","+q[1])));}
  catch(RuntimeException ignored){}
 }
 private boolean isFavorite(long id){
  JSONArray list=session.store.favorites();
  for(int i=0;i<list.length();i++){
   JSONObject f=list.optJSONObject(i);
   if(f!=null&&f.optLong("id")==id&&"wikimapia".equals(f.optString("source")))return true;
  }
  return false;
 }
 private void toggleFavorite(Place p){
  io.execute(()->{try{session.store.toggle(p);}catch(Exception ignored){}
   main.post(this::invalidate);});
 }
 private void fullDescription(Place p,CarPlaceCard card){
  String text=card==null?CarPlaceCard.clean(p.description,6000):card.description;
  if(!text.isEmpty())getScreenManager().push(new FullDescription(getCarContext(),p.title,text));
 }
 private ItemList objectRows(Place p,CarPlaceCard card,String state,boolean onMap){
  String description=card==null?CarPlaceCard.clean(p.description,6000):card.description;
  String title=card==null?p.title:card.title;
  List<Row> items=new ArrayList<>();
  StringBuilder identity=new StringBuilder("Wikimapia #"+p.id);
  double[] point=p.point();
  if(session.gps!=null&&point!=null)identity.append(" · ").append(Math.round(Geo.distance(
   session.gps[0],session.gps[1],point[0],point[1]))).append(" м");
  items.add(new Row.Builder().setTitle(title).addText(identity.toString()).build());
  items.add(new Row.Builder().setTitle("Описание").addText(
   description.isEmpty()?(card==null?state:"Описание не добавлено"):CarPlaceCard.excerpt(description,230)).build());
  if(point!=null)items.add(new Row.Builder().setTitle("Маршрут к объекту")
   .setOnClickListener(()->navigate(p)).build());
  if(card!=null){
   String subtitle=!card.commentsKnown?"Сведения временно недоступны":
    card.comments.isEmpty()?"Нет комментариев":
    CarPlaceCard.excerpt(card.comments.get(0).text,130);
   Row.Builder row=new Row.Builder()
    .setTitle(card.commentsKnown?"Комментарии: "+card.commentCount:"Комментарии: нет данных").addText(subtitle);
   if(!card.comments.isEmpty())row.setOnClickListener(()->getScreenManager().push(
    new Comments(getCarContext(),card)));
   items.add(row.build());
   Row.Builder photos=new Row.Builder()
    .setTitle(card.photosKnown?"Фотографии: "+card.photoCount:"Фотографии: нет данных")
    .addText(!card.photosKnown?"Сведения временно недоступны":
     card.photoCount>0?"Смотреть на телефоне, когда остановитесь":"Фотографии не добавлены");
   if(card.photoCount>0&&card.photosKnown)
    photos.setOnClickListener(ParkedOnlyOnClickListener.create(()->openPhone(p)));
   items.add(photos.build());
  }
  items.add(new Row.Builder().setTitle(isFavorite(p.id)?"Удалить из избранного":"В избранное")
   .setOnClickListener(()->toggleFavorite(p)).build());
  if(!description.isEmpty())items.add(new Row.Builder().setTitle("Читать полное описание (на стоянке)")
   .setOnClickListener(ParkedOnlyOnClickListener.create(()->fullDescription(p,card))).build());
  items.add(new Row.Builder().setTitle("Открыть карточку на телефоне (на стоянке)")
   .setOnClickListener(ParkedOnlyOnClickListener.create(()->openPhone(p))).build());
  if(onMap)items.add(new Row.Builder().setTitle("Свернуть карточку")
   .setOnClickListener(()->{previewExpanded=false;invalidate();}).build());
  int count=Math.max(2,limit());
  ItemList.Builder list=new ItemList.Builder();
  if(items.size()<=count){for(Row row:items)list.addItem(row);}
  else{
   for(int i=0;i<Math.min(count-1,items.size());i++)list.addItem(items.get(i));
   list.addItem(new Row.Builder().setTitle("Дополнительные сведения и действия")
    .setOnClickListener(()->getScreenManager().push(
     new More(getCarContext(),p,card,onMap))).build());
  }
  return list.build();
 }
 private final class More extends Screen{
  final Place place;final CarPlaceCard card;final boolean fromMap;
  More(CarContext c,Place p,CarPlaceCard d,boolean fromMap){super(c);place=p;card=d;this.fromMap=fromMap;}
  @NonNull @Override public Template onGetTemplate(){
   ItemList.Builder list=new ItemList.Builder();
   list.addItem(new Row.Builder().setTitle(isFavorite(place.id)?"Удалить из избранного":"В избранное")
    .setOnClickListener(()->toggleFavorite(place)).build());
   String text=card==null?CarPlaceCard.clean(place.description,6000):card.description;
   if(!text.isEmpty())list.addItem(new Row.Builder().setTitle("Читать полное описание (на стоянке)")
    .setOnClickListener(ParkedOnlyOnClickListener.create(()->fullDescription(place,card))).build());
   list.addItem(new Row.Builder().setTitle("Открыть на телефоне (на стоянке)")
    .setOnClickListener(ParkedOnlyOnClickListener.create(()->openPhone(place))).build());
   if(fromMap)list.addItem(new Row.Builder().setTitle("Свернуть карточку")
    .setOnClickListener(()->{previewExpanded=false;getScreenManager().pop();invalidate();}).build());
   return new ListTemplate.Builder().setTitle("Действия с объектом").setHeaderAction(Action.BACK)
    .setSingleList(list.build()).build();
  }
 }
 private static final class FullDescription extends Screen{
  final String title,description;
  FullDescription(CarContext c,String title,String description){super(c);this.title=title;this.description=description;}
  @NonNull @Override public Template onGetTemplate(){
   return new LongMessageTemplate.Builder(description).setTitle(title)
    .setHeaderAction(Action.BACK).build();
  }
 }
 private final class Comments extends Screen{
  final CarPlaceCard card;
  Comments(CarContext c,CarPlaceCard d){super(c);card=d;}
  @NonNull @Override public Template onGetTemplate(){
   ItemList.Builder list=new ItemList.Builder();
   int max=limit();
   for(int i=0;i<Math.min(max,card.comments.size());i++){
    CarPlaceCard.Comment comment=card.comments.get(i);
    String author=comment.author+(comment.date.isEmpty()?"":" · "+comment.date);
    list.addItem(new Row.Builder().setTitle(author)
     .addText(CarPlaceCard.excerpt(comment.text,200))
     .setOnClickListener(ParkedOnlyOnClickListener.create(()->getScreenManager().push(
      new FullDescription(getCarContext(),comment.author,comment.text)))).build());
   }
   return new ListTemplate.Builder().setTitle("Комментарии · "+card.commentCount)
    .setHeaderAction(Action.BACK).setSingleList(list.build()).build();
  }
 }
 private void favorites(){List<Place> list=new ArrayList<>();JSONArray a=session.store.favorites();for(int i=0;i<a.length();i++)try{JSONObject f=a.getJSONObject(i);if(!f.optString("source").equals("wikimapia"))continue;long id=f.getLong("id");Place found=null;for(Place p:places)if(p.id==id)found=p;list.add(found!=null?found:new Place(id,f.optString("title"),"",new double[0][]));}catch(Exception ignored){}getScreenManager().push(new Places(getCarContext(),"Избранное",list));}
 private void detail(Place p){selected=p.id;persist();refresh();getScreenManager().push(new Detail(getCarContext(),p));}

 /** Open the official linked map address, without ever including private tile credentials. */
 void openYandexAttribution(){
  try{
   Intent intent=new Intent(Intent.ACTION_VIEW,Uri.parse("https://yandex.ru/maps/"));
   intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
   getCarContext().startActivity(intent);
  }catch(RuntimeException error){
   status="Откройте Яндекс Карты на телефоне при остановке";
   invalidate();
  }
 }
 private final class Basemaps extends Screen {
  Basemaps(CarContext c){super(c);}
  private void select(String provider){
   try{
    YandexTileSettings.get(getCarContext()).select(provider);
    if(session.renderer!=null)session.renderer.draw();
    WikiScreen.this.invalidate();
    getScreenManager().pop();
   }catch(Exception e){invalidate();}
  }
  @NonNull @Override public Template onGetTemplate(){
   YandexTileSettings settings=YandexTileSettings.get(getCarContext());
   String source=settings.selected();
   ItemList.Builder list=new ItemList.Builder();
   list.addItem(new Row.Builder().setTitle("Состояние подложки")
    .addText(session.renderer==null?"Нет карты":session.renderer.tileStatus()).build());
   list.addItem(new Row.Builder().setTitle(("osm".equals(source)?"✓ ":"")+"OpenStreetMap")
    .setOnClickListener(()->select("osm")).build());
   if(getCarContext().getCarAppApiLevel()>=7&&settings.configured()){
    list.addItem(new Row.Builder().setTitle(("yandex".equals(source)?"✓ ":"")+"Яндекс Карты")
     .addText("Tiles API · схема · 512 px")
     .setOnClickListener(()->select("yandex")).build());
   }else{
    list.addItem(new Row.Builder().setTitle("Яндекс Карты недоступны")
     .addText(settings.configured()?"Требуется Car App API 7+":"Добавьте Tiles API ключ в настройках телефона").build());
   }
   list.addItem(new Row.Builder().setTitle("Обновить контуры")
    .setOnClickListener(()->{getScreenManager().pop();load(false,true);}).build());
   list.addItem(new Row.Builder().setTitle("Открыть Яндекс Карты")
    .addText("Официальный сайт · на стоянке")
    .setOnClickListener(ParkedOnlyOnClickListener.create(WikiScreen.this::openYandexAttribution)).build());
   return new ListTemplate.Builder().setTitle("Подложка карты").setHeaderAction(Action.BACK)
    .setSingleList(list.build()).build();
  }
 }
 private class Places extends Screen {final String title;final List<Place> data;Places(CarContext c,String title,List<Place> data){super(c);this.title=title;this.data=data;}@NonNull @Override public Template onGetTemplate(){return new ListTemplate.Builder().setTitle(title).setHeaderAction(Action.BACK).setSingleList(rows(data,false)).build();}}
 private class Detail extends Screen implements DefaultLifecycleObserver {
  Place place;CarPlaceCard card;String message="Загружаем сведения об объекте";
  final String id="detail:"+UUID.randomUUID();boolean active;
  Detail(CarContext c,Place p){super(c);place=p;getLifecycle().addObserver(this);}
  @Override public void onStart(@NonNull LifecycleOwner o){
   active=true;
   try{JSONObject opts=new JSONObject().put("id",place.id);
    WikiApi.INSTANCE.request(id,new CredentialRepository(getCarContext()),"place.getbyid",opts,
     (data,error)->main.post(()->{
      if(!active)return;
      if(error==null)try{
       CarPlaceCard loaded=CarPlaceCard.from(data,place);
       card=loaded;
       place=new Place(place.id,loaded.title,loaded.description,place.coords);
       message="";
      }catch(Exception ignored){message="Не удалось разобрать сведения об объекте";}
      else message=error;
      invalidate();
     }));
   }catch(Exception ignored){message="Не удалось загрузить сведения об объекте";}
  }
  @Override public void onStop(@NonNull LifecycleOwner o){active=false;WikiApi.INSTANCE.cancel(id);}
  @NonNull @Override public Template onGetTemplate(){
   return new ListTemplate.Builder().setTitle("Wikimapia #"+place.id)
    .setHeaderAction(Action.BACK).setSingleList(objectRows(place,card,message,false)).build();
  }
 }
 private class Search extends Screen implements DefaultLifecycleObserver {List<Place> results=new ArrayList<>();JSONArray locations=new JSONArray();String query="",error="Название, ID или ссылка Wikimapia";boolean busy,active;final String id="search:"+UUID.randomUUID();
 Search(CarContext c){super(c);getLifecycle().addObserver(this);}
 @Override public void onStart(@NonNull LifecycleOwner o){active=true;}@Override public void onStop(@NonNull LifecycleOwner o){active=false;busy=false;WikiApi.INSTANCE.cancel(id);}
 void submit(String text){query=text.trim();String number=query;try{if(query.startsWith("https://")||query.startsWith("http://")){Uri uri=Uri.parse(query);if(!Arrays.asList("wikimapia.org","www.wikimapia.org").contains(uri.getHost()))throw new IllegalArgumentException();number=uri.getPathSegments().get(0);}if(number.matches("[1-9][0-9]{0,15}")){long n=Long.parseLong(number);if(n>9007199254740991L)throw new IllegalArgumentException();detail(new Place(n,"Объект #"+n,"",new double[0][]));return;}if(query.isEmpty()||query.length()>200)throw new IllegalArgumentException();JSONObject opts=new JSONObject().put("query",query).put("lat",session.view.lat).put("lon",session.view.lon);busy=true;invalidate();WikiApi.INSTANCE.request(id,new CredentialRepository(getCarContext()),"search",opts,(data,e)->main.post(()->{if(!active)return;busy=false;error=e==null?"Ничего не найдено":e;results=e==null?Place.area(data):new ArrayList<>();locations=e==null?data.optJSONArray("locations"):null;invalidate();}));}catch(Exception e){error="Введите название, ID или ссылку Wikimapia";invalidate();}}
 @NonNull @Override public Template onGetTemplate(){ItemList list;
 if(locations!=null&&locations.length()>0){
    ItemList.Builder builderRows=new ItemList.Builder();
    for(int i=0;i<Math.min(20,locations.length());i++){
      JSONObject item=locations.optJSONObject(i);if(item==null)continue;
      double targetLat=item.optDouble("lat",Double.NaN),targetLon=item.optDouble("lon",Double.NaN);
      if(!Double.isFinite(targetLat)||!Double.isFinite(targetLon))continue;
      builderRows.addItem(new Row.Builder().setTitle(item.optString("title","Wikimapia")).addText("Показать эту область на карте")
        .setOnClickListener(()->{
          synchronized(session.view){session.view.lat=targetLat;session.view.lon=targetLon;session.view.zoom=16;}
          getScreenManager().pop();WikiScreen.this.viewportChanged();
        }).build());
    }
    list=builderRows.build();
 }else list=results.isEmpty()?new ItemList.Builder().setNoItemsMessage(error).build():rows(results,false);
 SearchTemplate.Builder builder=new SearchTemplate.Builder(new SearchTemplate.SearchCallback(){@Override public void onSearchSubmitted(@NonNull String text){submit(text);}}).setHeaderAction(Action.BACK).setSearchHint("Название или ID").setInitialSearchText(query).setLoading(busy);if(!busy)builder.setItemList(list);return builder.build();}}
}
