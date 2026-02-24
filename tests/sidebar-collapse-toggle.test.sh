#!/usr/bin/env bash
set -euo pipefail

if ! rg -q "elements\\.closeSidebarBtn\\.addEventListener\\('click', toggleSidebarCollapse\\)" app.js; then
  echo "FAIL: close sidebar action should trigger toggleSidebarCollapse"
  exit 1
fi

if ! rg -q "function toggleSidebarCollapse\\(\\)" sidebar.js; then
  echo "FAIL: sidebar toggle handler should exist"
  exit 1
fi

if ! rg -q "classList\\.toggle\\('collapsed'\\)" sidebar.js; then
  echo "FAIL: desktop sidebar toggle should flip collapsed class"
  exit 1
fi

if ! rg -q "\\.sidebar\\.collapsed" styles.css; then
  echo "FAIL: styles should define collapsed sidebar state"
  exit 1
fi

echo "PASS: sidebar action toggles desktop collapse/expand"
