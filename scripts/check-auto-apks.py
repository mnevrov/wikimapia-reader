"""Inspect packaged manifests, ensure car code stays isolated, package reviewable APKs."""
import hashlib, os, pathlib, re, shutil, subprocess
sdk=pathlib.Path(os.environ.get('ANDROID_HOME',os.environ.get('ANDROID_SDK_ROOT','/opt/android-sdk')))
aapt=sdk/'build-tools/35.0.0/aapt'
for variant,package,label in [('mobile','org.example.wikimapreader.next','WikiReader-mobile'),('autoDev','org.example.wikimapreader.autodev.next','WikiReader-AutoDev')]:
    apk=pathlib.Path(f'android/app/build/outputs/apk/{variant}/debug/app-{variant}-debug.apk')
    badging=subprocess.check_output([str(aapt),'dump','badging',str(apk)],text=True)
    assert f"package: name='{package}'" in badging,badging[:200]
    manifest=subprocess.check_output([str(aapt),'dump','xmltree',str(apk),'AndroidManifest.xml'],text=True)
    assert ('WikiCarService' in manifest)==(variant=='autoDev')
    assert ('androidx.car.app.MAP_TEMPLATES' in manifest)==(variant=='autoDev')
    assert 'androidx.car.app.NAVIGATION_TEMPLATES' not in manifest
    folder=pathlib.Path('apk-dist')/variant;folder.mkdir(parents=True,exist_ok=True)
    target=folder/f'{label}-0.7.3-debug.apk';shutil.copyfile(apk,target)
    digest=hashlib.sha256(target.read_bytes()).hexdigest()
    (folder/'SHA256SUMS.txt').write_text(f'{digest}  {target.name}\n')
    (folder/'BUILD.txt').write_text(f'package={package}\nversion=0.7.3\nvariant={variant}Debug\nTemporary debug signing; mobile is not a stable Next update.\n')
    print(variant,package,digest)
