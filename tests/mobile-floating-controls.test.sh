#!/usr/bin/env bash
set -euo pipefail

if ! rg -Uq '@media \(max-width: 1100px\) \{[\s\S]*?\.sidebar-toggle \{[\s\S]*?top:\s*calc\(env\(safe-area-inset-top, 0px\) \+ 1rem\);[\s\S]*?left:\s*calc\(env\(safe-area-inset-left, 0px\) \+ 1rem\);[\s\S]*?bottom:\s*auto;' styles.css; then
  echo "FAIL: mobile sidebar toggle should pin to the top-left safe area"
  exit 1
fi

if ! rg -Uq '@media \(max-width: 1100px\) \{[\s\S]*?\.add-section \{[\s\S]*?position:\s*fixed;[\s\S]*?left:\s*0;[\s\S]*?right:\s*0;[\s\S]*?bottom:\s*0;' styles.css; then
  echo "FAIL: mobile add section should be fixed to the bottom edge"
  exit 1
fi

if ! rg -Uq '@media \(max-width: 1100px\) \{[\s\S]*?(#mainContent|\.main-wrapper) \{[\s\S]*?padding-bottom:\s*calc\(' styles.css; then
  echo "FAIL: mobile content area should reserve space for the fixed add section"
  exit 1
fi

if ! rg -Uq '@media \(max-width: 600px\) \{[\s\S]*?\.sidebar-header \{[\s\S]*?justify-content:\s*space-between;[\s\S]*?flex-wrap:\s*nowrap;' styles.css; then
  echo "FAIL: compact mobile sidebar header should keep branding and actions on one row"
  exit 1
fi

if ! rg -Uq '@media \(max-width: 600px\) \{[\s\S]*?\.sidebar-branding \{[\s\S]*?width:\s*auto;[\s\S]*?margin-bottom:\s*0;' styles.css; then
  echo "FAIL: compact mobile branding should not force a full-width wrapped row"
  exit 1
fi

if ! awk '
  /@media \(max-width: 600px\)/ { in_media=1; next }
  in_media && /^}/ { in_media=0 }
  in_media && /^  \.card-actions \{/ { in_block=1; next }
  in_block && /visibility: visible;/ { visible=1 }
  in_block && /opacity: 1;/ { opaque=1 }
  in_block && /^  }/ { exit(visible && opaque ? 0 : 1) }
  END { if (!(visible && opaque)) exit 1 }
' styles.css; then
  echo "FAIL: mobile card actions should stay visible without hover"
  exit 1
fi

echo "PASS: mobile floating controls are pinned to the screen edges"
