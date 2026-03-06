#!/usr/bin/env bash
set -euo pipefail

if ! rg -q -- '--link-cover-preview-height: 180px;' styles.css; then
  echo "FAIL: link cover preview should define a stable desktop height token"
  exit 1
fi

if ! awk '
  /\.link-cover-preview \{/ { in_block=1 }
  in_block && /height: var\(--link-cover-preview-height\);/ { has_height=1 }
  in_block && /position: relative;/ { has_position=1 }
  in_block && /display: grid;/ { has_grid=1 }
  in_block && /^\}/ {
    exit(has_height && has_position && has_grid ? 0 : 1)
  }
  END { if (!(has_height && has_position && has_grid)) exit 1 }
' styles.css; then
  echo "FAIL: link cover preview should reserve a fixed-height grid stage"
  exit 1
fi

if ! rg -q '\.link-cover-preview\.is-loading::before' styles.css; then
  echo "FAIL: link cover preview should expose a loading skeleton state"
  exit 1
fi

if ! rg -q 'function setLinkCoverPreviewState\(state, message = '\'''\''\)' editor.js; then
  echo "FAIL: link cover preview should centralize loading/ready/error state changes"
  exit 1
fi

if ! rg -q "setLinkCoverPreviewState\\('loading', 'Loading preview\\.\\.\\.'\\)" editor.js; then
  echo "FAIL: link cover preview should enter a loading state before image load completes"
  exit 1
fi

echo "PASS: link cover preview reserves stable space across states"
