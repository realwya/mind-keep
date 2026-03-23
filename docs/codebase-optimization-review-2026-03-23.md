# Keep Notes Codebase Optimization Review

Date: 2026-03-23

## Scope

Repository-wide static review focused on:

- Data safety and consistency
- Load/search/render performance
- Maintainability
- Test quality

## High Priority

### P1. File move/restore/rename flows can overwrite existing notes

#### Problem

Several filesystem fallback paths write directly into the destination filename without checking for collisions first:

- `deleteFile()` writes into `.trash/`
- `archiveFile()` writes into `Archive/`
- `restoreFile()` writes back into the active directory
- `restoreArchiveFile()` writes back into the active directory
- `renameFile()` writes the new filename directly

In browsers where the File System Access `move()` API is unavailable, the current fallback path uses:

```js
const newFileHandle = await targetHandle.getFileHandle(filename, { create: true });
const writable = await newFileHandle.createWritable();
await writable.write(content);
```

If a file with the same name already exists in the destination, the fallback path will overwrite it.

#### Impact

- Possible silent data loss
- Restore/archive operations are unsafe when the user has created a new note with the same filename
- Rename flow can destroy an existing target note when collisions slip through current checks

#### Recommended optimization

Introduce a single shared move helper, for example `moveFileSafely(sourceDir, targetDir, filename, options)`, that:

1. Checks whether the destination filename already exists
2. Applies a consistent conflict strategy
3. Uses `move()` when available, but keeps the same collision behavior in fallback mode

Recommended conflict strategies:

- Default: append a suffix such as `-1`, `-2`, `-3`
- Optional future UX: show a resolve-conflict prompt before restore

Useful helper candidates:

- `resolveUniqueFilename(dirHandle, filename)`
- `copyThenDeleteSafely(sourceHandle, targetHandle, filename)`

## High Priority

### P1. Folder switching and note saving are not atomic

#### Problem A: Folder handle is persisted before setup succeeds

Both `handleOpenFolder()` and `handleChangeFolder()` write the selected directory handle into IndexedDB before `finishSetupFolder()` completes.

If setup fails after persistence, the UI may roll back while the stored handle already points at the new directory.

#### Problem B: Note rename happens before content save

In `saveEditedNote()`, a renamed note is processed in this order:

1. `renameFile(oldFilename, newFilename, currentView)`
2. `saveFile(newFilename, finalContent, currentView)`

If the rename succeeds but the content save fails, the filesystem has already changed while in-memory state and UI still treat the operation as failed.

#### Impact

- Persisted folder state can become inconsistent with visible UI state
- Failed note saves can leave partially applied edits on disk
- Error recovery becomes difficult because rollback is implicit and incomplete

#### Recommended optimization

Use staged commit behavior for both flows.

For folder switching:

1. Pick directory
2. Attempt `finishSetupFolder()` against the in-memory handle
3. Only persist to IndexedDB after setup succeeds

For note save:

1. Write new content first to a temporary or final target safely
2. Remove or rename the old file only after the write succeeds
3. Update in-memory state only after filesystem changes are complete

If temp files are undesirable in this repo, a practical alternative is:

- Save new content to `newFilename`
- Verify success
- Delete old file if rename was needed

This keeps the operation closer to atomic behavior than rename-first.

## Medium Priority

### P2. `loadItems()` performs writes during read-time loading

#### Problem

`loadItems()` normalizes item types and immediately writes normalized content back to disk during folder load:

```js
const normalized = normalizeItemTypeInContent(text);
if (normalized !== text) {
  const writable = await entry.createWritable();
  await writable.write(normalized);
  await writable.close();
}
```

This means opening a folder or switching views can trigger filesystem writes.

#### Impact

- Slower folder load time as note count grows
- Larger failure surface during startup and view switches
- Read flows become dependent on write permission and write success
- Unexpected side effects when simply opening old data

#### Recommended optimization

Move normalization out of the load path.

Safer options:

- Run migration explicitly once after folder selection
- Normalize lazily on save/edit only
- Keep normalization in memory during render and defer disk writes to a dedicated repair action

For this app, an explicit one-time migration pass is the cleanest option because the data model is file-backed and simple.

## Medium Priority

### P2. Search and filter hot paths still do repeated work

#### Problem

On every search keystroke:

- `handleSearchInput()` immediately calls `filterAndRenderItems()`
- `buildSearchText()` rebuilds a lowercased search corpus per item
- Card container is cleared and rebuilt
- `refreshLucideIcons()` reruns icon hydration after filtering

The current card cache reduces card recreation cost, but searchable text and filter-derived data are not cached.

#### Impact

- Search cost scales with item count
- Filtering work is repeated on every keystroke
- Icon hydration is broader than necessary

#### Recommended optimization

Apply a small pipeline cleanup:

1. Add a 120-200ms debounce for search input
2. Cache `item._searchText` alongside parsed front matter
3. Invalidate cached search text only when `item.content` changes
4. Limit icon refresh to containers that actually inserted new icon placeholders

This should produce noticeable gains without changing the app architecture.

## Medium Priority

### P2. Markdown round-trip trims user content

#### Problem

`parseFrontMatter()` trims the note body:

```js
const content = match[2].trim();
```

`saveEditedNote()` also trims editor content before saving:

```js
const newContent = getEditContent().trim();
```

This means leading/trailing blank lines are not preserved through open/edit/save cycles.

#### Impact

- User-authored spacing is lost
- Saving an unchanged note can still modify its content formatting
- Data round-trip is not faithful

#### Recommended optimization

Preserve raw content exactly unless the user explicitly edits it.

Recommended changes:

- Remove `.trim()` from `parseFrontMatter()` body extraction
- Use a validation check such as `if (!getEditContent().trim())` only for empty-content guarding
- Save the original text as entered, not the trimmed version

This keeps validation strict without mutating stored markdown format.

## Medium Priority

### P2. Test coverage is too text-oriented and currently brittle

#### Problem

Most repository tests are shell scripts that use `rg` or `awk` to assert source patterns. They are useful as guardrails for markup and wiring, but they do not exercise real browser behavior.

During this review, the local scripted run showed two current failures:

- `tests/logo-branding.test.sh`
- `tests/x-post-capsule-icon.test.sh`

Both failures are caused by exact string matching against multi-line HTML, not by confirmed runtime regressions.

#### Impact

- Tests can fail due to formatting-only changes
- Critical runtime flows are untested
- Filesystem edge cases are effectively unprotected

#### Recommended optimization

Keep the shell tests, but split testing into two layers:

1. Structure guards
   - Keep current `rg`-based checks for stable markup conventions
2. Behavior checks
   - Add a small browser-driven smoke suite for:
   - folder open/change rollback
   - restore/archive collision handling
   - note rename failure rollback
   - search and filter behavior

If adding a browser test harness feels heavy, even one manual regression checklist in `docs/` would be an improvement over the current gap.

## Suggested Implementation Order

1. Add safe filename conflict handling for move/archive/restore/rename
2. Make folder persistence and note save flows atomic
3. Remove writes from `loadItems()`
4. Preserve note content without trimming during edit round-trip
5. Debounce and cache search/filter paths
6. Strengthen tests for filesystem and browser behavior

## Notes

- Review method: static code scan plus repository shell tests
- Browser-based manual regression was not run during this review
- Existing shell tests remain useful, but they should not be treated as sufficient behavioral coverage
