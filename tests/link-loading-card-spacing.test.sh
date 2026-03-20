#!/usr/bin/env bash
set -euo pipefail

if ! awk '
  /\.card\.loading \.card-body \{/ { in_block=1 }
  in_block && /padding-bottom: 0\.75rem;/ { has_bottom_padding=1 }
  in_block && /^\}/ {
    exit(has_bottom_padding ? 0 : 1)
  }
  END { if (!has_bottom_padding) exit 1 }
' styles.css; then
  echo "FAIL: loading link card body should add bottom padding so the URL skeleton does not hug the card edge"
  exit 1
fi

echo "PASS: loading link card body reserves bottom spacing"
