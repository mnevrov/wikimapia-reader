"""Verify the single Android APK contains both phone and car app; avoid publishing secrets."""
import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import zipfile

version = json.loads(pathlib.Path("package.json").read_text())["version"]
sdk = pathlib.Path(os.environ.get("ANDROID_HOME", os.environ.get("ANDROID_SDK_ROOT", "/opt/android-sdk")))
aapt = sdk / "build-tools/35.0.0/aapt"
apk = pathlib.Path("android/app/build/outputs/apk/debug/app-debug.apk")
badging = subprocess.check_output([str(aapt), "dump", "badging", str(apk)], text=True)
assert "package: name='org.example.wikimapreader.next'" in badging, badging[:200]
match = re.search(r"^package: name='[^']+' versionCode='(\d+)' versionName='([^']+)'", badging, re.M)
assert match is not None, "APK version is missing"
assert match.group(2) == version, f"Unexpected version: {match.group(2)}"

manifest = subprocess.check_output([str(aapt), "dump", "xmltree", str(apk), "AndroidManifest.xml"], text=True)
for required in (
    "WikiCarService",
    "CarLocationService",
    "androidx.car.app.ACCESS_SURFACE",
    "androidx.car.app.MAP_TEMPLATES",
    "com.google.android.gms.car.application",
    "MainActivity",
):
    assert required in manifest, f"Unified app missing: {required}"
assert "androidx.car.app.NAVIGATION_TEMPLATES" not in manifest

with zipfile.ZipFile(apk) as archive:
    dex = b"".join(
        archive.read(name)
        for name in archive.namelist()
        if re.fullmatch(r"classes[0-9]*\.dex", name)
    )
    assert b"Landroidx/car/app/CarAppService;" in dex, "No car service implementation in APK"
    assert b"assets/public-api-key.txt" not in archive.namelist()
    # The Yandex key is entered locally and never embedded in CI-built binaries.
    assert b"tiles.api-maps.yandex.ru/v1/tiles/?apikey=" not in dex

signing = subprocess.check_output(
    [str(sdk / "build-tools/35.0.0/apksigner"), "verify", "--print-certs", str(apk)], text=True
)
folder = pathlib.Path("apk-dist/unified")
folder.mkdir(parents=True, exist_ok=True)
target = folder / f"WikiReader-Next-{version}-unified-debug.apk"
shutil.copyfile(apk, target)
digest = hashlib.sha256(target.read_bytes()).hexdigest()
(folder / "SHA256SUMS.txt").write_text(f"{digest}  {target.name}\n")
(folder / "BUILD.txt").write_text(
    f"package=org.example.wikimapreader.next\nversion={version}\n"
    "variant=debug\nPhone and Android Auto are in one package.\n"
    "Temporary debug signing; do not use to update signed stable Next.\n" + signing
)
print("unified", version, digest)
