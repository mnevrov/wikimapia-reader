#!/usr/bin/env bash
set -euo pipefail
: "${GH_TOKEN:?}"
: "${GH_REPO:?}"
tag=${1:?tag required}
[[ "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || exit 1
version=${tag#v}
apk="WikiReader-Next-$version.apk"
cd release-dist
sha256sum --check SHA256SUMS.txt
# Existing published releases are immutable here: verify them, never overwrite.
if gh release view "$tag" --json isDraft > existing.json 2>/dev/null; then
  draft=$(python3 -c 'import json;print(str(json.load(open("existing.json"))["isDraft"]).lower())')
else
  gh release create "$tag" --verify-tag --draft --title "WikiReader Next $version" --notes-file RELEASE_NOTES.md
  draft=true
fi
if [[ "$draft" == true ]]; then
  gh release upload "$tag" "$apk" SHA256SUMS.txt --clobber
fi
mkdir -p verify-download
gh release download "$tag" --pattern "$apk" --pattern SHA256SUMS.txt --dir verify-download
cmp SHA256SUMS.txt verify-download/SHA256SUMS.txt
(cd verify-download && sha256sum --check SHA256SUMS.txt)
if [[ "$draft" == true ]]; then gh release edit "$tag" --draft=false --latest; fi
gh release view "$tag" --json url,assets --jq '{url:.url,assets:[.assets[]|{name,url}]}'
