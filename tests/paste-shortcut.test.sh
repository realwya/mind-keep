#!/usr/bin/env bash
set -euo pipefail

if ! rg -q "document\\.addEventListener\\('paste'" app.js; then
  echo "FAIL: app should register a global paste handler"
  exit 1
fi

if ! rg -q "isTextEditingTarget\\(e\\.target\\)" app.js; then
  echo "FAIL: global paste should ignore editable targets"
  exit 1
fi

if ! rg -q "clipboardData\\?\\.getData\\('text/plain'\\)" app.js; then
  echo "FAIL: global paste should read plain text from clipboard"
  exit 1
fi

if ! rg -q "expandNoteForm\\(\\)" app.js; then
  echo "FAIL: global paste should expand note form when needed"
  exit 1
fi

if ! rg -q "elements\\.noteContentInput" app.js; then
  echo "FAIL: global paste should target the note input"
  exit 1
fi

echo "PASS: global paste routes plain text into main note input"
