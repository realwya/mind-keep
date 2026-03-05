#!/usr/bin/env bash
set -euo pipefail

if ! rg -q 'class="icon-button tag-manage-button"' index.html; then
  echo "FAIL: card templates should include tag manage action button"
  exit 1
fi

if ! rg -q 'data-lucide="tag"' index.html; then
  echo "FAIL: tag manage action should use lucide tag icon"
  exit 1
fi

if ! rg -F -q "const tagManageBtn = e.target.closest('.tag-manage-button')" app.js; then
  echo "FAIL: handleCardClick is missing tag manage button handling"
  exit 1
fi

if ! rg -F -q 'new TagsInput(' app.js; then
  echo "FAIL: tag popover should reuse TagsInput interactions"
  exit 1
fi

if ! rg -F -q 'await saveFile(filename, nextContent, currentView)' app.js; then
  echo "FAIL: tag updates should save immediately in current view"
  exit 1
fi

if ! rg -F -q '.tag-manage-button {' styles.css; then
  echo "FAIL: tag manage button should be hidden by default"
  exit 1
fi

if ! rg -F -q '.active-view .tag-manage-button,' styles.css; then
  echo "FAIL: active/archive views should show tag manage button"
  exit 1
fi

echo "PASS: card tag action checks"
