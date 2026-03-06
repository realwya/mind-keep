# Link Cover Preview Position Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move the link edit modal cover preview so it appears directly below the `Cover image` field.

**Architecture:** Keep the existing shared modal styling and link edit form logic unchanged. Only the link edit form DOM order changes, and a shell test guards that structure so future edits do not drift.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, shell tests with `rg`

---

### Task 1: Guard the desired field order

**Files:**
- Create: `tests/link-cover-preview-position.test.sh`
- Test: `tests/link-cover-preview-position.test.sh`

**Step 1: Write the failing test**

```bash
cover_line="$(rg -n '<label for="linkEditImage">Cover image</label>' index.html | cut -d: -f1)"
preview_line="$(rg -n '<div class="link-cover-preview hidden" id="linkCoverPreview">' index.html | cut -d: -f1)"
```

Assert that the preview line appears after the cover image label and before the tags section.

**Step 2: Run test to verify it fails**

Run: `bash tests/link-cover-preview-position.test.sh`
Expected: `FAIL` because the preview block is still at the top of the form.

**Step 3: Write minimal implementation**

Move the `link-cover-preview` block in `index.html` to immediately follow the `Cover image` form group.

**Step 4: Run test to verify it passes**

Run: `bash tests/link-cover-preview-position.test.sh`
Expected: `PASS`

**Step 5: Commit**

```bash
git add docs/plans/2026-03-06-link-cover-preview-position.md tests/link-cover-preview-position.test.sh index.html
git commit -m "test: keep link cover preview below image field"
```
