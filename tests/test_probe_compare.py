import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import probe_compare

class CompareTest(unittest.TestCase):
 def test_safe_summary_does_not_copy_request_url_or_key(self):
  source={'status':200,'request_url':'https://api.wikimapia.org/?key=secret','body':'sensitive'}
  result=probe_compare.safe_summary('box',source,{'folder':[]})
  self.assertEqual(result['method'],'box')
  self.assertFalse(result['verified_geometry'])
  self.assertNotIn('secret',str(result))
  self.assertNotIn('request_url',result)
 def test_malformed_modern_response_is_not_verified(self):
  result=probe_compare.safe_summary('place.getbyarea',{'status':200},[])
  self.assertFalse(result['verified_geometry'])

if __name__=='__main__':
 unittest.main()
