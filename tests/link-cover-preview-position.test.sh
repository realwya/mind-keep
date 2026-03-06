#!/usr/bin/env bash
set -euo pipefail

cover_group_line="$(rg -n '<label for="linkEditImage">Cover image</label>' index.html | cut -d: -f1)"
preview_line="$(rg -n '<div class="link-cover-preview hidden" id="linkCoverPreview">' index.html | cut -d: -f1)"
tags_group_line="$(rg -n '<label for="linkEditTags">Tags</label>' index.html | cut -d: -f1)"

if [[ -z "${cover_group_line}" || -z "${preview_line}" || -z "${tags_group_line}" ]]; then
  echo "FAIL: expected link edit modal fields are missing"
  exit 1
fi

if ! (( cover_group_line < preview_line && preview_line < tags_group_line )); then
  echo "FAIL: link cover preview should appear below Cover image and above Tags"
  exit 1
fi

echo "PASS: link cover preview is positioned below Cover image"
