#!/usr/bin/env bash
set -euo pipefail
: "${GH_TOKEN:?}"
: "${GH_REPO:?}"
: "${RELEASE_TARGET_SHA:?}"
[[ "$RELEASE_TARGET_SHA" =~ ^[a-f0-9]{40}$ ]] || exit 1
tag=${1:?tag required}
[[ "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || exit 1
version=${tag#v}
apk="WikiReader-Next-$version.apk"
cd release-dist
sha256sum --check SHA256SUMS.txt
# Never attach a newly built APK to a tag that points at different source.
ref_error=$(mktemp)
trap 'rm -f "$ref_error"' EXIT
tag_exists=false
if object=$(gh api "repos/$GH_REPO/git/ref/tags/$tag" --jq '.object | [.type,.sha] | @tsv' 2>"$ref_error"); then
  tag_exists=true
  for depth in {1..8}; do
    IFS=$'\t' read -r kind object_sha <<< "$object"
    if [[ "$kind" == commit ]]; then break; fi
    [[ "$kind" == tag && "$object_sha" =~ ^[a-f0-9]{40}$ ]] || exit 1
    object=$(gh api "repos/$GH_REPO/git/tags/$object_sha" --jq '.object | [.type,.sha] | @tsv')
  done
  [[ "$kind" == commit && "$object_sha" == "$RELEASE_TARGET_SHA" ]] || { echo 'Existing tag points at a different commit'; exit 1; }
else
  grep -q 'HTTP 404' "$ref_error" || { echo 'Could not verify release tag'; exit 1; }
fi
# Existing published releases are immutable here: verify them, never overwrite.
if gh release view "$tag" --json isDraft,targetCommitish > existing.json 2>/dev/null; then
  draft=$(python3 -c 'import json;print(str(json.load(open("existing.json"))["isDraft"]).lower())')
  if [[ "$draft" == true && "$tag_exists" == false ]]; then
    target=$(python3 -c 'import json;print(json.load(open("existing.json"))["targetCommitish"])')
    [[ "$target" == "$RELEASE_TARGET_SHA" ]] || { echo 'Existing draft has different source'; exit 1; }
  fi
else
  gh release create "$tag" --target "$RELEASE_TARGET_SHA" --draft --title "WikiReader Next $version" --notes-file RELEASE_NOTES.md
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
