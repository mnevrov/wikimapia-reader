package org.example.wikimapreader.car;
import android.content.*;
import android.net.Uri;
import android.os.*;
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
 private final Runnable refreshRequest=()->load(false);
 WikiScreen(CarContext c,WikiSession s){super(c);session=s;selected=s.store.selected();getLifecycle().addObserver(this);}
 @Override public void onStart(@NonNull LifecycleOwner owner){visible=true;io.execute(()->{List<Place> rows=session.store.cached();main.post(()->{places=rows;refresh();if(visible)load(false);});});}
 @Override public void onStop(@NonNull LifecycleOwner owner){suspend();}
 void suspend(){visible=false;generation++;loading=false;main.removeCallbacks(refreshRequest);WikiApi.INSTANCE.cancel(requestId);}
 void dispose(){suspend();io.shutdownNow();}
 void viewportChanged(){if(!visible)return;viewportDirty=true;if(!loading&&!blockedError){main.removeCallbacks(refreshRequest);main.postDelayed(refreshRequest,900);}refresh();}
 void refresh(){if(session.renderer!=null)session.renderer.update(places,selected,session.gps);invalidate();}
 private void persist(){io.execute(()->{try{synchronized(session.view){session.store.viewport(session.view,selected);}}catch(Exception ignored){}});}
 void load(boolean next){if(!visible)return;blockedError=false;viewportDirty=false;loading=false;generation++;final int g=generation;WikiApi.INSTANCE.cancel(requestId);double[] b;int[] size=session.renderer!=null?session.renderer.viewSize():new int[]{800,480};synchronized(session.view){if(next&&bbox!=null)b=bbox;else{List<double[]> boxes=session.view.boxes(size[0],size[1]);b=boxes.isEmpty()?session.view.box():boxes.get(0);for(double[] candidate:boxes)if(session.store.fresh(candidate)==null){b=candidate;break;}}}final double[] targetBox=b;bbox=b;if(!next){page=0;pagePlaces=new ArrayList<>();JSONObject cached=session.store.fresh(b);if(cached!=null){try{JSONArray cachedBox=cached.getJSONArray("bbox");bbox=new double[]{cachedBox.getDouble(0),cachedBox.getDouble(1),cachedBox.getDouble(2),cachedBox.getDouble(3)};JSONArray cachedRows=cached.getJSONObject("state").getJSONArray("places");for(int i=0;i<cachedRows.length();i++)pagePlaces.add(Place.contour(cachedRows.getJSONObject(i)));page=cached.getJSONObject("state").optInt("page",1);more=cached.getJSONObject("state").optBoolean("more");status=more?"Кэш · неполное покрытие · доступны ещё страницы":"Свежий кэш области";refresh();persist();return;}catch(Exception ignored){}}}final int requested=page+1;JSONObject opts=new JSONObject();try{opts.put("bbox",new JSONArray(b)).put("page",requested);}catch(JSONException ignored){}loading=true;status="Загрузка · сохранённые контуры видны";refresh();WikiApi.INSTANCE.request(requestId,new CredentialRepository(getCarContext()),"box",opts,(data,error)->{if(error!=null){main.post(()->{if(g!=generation)return;loading=false;more=false;blockedError=true;status=error+" · кэш может быть устаревшим";refresh();});return;}try{List<Place> incoming=Place.area(data);Map<Long,Place> unique=new LinkedHashMap<>();for(Place p:pagePlaces)unique.put(p.id,p);int before=unique.size();for(Place p:incoming)unique.put(p.id,p);List<Place> accumulated=new ArrayList<>(unique.values());boolean site="site".equals(data.optString("source"));
 boolean hasMore=site?data.optBoolean("more",false):(unique.size()>before&&!incoming.isEmpty()&&(data.has("found")?unique.size()<data.optInt("found"):incoming.size()==50));
 boolean complete=site?data.optBoolean("complete",false):(!hasMore&&(data.has("found")?unique.size()>=data.optInt("found"):incoming.size()<50));JSONArray contours=new JSONArray();for(Place p:accumulated)contours.put(p.contour());JSONObject r=new JSONObject().put("bbox",new JSONArray(targetBox)).put("updated",System.currentTimeMillis()).put("state",new JSONObject().put("places",contours).put("page",requested).put("more",hasMore).put("complete",complete));
 synchronized(this){if(g!=generation)return;session.store.putArea(r);}List<Place> cached=session.store.cached();main.post(()->{if(g!=generation)return;pagePlaces=accumulated;places=cached;page=requested;more=hasMore;loading=false;status=hasMore?"Неполное покрытие · ещё страницы доступны":(complete?"Загружена область":"Загружено частично · не все контуры подтверждены");refresh();persist();if((viewportDirty||!hasMore)&&visible){main.removeCallbacks(refreshRequest);main.postDelayed(refreshRequest,1000);}});}catch(Exception e){main.post(()->{if(g==generation){loading=false;blockedError=true;status="Не удалось сохранить область";refresh();}});}});}
 private CarIcon icon(int id){return new CarIcon.Builder(IconCompat.createWithResource(getCarContext(),id)).build();}
 private Action action(String title,int image,Runnable run){return new Action.Builder().setIcon(new CarIcon.Builder(IconCompat.createWithResource(getCarContext(),image)).build()).setOnClickListener(run::run).build();}
 private void toggleNearby(){showNearby=!showNearby;invalidate();}
 private ActionStrip controls(){return new ActionStrip.Builder().addAction(Action.PAN).addAction(action("Приблизить",android.R.drawable.ic_input_add,()->session.renderer.zoom(1))).addAction(action("Отдалить",org.example.wikimapreader.R.drawable.car_zoom_out,()->session.renderer.zoom(-1))).addAction(action("К автомобилю",android.R.drawable.ic_menu_mylocation,()->{if(session.gps==null){session.permission();return;}synchronized(session.view){session.view.follow=true;session.view.lat=session.gps[0];session.view.lon=session.gps[1];}viewportChanged();})).build();}
 private int limit(){try{return Math.min(20,getCarContext().getCarService(ConstraintManager.class).getContentLimit(ConstraintManager.CONTENT_LIMIT_TYPE_LIST));}catch(Exception e){return 6;}}
 private List<Place> nearest(){List<Place> out=new ArrayList<>(places);double a=session.gps!=null?session.gps[0]:session.view.lat,b=session.gps!=null?session.gps[1]:session.view.lon;out.sort(Comparator.comparingDouble(p->{double[] q=p.point();return q==null?Double.MAX_VALUE:Geo.distance(a,b,q[0],q[1]);}));return out;}
 private ItemList rows(List<Place> source,boolean map){ItemList.Builder rows=new ItemList.Builder().setNoItemsMessage("Нет объектов. Переместите карту или догрузите область");int n=0;for(Place p:source){if(n>=limit())break;double[] q=p.point();if(map&&q==null)continue;Row.Builder row=new Row.Builder().setTitle(p.title).setOnClickListener(()->detail(p));if(session.gps!=null&&q!=null)row.addText(Math.round(Geo.distance(session.gps[0],session.gps[1],q[0],q[1]))+" м");else row.addText("Wikimapia #"+p.id);if(map)row.setBrowsable(true);if(map)row.setMetadata(new Metadata.Builder().setPlace(new androidx.car.app.model.Place.Builder(CarLocation.create(q[0],q[1])).setMarker(new PlaceMarker.Builder().setLabel(String.valueOf(n+1)).build()).build()).build());rows.addItem(row.build());n++;}return rows.build();}
 @NonNull @Override public Template onGetTemplate(){
  ActionStrip top=new ActionStrip.Builder()
   .addAction(action("Поиск",android.R.drawable.ic_menu_search,()->getScreenManager().push(new Search(getCarContext()))))
   .addAction(action("Избранное",android.R.drawable.btn_star_big_on,this::favorites))
   .addAction(action(showNearby?"Скрыть список":"Объекты рядом",android.R.drawable.ic_menu_agenda,this::toggleNearby))
   .addAction(action(more?"Ещё":"Обновить",android.R.drawable.ic_menu_rotate,()->load(more))).build();
  if(getCarContext().getCarAppApiLevel()<7)
   return new PlaceListMapTemplate.Builder().setTitle("WikiReader").setHeaderAction(Action.APP_ICON)
    .setItemList(rows(nearest(),true)).setActionStrip(top).build();
  Header header=new Header.Builder().setTitle("WikiReader").setStartHeaderAction(Action.APP_ICON).build();
  Template content;
  if(showNearby){
   ItemList.Builder nearby=new ItemList.Builder()
    .addItem(new Row.Builder().setTitle(loading?"Загрузка области":status)
     .addText(session.gpsStatus).build());
   int shown=1;for(Item item:rows(nearest(),false).getItems()){
    if(shown++>=limit())break;
    nearby.addItem(item);
   }
   content=new ListTemplate.Builder().setHeader(header).setSingleList(nearby.build()).build();
  }else{
   Pane pane=new Pane.Builder().addRow(new Row.Builder()
    .setTitle(places.isEmpty()?"Карта Wikimapia":"Объектов в области: "+places.size())
    .addText(loading?"Загрузка объектов":status).build()).build();
   content=new PaneTemplate.Builder(pane).setHeader(header).build();
  }
  return new MapWithContentTemplate.Builder().setContentTemplate(content)
   .setMapController(new MapController.Builder().setMapActionStrip(controls())
     .setPanModeListener(panning->{}).build()).setActionStrip(top).build();
 }

 void tap(double lat,double lon){List<Place> hits=new ArrayList<>();for(Place p:places)if(Geo.inside(p.coords,lat,lon))hits.add(p);hits.sort(Comparator.comparingDouble(WikiScreen::area).thenComparingLong(p->p.id));if(hits.size()==1)detail(hits.get(0));else if(!hits.isEmpty())getScreenManager().push(new Places(getCarContext(),"Объекты в точке",hits));}
 private static double area(Place p){double sum=0;for(int i=0,j=p.coords.length-1;i<p.coords.length;j=i++)sum+=Geo.delta(p.coords[j][1],p.coords[0][1])*p.coords[i][0]-Geo.delta(p.coords[i][1],p.coords[0][1])*p.coords[j][0];return Math.abs(sum);}
 private void favorites(){List<Place> list=new ArrayList<>();JSONArray a=session.store.favorites();for(int i=0;i<a.length();i++)try{JSONObject f=a.getJSONObject(i);if(!f.optString("source").equals("wikimapia"))continue;long id=f.getLong("id");Place found=null;for(Place p:places)if(p.id==id)found=p;list.add(found!=null?found:new Place(id,f.optString("title"),"",new double[0][]));}catch(Exception ignored){}getScreenManager().push(new Places(getCarContext(),"Избранное",list));}
 private void detail(Place p){selected=p.id;persist();refresh();getScreenManager().push(new Detail(getCarContext(),p));}
 private class Places extends Screen {final String title;final List<Place> data;Places(CarContext c,String title,List<Place> data){super(c);this.title=title;this.data=data;}@NonNull @Override public Template onGetTemplate(){return new ListTemplate.Builder().setTitle(title).setHeaderAction(Action.BACK).setSingleList(rows(data,false)).build();}}
 private class Detail extends Screen implements DefaultLifecycleObserver {Place place;String message="Краткие сведения · полная карточка на телефоне";final String id="detail:"+UUID.randomUUID();boolean active;
 Detail(CarContext c,Place p){super(c);place=p;getLifecycle().addObserver(this);}
 @Override public void onStart(@NonNull LifecycleOwner o){active=true;try{JSONObject opts=new JSONObject().put("id",place.id);WikiApi.INSTANCE.request(id,new CredentialRepository(getCarContext()),"place.getbyid",opts,(data,error)->main.post(()->{if(!active)return;if(error==null)try{JSONObject item=data.optJSONObject("place");Place loaded=Place.from(item!=null?item:data);place=new Place(loaded.id,loaded.title,loaded.description,loaded.coords.length>=3?loaded.coords:place.coords);message=place.description.isEmpty()?"Описание отсутствует":place.description.replaceAll("<[^>]*>"," ").replaceAll("\\s+"," ").trim();if(message.length()>160)message=message.substring(0,157)+"…";}catch(Exception e){message="Неполные сведения";}else message=error;invalidate();}));}catch(Exception ignored){}}
 @Override public void onStop(@NonNull LifecycleOwner o){active=false;WikiApi.INSTANCE.cancel(id);}
 @NonNull @Override public Template onGetTemplate(){ItemList.Builder list=new ItemList.Builder().addItem(new Row.Builder().setTitle(place.title).addText(message).build()).addItem(new Row.Builder().setTitle("Добавить / убрать избранное").setOnClickListener(()->io.execute(()->{try{session.store.toggle(place);main.post(()->{message="Избранное обновлено";invalidate();});}catch(Exception e){main.post(()->{message="Избранное не сохранено";invalidate();});}})).build());if(place.point()!=null)list.addItem(new Row.Builder().setTitle("Маршрут").setOnClickListener(()->{double[] q=place.point();try{getCarContext().startCarApp(new Intent(CarContext.ACTION_NAVIGATE,Uri.parse("geo:"+q[0]+","+q[1])));}catch(RuntimeException e){message="Нет совместимого навигатора";invalidate();}}).build());list.addItem(new Row.Builder().setTitle("Открыть на телефоне (на стоянке)").setOnClickListener(ParkedOnlyOnClickListener.create(()->{try{session.store.pending(place.id);Intent intent=new Intent(getCarContext(),MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP);getCarContext().startActivity(intent);message="Откройте Auto Dev на телефоне";}catch(Exception e){message="Откройте Auto Dev на телефоне";}invalidate();})).build());return new ListTemplate.Builder().setTitle("Wikimapia #"+place.id).setHeaderAction(Action.BACK).setSingleList(list.build()).build();}}
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
