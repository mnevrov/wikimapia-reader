"""Offline checks of release state transitions; gh is deliberately mocked."""
import hashlib
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/publish-release.sh'
MOCK = '''#!/usr/bin/env python3
import os,sys,json,shutil
from pathlib import Path
args=sys.argv[1:]
with open(os.environ['CALLS'],'a') as f:f.write(' '.join(args)+'\\n')
if args[:2]==['release','view']:
 if os.environ['SCENARIO'].startswith('new') and 'isDraft' in args:sys.exit(1)
 print(json.dumps({'isDraft':False,'url':'mock'}))
elif args[:2]==['release','download']:
 dest=Path(args[args.index('--dir')+1]);dest.mkdir(exist_ok=True)
 for name in ['WikiReader-Next-0.7.3.apk','SHA256SUMS.txt']:shutil.copyfile(name,dest/name)
 if os.environ['SCENARIO'].endswith('corrupt'):(dest/'WikiReader-Next-0.7.3.apk').write_bytes(b'corrupt')
'''

class ReleasePublishTests(unittest.TestCase):
    def run_scenario(self, scenario):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d); out=root/'release-dist';out.mkdir()
            apk=out/'WikiReader-Next-0.7.3.apk';apk.write_bytes(b'synthetic test artifact')
            (out/'SHA256SUMS.txt').write_text(hashlib.sha256(apk.read_bytes()).hexdigest()+'  '+apk.name+'\n')
            (out/'RELEASE_NOTES.md').write_text('Synthetic test release')
            bin_dir=root/'bin';bin_dir.mkdir();gh=bin_dir/'gh';gh.write_text(MOCK);gh.chmod(0o700)
            calls=root/'calls'
            env={**os.environ,'PATH':str(bin_dir)+os.pathsep+os.environ['PATH'],'GH_TOKEN':'mock','GH_REPO':'mock/repo','RELEASE_TARGET_SHA':'0'*40,'SCENARIO':scenario,'CALLS':str(calls)}
            result=subprocess.run(['bash',str(SCRIPT),'v0.7.3'],cwd=root,env=env,capture_output=True,text=True)
            return result.returncode,calls.read_text()

    def test_new_release_publishes_after_download(self):
        code,calls=self.run_scenario('new')
        self.assertEqual(code,0)
        self.assertLess(calls.index('release download'),calls.index('release edit'))
        self.assertIn('--draft',calls)

    def test_existing_release_is_verified_without_overwrite(self):
        code,calls=self.run_scenario('existing')
        self.assertEqual(code,0)
        self.assertIn('release download',calls)
        self.assertNotIn('release upload',calls)
        self.assertNotIn('release edit',calls)

    def test_corrupt_download_prevents_publication(self):
        code,calls=self.run_scenario('new-corrupt')
        self.assertNotEqual(code,0)
        self.assertNotIn('release edit',calls)
