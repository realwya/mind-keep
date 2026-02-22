#!/usr/bin/env bash
set -euo pipefail

if ! rg -q "feather-icons" index.html; then
  echo "FAIL: feather-icons library is not included in index.html"
  exit 1
fi

if ! rg -q "data-feather=\"" index.html; then
  echo "FAIL: no data-feather icons found in index.html"
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

echo "PASS: Feather icon migration checks"
