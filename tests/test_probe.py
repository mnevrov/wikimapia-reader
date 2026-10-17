import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('probe',Path(__file__).resolve().parents[1]/'scripts/probe.py')
probe=importlib.util.module_from_spec(spec);spec.loader.exec_module(probe)
class ReadinessTests(unittest.TestCase):
 def test_malformed_never_ready_or_crash(self):
  for payload in [None,[],{}, {'place':None},{'id':55,'title':'a','description':'d','polygon':None},{'id':55,'title':'a','description':'d','polygon':[None]*3}]:
   self.assertFalse(probe.inspect(payload,'detail')['verified'])
  self.assertFalse(probe.inspect({'places':[{'polygon':[None]*3}]},'area')['verified'])
 def test_finite_coordinates_required(self):
  for point in [{'x':None,'y':None},{'x':200,'y':0},{'x':0,'y':float('nan')},{'x':'','y':''}]:
   self.assertFalse(probe.inspect({'places':[{'polygon':[point]*3}]},'area')['verified'])
 def test_actual_fixture_ready_for_detail(self):
  import json
  d=json.loads((Path(__file__).parent/'fixtures/place-55.projection.json').read_text())
  self.assertTrue(probe.inspect(d,'detail')['verified'])
if __name__=='__main__':unittest.main()
