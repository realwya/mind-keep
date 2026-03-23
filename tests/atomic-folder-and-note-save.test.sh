#!/usr/bin/env bash
set -euo pipefail

open_setup_line="$(rg -n 'await finishSetupFolder\(\);' fs.js | head -n1 | cut -d: -f1)"
open_persist_line="$(rg -n "await db\\.set\\('dirHandle', handle\\);" fs.js | head -n1 | cut -d: -f1)"

if [[ -z "${open_setup_line}" || -z "${open_persist_line}" ]] || ! (( open_setup_line < open_persist_line )); then
  echo "FAIL: handleOpenFolder should persist dirHandle only after finishSetupFolder succeeds"
  exit 1
fi

change_setup_line="$(rg -n 'await finishSetupFolder\(\);' fs.js | sed -n '2p' | cut -d: -f1)"
change_persist_line="$(rg -n "await db\\.set\\('dirHandle', handle\\);" fs.js | sed -n '2p' | cut -d: -f1)"

if [[ -z "${change_setup_line}" || -z "${change_persist_line}" ]] || ! (( change_setup_line < change_persist_line )); then
  echo "FAIL: handleChangeFolder should persist dirHandle only after finishSetupFolder succeeds"
  exit 1
fi

if ! rg -q 'function captureFolderState\(' fs.js; then
  echo "FAIL: fs should capture folder state before attempting setup"
  exit 1
fi

if ! rg -q 'function restoreFolderState\(' fs.js; then
  echo "FAIL: fs should restore folder state after a failed setup"
  exit 1
fi

if ! rg -q 'async function replaceFileWithStagedWrite\(' fs.js; then
  echo "FAIL: fs should expose a staged note save helper for rename flows"
  exit 1
fi

if ! rg -q 'async function createUniqueTemporaryFilename\(' fs.js; then
  echo "FAIL: fs should generate collision-free temporary filenames"
  exit 1
fi

if ! rg -q 'await replaceFileWithStagedWrite\(oldFilename, newFilename, finalContent, currentView\);' editor.js; then
  echo "FAIL: renamed note saves should use staged write instead of rename-first"
  exit 1
fi

echo "PASS: atomic folder setup and staged note save checks"
