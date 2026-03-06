# Edit Modal Tags Unification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the note and link edit modal tag fields share the same labeled structure and spacing/divider styling.

**Architecture:** Keep `TagsInput` as the shared renderer and move edit-modal-specific spacing/divider rules into a shared wrapper class. Update the note modal HTML to use the same field pattern as the link modal, and give each generated input a stable ID so labels target the actual input.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, shell tests with `rg`

---

### Task 1: Lock the shared structure with a failing test

**Files:**
- Create: `tests/edit-modal-tags-layout.test.sh`
- Modify: `index.html`
- Modify: `styles.css`

**Step 1: Write the failing test**

- Assert the note edit modal contains a labeled tags field wrapper.
- Assert the link edit modal tags field uses the same wrapper class.
- Assert shared edit-modal tag field CSS exists.

**Step 2: Run test to verify it fails**

Run: `bash tests/edit-modal-tags-layout.test.sh`
Expected: FAIL because the note modal still uses a bare `#editTagsContainer`.

**Step 3: Write minimal implementation**

- Wrap the note tags container in the shared field wrapper with a visible `Tags` label.
- Add the shared wrapper class to the link modal tags field.
- Scope spacing/divider styles to the shared wrapper.

**Step 4: Run test to verify it passes**

Run: `bash tests/edit-modal-tags-layout.test.sh`
Expected: PASS

### Task 2: Keep label focus behavior correct

**Files:**
- Modify: `tags-input.js`
- Modify: `app.js`

**Step 1: Write the failing test**

- Reuse the same structure test expectations for real `for` targets by requiring stable input IDs in markup/config-driven output.

**Step 2: Run test to verify it fails**

Run: `bash tests/edit-modal-tags-layout.test.sh`
Expected: FAIL because generated tag inputs do not receive IDs yet.

**Step 3: Write minimal implementation**

- Allow `TagsInput` to accept an `inputId` option.
- Pass `editTagsInput` and `linkEditTags` IDs from modal initialization.

**Step 4: Run test to verify it passes**

Run: `bash tests/edit-modal-tags-layout.test.sh`
Expected: PASS

### Task 3: Verify no modal regression

**Files:**
- Test: `tests/edit-modal-tags-layout.test.sh`
- Test: `tests/link-cover-preview-position.test.sh`

**Step 1: Run focused verification**

Run: `bash tests/edit-modal-tags-layout.test.sh`
Expected: PASS

**Step 2: Run adjacent regression check**

Run: `bash tests/link-cover-preview-position.test.sh`
Expected: PASS
