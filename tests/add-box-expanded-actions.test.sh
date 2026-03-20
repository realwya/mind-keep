#!/usr/bin/env bash
set -euo pipefail

if rg -q 'id="closeNoteForm"' index.html; then
  echo "FAIL: expanded add box should not render a Close button"
  exit 1
fi

if ! rg -q 'id="saveNoteBtn"[^>]*>Save<' index.html; then
  echo "FAIL: expanded add box should keep the Save button"
  exit 1
fi

if ! rg -q "e\\.key === 'Escape'" app.js; then
  echo "FAIL: app should still handle Escape for collapse behavior"
  exit 1
fi

if ! rg -q "elements\\.noteForm\\.contains\\(document\\.activeElement\\)" app.js; then
  echo "FAIL: Escape collapse should still be scoped to the expanded note form focus state"
  exit 1
fi

if ! rg -q "collapseForm\\(\\);" app.js; then
  echo "FAIL: Escape branch should still collapse the note form"
  exit 1
fi

echo "PASS: expanded add box keeps Save and preserves Escape collapse behavior"
