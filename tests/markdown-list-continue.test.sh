#!/usr/bin/env bash
set -euo pipefail

if ! rg -q 'import\(.*@codemirror/lang-markdown' editor.js; then
  echo "FAIL: editor should load @codemirror/lang-markdown"
  exit 1
fi

if ! rg -q 'markdownKeymap' editor.js; then
  echo "FAIL: editor should enable markdownKeymap for list continuation on Enter"
  exit 1
fi

if ! rg -q 'keymap\.of\(markdownKeymap\)' editor.js; then
  echo "FAIL: editor should register markdownKeymap via keymap.of(...)"
  exit 1
fi

echo "PASS: markdown list continuation keymap checks"
