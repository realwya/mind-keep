#!/usr/bin/env bash
set -euo pipefail

notes_line="$(rg -n 'id=\"viewNotesBtn\"' index.html | head -n1 | cut -d: -f1)"
archive_line="$(rg -n 'id=\"viewArchiveBtn\"' index.html | head -n1 | cut -d: -f1)"
trash_line="$(rg -n 'id=\"viewTrashBtn\"' index.html | head -n1 | cut -d: -f1)"

if [[ -z "${notes_line}" || -z "${archive_line}" || -z "${trash_line}" ]] || ! (( notes_line < archive_line && archive_line < trash_line )); then
  echo "FAIL: sidebar view order should be Notes, Archive, Trash"
  exit 1
fi

if ! rg -q 'class="icon-button archive-button"' index.html; then
  echo "FAIL: card templates should include archive action button"
  exit 1
fi

if ! rg -q 'viewArchiveBtn\.addEventListener\(' app.js; then
  echo "FAIL: archive view button should be wired in app events"
  exit 1
fi

if ! rg -q "const archiveBtn = e\\.target\\.closest\\('\\.archive-button'\\)" app.js; then
  echo "FAIL: archive action click handler is missing"
  exit 1
fi

if ! rg -q 'await archiveFile\(' app.js; then
  echo "FAIL: archive action should move files to Archive folder"
  exit 1
fi

if ! rg -q 'if \(currentView === VIEW_TRASH\) \{' app.js; then
  echo "FAIL: only Trash view should block card click editing"
  exit 1
fi

if ! rg -q 'await renameFile\(oldFilename, newFilename, currentView\)' editor.js; then
  echo "FAIL: note rename in archive should stay in current view directory"
  exit 1
fi

if ! rg -q 'await saveFile\(newFilename, finalContent, currentView\)' editor.js; then
  echo "FAIL: note save in archive should stay in current view directory"
  exit 1
fi

if ! rg -q 'await saveFile\(currentEditingItem\.fileName, content, currentView\)' editor.js; then
  echo "FAIL: link save in archive should stay in current view directory"
  exit 1
fi

if ! rg -q 'const VIEW_ARCHIVE = '\''archive'\''' config.js; then
  echo "FAIL: archive view constant should be defined"
  exit 1
fi

if ! rg -q 'async function archiveFile\(filename\)' fs.js; then
  echo "FAIL: archive file operation should exist"
  exit 1
fi

if ! rg -q 'async function restoreArchiveFile\(filename\)' fs.js; then
  echo "FAIL: restore from Archive operation should exist"
  exit 1
fi

echo "PASS: archive view and action checks"
