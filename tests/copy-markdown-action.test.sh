#!/usr/bin/env bash
set -euo pipefail

if ! rg -q 'copy-markdown-button' index.html; then
  echo "FAIL: note card is missing copy markdown action button"
  exit 1
fi

if ! rg -q 'data-feather="copy"' index.html; then
  echo "FAIL: copy markdown action should use feather copy icon"
  exit 1
fi

if ! rg -q 'const copyMarkdownBtn = e\.target\.closest\('\''\.copy-markdown-button'\''\)' app.js; then
  echo "FAIL: handleCardClick is missing copy markdown button handling"
  exit 1
fi

if ! rg -q 'navigator\.clipboard\.writeText' app.js; then
  echo "FAIL: copy markdown action is missing clipboard write"
  exit 1
fi

if ! rg -q "showPopup\\('Markdown copied'\\)" app.js; then
  echo "FAIL: copy markdown action should show success popup feedback"
  exit 1
fi

echo "PASS: copy markdown action checks"
