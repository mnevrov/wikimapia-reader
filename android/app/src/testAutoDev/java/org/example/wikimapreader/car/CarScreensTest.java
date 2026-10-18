package org.example.wikimapreader.car;
import android.content.Intent;import androidx.car.app.*;import androidx.car.app.model.*;import androidx.car.app.navigation.model.*;
import androidx.car.app.testing.*;import androidx.lifecycle.Lifecycle;
import org.robolectric.RuntimeEnvironment;import org.junit.*;import org.junit.runner.RunWith;import org.robolectric.RobolectricTestRunner;import org.robolectric.annotation.Config;import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class CarScreensTest {
 private SessionController controller;private TestCarContext context;private WikiSession session;
 private WikiScreen create(int api){context=TestCarContext.createCarContext(RuntimeEnvironment.getApplication());context.updateHandshakeInfo(new HandshakeInfo("test.host",api));session=new WikiSession();controller=new SessionController(session,context,new Intent());controller.moveToState(Lifecycle.State.CREATED);return session.root;}
 @After public void stop(){if(controller!=null)controller.moveToState(Lifecycle.State.DESTROYED);}
 @Test public void modernTemplate(){assertTrue(create(7).onGetTemplate() instanceof MapWithContentTemplate);}
 @Test public void oldHostFallback(){assertTrue(create(1).onGetTemplate() instanceof PlaceListMapTemplate);}
 @Test public void recreateRetainsViewport()throws Exception{WikiScreen root=create(7);session.view.lat=59;session.view.lon=30;session.store.viewport(session.view,42);controller.moveToState(Lifecycle.State.DESTROYED);controller=null;assertTrue(create(7).onGetTemplate() instanceof MapWithContentTemplate);assertEquals(59,session.view.lat,0);assertEquals(42,session.store.selected());}
 @Test public void serviceCreatesSession(){assertTrue(new WikiCarService().onCreateSession() instanceof WikiSession);}
 @Test public void nonEmptyFallbackBuilds()throws Exception{WikiScreen root=create(1);java.lang.reflect.Field field=WikiScreen.class.getDeclaredField("places");field.setAccessible(true);field.set(root,java.util.Arrays.asList(new Place(42,"Place","",new double[][]{{55,37},{55.01,37},{55,37.01}})));assertTrue(root.onGetTemplate() instanceof PlaceListMapTemplate);}
 @Test public void searchLoadingBuilds()throws Exception{WikiScreen root=create(7);Class<?> type=Class.forName("org.example.wikimapreader.car.WikiScreen$Search");java.lang.reflect.Constructor<?> constructor=type.getDeclaredConstructors()[0];constructor.setAccessible(true);Screen screen=(Screen)constructor.newInstance(root,context);java.lang.reflect.Field busy=type.getDeclaredField("busy");busy.setAccessible(true);busy.setBoolean(screen,true);assertTrue(screen.onGetTemplate() instanceof SearchTemplate);}
}
