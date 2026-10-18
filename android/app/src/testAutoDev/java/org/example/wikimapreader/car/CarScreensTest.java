package org.example.wikimapreader.car;
import android.content.Intent;import androidx.car.app.*;import androidx.car.app.model.*;import androidx.car.app.navigation.model.*;
import androidx.car.app.testing.*;import androidx.lifecycle.Lifecycle;
import androidx.test.core.app.ApplicationProvider;import org.junit.*;import org.junit.runner.RunWith;import org.robolectric.RobolectricTestRunner;import org.robolectric.annotation.Config;import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class CarScreensTest {
 private SessionController controller;private TestCarContext context;private WikiSession session;
 private WikiScreen create(int api){context=TestCarContext.createCarContext(ApplicationProvider.getApplicationContext());context.updateHandshakeInfo(new HandshakeInfo("test.host",api));session=new WikiSession();controller=new SessionController(session,context,new Intent());controller.moveToState(Lifecycle.State.CREATED);return session.root;}
 @After public void stop(){if(controller!=null)controller.moveToState(Lifecycle.State.DESTROYED);}
 @Test public void modernTemplate(){assertTrue(create(7).onGetTemplate() instanceof MapWithContentTemplate);}
 @Test public void oldHostFallback(){assertTrue(create(1).onGetTemplate() instanceof PlaceListMapTemplate);}
 @Test public void recreateRetainsViewport()throws Exception{WikiScreen root=create(7);session.view.lat=59;session.view.lon=30;session.store.viewport(session.view,42);controller.moveToState(Lifecycle.State.DESTROYED);controller=null;assertTrue(create(7).onGetTemplate() instanceof MapWithContentTemplate);assertEquals(59,session.view.lat,0);assertEquals(42,session.store.selected());}
 @Test public void serviceCreatesSession(){assertTrue(new WikiCarService().onCreateSession() instanceof WikiSession);}
}
