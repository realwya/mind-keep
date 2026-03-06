#!/usr/bin/env bash
set -euo pipefail

note_group_line="$(rg -n '<div class="form-group edit-tags-group">' index.html | head -n1 | cut -d: -f1)"
note_label_line="$(rg -n '<label for="editTagsInput">Tags</label>' index.html | cut -d: -f1)"
note_container_line="$(rg -n '<div id="editTagsContainer" class="tags-input-container"></div>' index.html | cut -d: -f1)"

if [[ -z "${note_group_line}" || -z "${note_label_line}" || -z "${note_container_line}" ]]; then
  echo "FAIL: note edit modal tags field should use the shared labeled wrapper"
  exit 1
fi

if ! (( note_group_line < note_label_line && note_label_line < note_container_line )); then
  echo "FAIL: note edit modal tags field should keep label and container inside the shared wrapper"
  exit 1
fi

link_group_line="$(rg -n '<div class="form-group edit-tags-group">' index.html | tail -n1 | cut -d: -f1)"
link_label_line="$(rg -n '<label for="linkEditTags">Tags</label>' index.html | cut -d: -f1)"
link_container_line="$(rg -n '<div id="linkEditTagsContainer" class="tags-input-container"></div>' index.html | cut -d: -f1)"

if [[ -z "${link_group_line}" || -z "${link_label_line}" || -z "${link_container_line}" ]]; then
  echo "FAIL: link edit modal tags field should use the shared labeled wrapper"
  exit 1
fi

if ! (( link_group_line < link_label_line && link_label_line < link_container_line )); then
  echo "FAIL: link edit modal tags field should keep label and container inside the shared wrapper"
  exit 1
fi

if ! rg -q '\.edit-tags-group \.tags-input-container \{' styles.css; then
  echo "FAIL: shared edit modal tag field container styles are missing"
  exit 1
fi

if ! rg -q '#editModal \.edit-tags-group \{' styles.css; then
  echo "FAIL: note edit modal tags field should provide its own gutter alignment"
  exit 1
fi

if [[ "$(rg -c '<span class=\"edited-time\">Edited -</span>' index.html)" -lt 2 ]]; then
  echo "FAIL: both edit modals should render edited time text in the footer"
  exit 1
fi

if [[ "$(rg -c '<div class="edit-modal-footer">' index.html)" -lt 2 ]]; then
  echo "FAIL: both edit modals should render footer containers"
  exit 1
fi

if ! rg -q "editedTime: document\\.querySelector\\('#editModal \\.edited-time'\\)" config.js; then
  echo "FAIL: note edit modal should scope its edited time element"
  exit 1
fi

if ! rg -q "editedTime: document\\.querySelector\\('#linkEditModal \\.edited-time'\\)" config.js; then
  echo "FAIL: link edit modal should scope its edited time element"
  exit 1
fi

if ! rg -Fq 'updateEditedTime(item.createdAt, linkEditModal.editedTime);' editor.js; then
  echo "FAIL: link edit modal should populate edited time when opened"
  exit 1
fi

if ! rg -Fq 'updateEditedTime(savedAt, linkEditModal.editedTime);' editor.js; then
  echo "FAIL: link edit modal should refresh edited time after saving"
  exit 1
fi

if ! rg -q "inputId: 'editTagsInput'" app.js; then
  echo "FAIL: note edit tags input should provide a stable input id"
  exit 1
fi

if ! rg -q "inputId: 'linkEditTags'" app.js; then
  echo "FAIL: link edit tags input should provide a stable input id"
  exit 1
fi

if ! rg -q "this\\.input\\.id = this\\.options\\.inputId \\|\\| '';" tags-input.js; then
  echo "FAIL: TagsInput should apply configured input ids"
  exit 1
fi

echo "PASS: edit modal tag fields share the same structure"
