#!/usr/bin/env bash
set -euo pipefail

if ! rg -q "lucide" index.html; then
  echo "FAIL: lucide library is not included in index.html"
  exit 1
fi

if ! rg -q "data-lucide=\"" index.html; then
  echo "FAIL: no data-lucide icons found in index.html"
  exit 1
fi

if rg -q "<svg" index.html; then
  echo "FAIL: inline SVG icons still exist in index.html"
  exit 1
fi

if rg -q "<svg" app.js; then
  echo "FAIL: inline SVG icons still exist in app.js"
  exit 1
fi

echo "PASS: Lucide icon migration checks"
