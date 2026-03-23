#!/usr/bin/env bash
set -euo pipefail

if ! rg -q 'async function fileExistsInDirectory\(dirHandle, filename\)' fs.js; then
  echo "FAIL: fs should expose a fileExistsInDirectory helper"
  exit 1
fi

if ! rg -q 'async function ensureNoFileConflict\(' fs.js; then
  echo "FAIL: fs should expose a unified ensureNoFileConflict helper"
  exit 1
fi

if ! rg -Fq 'throw new Error(`A file named "${filename}" already exists in ${locationLabel}.`);' fs.js; then
  echo "FAIL: conflict helper should throw a user-facing collision error"
  exit 1
fi

if ! rg -q 'await ensureNoFileConflict\(trashHandle, filename, null, '\''Trash'\''\);' fs.js; then
  echo "FAIL: deleteFile should block collisions in Trash"
  exit 1
fi

if ! rg -q 'await ensureNoFileConflict\(archiveHandle, filename, null, ARCHIVE_DIR_NAME\);' fs.js; then
  echo "FAIL: archiveFile should block collisions in Archive"
  exit 1
fi

if ! rg -q 'await ensureNoFileConflict\(dirHandle, filename, null, '\''Notes'\''\);' fs.js; then
  echo "FAIL: restore flows should block collisions in the active notes directory"
  exit 1
fi

if ! rg -q 'await ensureNoFileConflict\(targetHandle, newFilename, oldFilename, '\''the current folder'\''\);' fs.js; then
  echo "FAIL: renameFile should block collisions except for the original file"
  exit 1
fi

echo "PASS: file conflict protection checks"
