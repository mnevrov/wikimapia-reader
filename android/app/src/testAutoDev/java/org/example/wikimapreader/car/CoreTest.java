package org.example.wikimapreader.car;
import org.junit.Test;
import static org.junit.Assert.*;
public class CoreTest {
 @Test public void mercatorRoundTrip(){for(double lat:new double[]{-80,0,55.75,80})assertEquals(lat,Geo.lat(Geo.y(lat)),1e-8);}
 @Test public void wrapsAntimeridian(){assertEquals(-179,Geo.wrap(181),0);assertEquals(2,Geo.delta(-179,179),0);}
 @Test public void concaveRepresentativeInside(){double[][] p={{0,0},{0,4},{1,4},{1,1},{4,1},{4,0}};double[] r=Geo.representative(p);assertTrue(Geo.inside(p,r[0],r[1]));assertFalse(Geo.inside(p,2,2));}
 @Test public void viewportZoomAnchor(){Viewport v=new Viewport(55,37,16);double[] p=v.at(100,40,800,480);v.scale(2,100,40,800,480);double[] q=v.at(100,40,800,480);assertEquals(p[0],q[0],1e-8);assertEquals(p[1],q[1],1e-8);}
 @Test public void bboxBudget(){Viewport v=new Viewport(55,37,10);double[] b=v.box();assertTrue(b[2]-b[0]<=.035);assertTrue(b[3]-b[1]<=.035);}
 @Test public void throttleAndBackoff(){RequestGate g=new RequestGate();assertEquals(0,g.reserve(0));assertEquals(6000,g.reserve(0));assertEquals(12000,g.reserve(0));g.backoff(1000,60000);assertEquals(61000,g.reserve(2000));}
 @Test public void validatesBounds(){assertThrows(IllegalArgumentException.class,()->Geo.validateBox(new double[]{0,0,1,1}));assertThrows(IllegalArgumentException.class,()->Geo.validateBox(new double[]{Double.NaN,0,.01,.01}));}
 @Test public void wideSurfaceHasSeveralBoundedAreas(){Viewport v=new Viewport(55,37,16);java.util.List<double[]> boxes=v.boxes(2400,600);assertTrue(boxes.size()>1);for(double[] b:boxes)Geo.validateBox(b);assertTrue(boxes.size()<=9);}
 @Test public void cancelledWaitDoesNotConsumeNewSlot(){RequestGate gate=new RequestGate();gate.reserve(0);for(int i=0;i<100;i++)assertEquals(6000,gate.available(1000));assertEquals(6000,gate.reserve(6000));assertEquals(12000,gate.available(6001));}
 @Test public void viewportSplitsAtAntimeridian(){java.util.List<double[]> boxes=new Viewport(55,179.999,16).boxes(800,480);boolean west=false,east=false;for(double[] b:boxes){Geo.validateBox(b);if(b[0]==-180)west=true;if(b[2]==180)east=true;}assertTrue(west);assertTrue(east);}
}
