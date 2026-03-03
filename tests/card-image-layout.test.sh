#!/usr/bin/env bash
set -euo pipefail

if ! awk '
  /\.card-image img \{/ { in_block=1 }
  in_block && /display: block;/ { found=1 }
  in_block && /^\}/ { exit(found ? 0 : 1) }
  END { if (!found) exit 1 }
' styles.css; then
  echo "FAIL: .card-image img should use display:block to avoid baseline gap"
  exit 1
fi

echo "PASS: .card-image img uses display:block"
