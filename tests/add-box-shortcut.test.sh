#!/usr/bin/env bash
set -euo pipefail

if ! rg -q 'id="addBoxCollapsed" class="add-box-collapsed"' index.html; then
  echo "FAIL: collapsed add box container should exist"
  exit 1
fi

if ! rg -q 'class="add-shortcut" aria-hidden="true">N<' index.html; then
  echo "FAIL: collapsed add box should render an N shortcut hint"
  exit 1
fi

if ! rg -q '\.search-shortcut,' styles.css; then
  echo "FAIL: search shortcut shared selector should remain in styles"
  exit 1
fi

if ! rg -q '^\.add-shortcut \{' styles.css; then
  echo "FAIL: add shortcut should extend the shared shortcut pill styles"
  exit 1
fi

if ! rg -q 'pointer-events: none;' styles.css; then
  echo "FAIL: add shortcut hint should share the search shortcut pill styles"
  exit 1
fi

if ! rg -q '^\.add-box-collapsed \{' styles.css; then
  echo "FAIL: collapsed add box styles should exist"
  exit 1
fi

if ! rg -q 'justify-content: space-between;' styles.css; then
  echo "FAIL: collapsed add box should keep space for the shortcut hint on the right"
  exit 1
fi

echo "PASS: collapsed add box exposes the N shortcut hint"
