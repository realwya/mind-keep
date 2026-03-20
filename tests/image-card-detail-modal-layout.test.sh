#!/usr/bin/env bash
set -euo pipefail

if ! rg -q 'class="link-edit-layout"' index.html; then
  echo "FAIL: link edit modal should define a shared layout wrapper"
  exit 1
fi

if ! rg -q 'class="link-edit-media-pane"' index.html; then
  echo "FAIL: link edit modal should define a media pane"
  exit 1
fi

if ! rg -q 'class="link-edit-sidebar-pane"' index.html; then
  echo "FAIL: link edit modal should define a sidebar pane"
  exit 1
fi

if rg -q 'link-edit-sidebar-pane-secondary' index.html; then
  echo "FAIL: link edit modal should not split the sidebar into a secondary pane"
  exit 1
fi

if ! rg -q "const isImageItem = data.type === 'images';" editor.js; then
  echo "FAIL: image items should be detected when opening the link edit modal"
  exit 1
fi

if ! rg -q "linkEditModal.modal.classList.toggle\\('image-detail-layout', isImageItem\\);" editor.js; then
  echo "FAIL: image detail layout state should toggle on the link edit modal"
  exit 1
fi

if ! rg -q "linkEditModal.coverImageGroup.classList.toggle\\('hidden', isImageItem\\);" editor.js; then
  echo "FAIL: cover image field should be hidden only for image items"
  exit 1
fi

if ! rg -q "const previewUrl = isImageItem \\? rawUrl \\|\\| storedImageUrl : storedImageUrl;" editor.js; then
  echo "FAIL: image modal preview should prefer the image URL"
  exit 1
fi

if ! rg -q "const imageValue = isImageItem \\? rawUrl \\|\\| storedImageUrl : storedImageUrl;" editor.js; then
  echo "FAIL: image modal save logic should keep the image field synced from the image URL"
  exit 1
fi

if ! rg -Fq '.image-detail-layout .link-edit-layout {' styles.css; then
  echo "FAIL: image modal should define a split layout style"
  exit 1
fi

if ! rg -Fq '.image-detail-layout .link-edit-sidebar-pane {' styles.css; then
  echo "FAIL: image modal should define a scrollable sidebar pane"
  exit 1
fi

if ! rg -Fq 'grid-template-rows: auto auto auto auto minmax(0, 1fr);' styles.css; then
  echo "FAIL: image modal sidebar should reserve a trailing flexible row for full-height media"
  exit 1
fi

if rg -Fq '.image-detail-layout .link-edit-sidebar-pane-secondary' styles.css; then
  echo "FAIL: image modal should not define a secondary sidebar pane layout"
  exit 1
fi

if ! rg -Fq '  .image-detail-layout .link-edit-layout {' styles.css; then
  echo "FAIL: image modal should define a mobile stacked fallback"
  exit 1
fi

if ! rg -q '<label for="linkEditDescription">Description</label>' index.html; then
  echo "FAIL: image modal should keep the description field available"
  exit 1
fi

echo "PASS: image card detail modal layout wiring is present"
