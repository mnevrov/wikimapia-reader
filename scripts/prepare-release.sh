#!/usr/bin/env bash
set -euo pipefail
# Run only after tests/build/lint. Never print secret values.
tag=${1:?release tag required}
version=$(node -p 'require("./package.json").version')
[[ "$tag" == "v$version" ]] || { echo 'Tag does not match package version'; exit 1; }
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'Stable semantic version required'; exit 1; }
python3 - "$version" <<'PY'
import json,re,sys,pathlib
v=sys.argv[1]
s=pathlib.Path('android/app/build.gradle').read_text()
assert re.search(r'versionName\s+"'+re.escape(v)+'"',s), 'Android version mismatch'
lock=json.loads(pathlib.Path('package-lock.json').read_text())
assert lock['version']==v and lock['packages']['']['version']==v
assert pathlib.Path(f'docs/releases/{v}/RELEASE_NOTES.md').is_file(), 'Release notes required'
PY
: "${NEXT_KEYSTORE_BASE64:?Set NEXT_KEYSTORE_BASE64 in Actions secrets}"
: "${NEXT_STORE_PASSWORD:?Set NEXT_STORE_PASSWORD in Actions secrets}"
: "${NEXT_KEY_PASSWORD:?Set NEXT_KEY_PASSWORD in Actions secrets}"
build_tools=${ANDROID_BUILD_TOOLS:-${ANDROID_HOME:?}/build-tools/35.0.0}
private_dir=$(mktemp -d)
trap 'rm -rf "$private_dir"' EXIT
chmod 700 "$private_dir"
printf '%s' "$NEXT_KEYSTORE_BASE64" | base64 --decode > "$private_dir/signing.jks"
chmod 600 "$private_dir/signing.jks"
mkdir -p release-dist
apk="WikiReader-Next-$version.apk"
"$build_tools/zipalign" -f -P 16 4 android/app/build/outputs/apk/mobile/debug/app-mobile-debug.apk "$private_dir/aligned.apk"
java -jar "$build_tools/lib/apksigner.jar" sign --ks "$private_dir/signing.jks" --ks-key-alias wikireader-next --ks-pass env:NEXT_STORE_PASSWORD --key-pass env:NEXT_KEY_PASSWORD --out "release-dist/$apk" "$private_dir/aligned.apk"
java -jar "$build_tools/lib/apksigner.jar" verify --verbose --print-certs "release-dist/$apk" > "$private_dir/verify.txt"
python3 - "$private_dir/verify.txt" <<'PYCERT'
import pathlib,sys,re
text=pathlib.Path(sys.argv[1]).read_text()
certs=re.findall(r'certificate SHA-256 digest: ([a-f0-9]+)',text)
assert certs==['f2e7ecb97e30017f5fb43f59650c1a14b001a328b440d435f81751dd97900bba'], 'Unexpected signer; refusing incompatible update'
PYCERT
"$build_tools/aapt" dump badging "release-dist/$apk" > "$private_dir/badging.txt"
python3 - "$private_dir/badging.txt" "$version" "release-dist/$apk" <<'PY'
import pathlib,sys,re,zipfile
s=pathlib.Path(sys.argv[1]).read_text();v=sys.argv[2]
assert "name='org.example.wikimapreader.next'" in s
assert f"versionName='{v}'" in s
gradle=pathlib.Path('android/app/build.gradle').read_text()
code=re.search(r'versionCode\s+(\d+)',gradle)[1]
assert f"versionCode='{code}'" in s
with zipfile.ZipFile(sys.argv[3]) as signed, zipfile.ZipFile('android/app/build/outputs/apk/mobile/debug/app-mobile-debug.apk') as raw:
    assert not any(n.endswith('.jks') for n in signed.namelist())
    for n in raw.namelist():
        if n.startswith('assets/'):
            assert signed.read(n)==raw.read(n), n
PY
(cd release-dist && sha256sum "$apk" > SHA256SUMS.txt)
python3 - "$version" "release-dist/$apk" <<'PYNOTES'
import pathlib,sys,hashlib
v=sys.argv[1];apk=pathlib.Path(sys.argv[2])
text=pathlib.Path(f'docs/releases/{v}/RELEASE_NOTES.md').read_text()
text='\n'.join(line for line in text.splitlines() if not line.startswith('SHA256:'))
pathlib.Path('release-dist/RELEASE_NOTES.md').write_text(text.rstrip()+'\n\nSHA256: '+hashlib.sha256(apk.read_bytes()).hexdigest()+'\n')
PYNOTES
printf 'Verified signed APK: %s\n' "$apk"

