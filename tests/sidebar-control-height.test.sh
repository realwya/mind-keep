#!/usr/bin/env bash
set -euo pipefail

if ! rg -q -- '--sidebar-row-height:' styles.css; then
  echo "FAIL: sidebar shared row height variable should exist"
  exit 1
fi

if ! rg -Uq '\.search-input\s*\{[^}]*height:\s*var\(--sidebar-row-height\)' styles.css; then
  echo "FAIL: search input should use shared sidebar row height"
  exit 1
fi

if ! rg -Uq '\.view-switch-btn\s*\{[^}]*height:\s*var\(--sidebar-row-height\)' styles.css; then
  echo "FAIL: view switch button should use shared sidebar row height"
  exit 1
fi

if ! rg -Uq '\.folder-button\s*\{[^}]*height:\s*var\(--sidebar-row-height\)' styles.css; then
  echo "FAIL: folder button should use shared sidebar row height"
  exit 1
fi

echo "PASS: sidebar full-row controls share consistent height"
