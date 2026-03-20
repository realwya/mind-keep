#!/usr/bin/env bash
set -euo pipefail

if ! rg -q "e\\.key === '/'" app.js; then
  echo "FAIL: search shortcut should still listen for /"
  exit 1
fi

if ! rg -Uq "elements\\.sidebar\\.classList\\.contains\\('collapsed'\\)[^}]*classList\\.remove\\('collapsed'\\)" app.js; then
  echo "FAIL: search shortcut should expand a collapsed sidebar before focusing search"
  exit 1
fi

if ! rg -q "syncSidebarActionButton\\(\\)" app.js; then
  echo "FAIL: search shortcut should resync the sidebar action button after expanding"
  exit 1
fi

if ! rg -q "elements\\.searchInput\\.focus\\(\\)" app.js; then
  echo "FAIL: search shortcut should still focus the search input"
  exit 1
fi

echo "PASS: search shortcut expands collapsed sidebar before focusing search"
