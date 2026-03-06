#!/usr/bin/env bash
set -euo pipefail

if ! awk '
  /\.link-cover-preview img \{/ { in_block=1 }
  in_block && /position: absolute;/ { has_absolute=1 }
  in_block && /inset: 0;/ { has_inset=1 }
  in_block && /width: 100%;/ { has_width=1 }
  in_block && /height: 100%;/ { has_height=1 }
  in_block && /object-fit: contain;/ { has_contain=1 }
  in_block && /^\}/ {
    exit(has_absolute && has_inset && has_width && has_height && has_contain ? 0 : 1)
  }
  END { if (!(has_absolute && has_inset && has_width && has_height && has_contain)) exit 1 }
' styles.css; then
  echo "FAIL: link cover preview image should use an absolute fill box so object-fit: contain actually constrains it"
  exit 1
fi

echo "PASS: link cover preview image uses an absolute contain box"
