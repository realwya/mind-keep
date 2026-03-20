#!/usr/bin/env bash
set -euo pipefail

if ! rg -q '\.sidebar\.collapsed \{' styles.css; then
  echo "FAIL: collapsed sidebar state should still be defined"
  exit 1
fi

if ! rg -Uq '\.sidebar\.collapsed \.sidebar-branding\s*\{[^}]*display:\s*flex' styles.css; then
  echo "FAIL: collapsed sidebar should keep branding visible"
  exit 1
fi

if ! rg -Uq '\.sidebar\.collapsed \.sidebar-footer\s*\{[^}]*display:\s*flex' styles.css; then
  echo "FAIL: collapsed sidebar should keep the footer visible"
  exit 1
fi

if ! rg -Uq '\.sidebar\.collapsed \.sidebar-footer\s*\{[^}]*margin-top:\s*auto' styles.css; then
  echo "FAIL: collapsed sidebar footer should stay pinned to the bottom"
  exit 1
fi

if ! rg -Uq '\.sidebar\.collapsed \.brand-title,\s*\.sidebar\.collapsed #folderName\s*\{[^}]*display:\s*none' styles.css; then
  echo "FAIL: collapsed sidebar should hide the brand title and folder name text"
  exit 1
fi

if ! rg -Uq '\.sidebar\.collapsed \.folder-button\s*\{[^}]*width:\s*var\(--sidebar-row-height\)' styles.css; then
  echo "FAIL: collapsed sidebar folder action should become an icon-only square button"
  exit 1
fi

echo "PASS: collapsed sidebar keeps logo and folder entry while hiding labels"
