# Add Box Close Removal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the visible `Close` button from the expanded add box while preserving keyboard `Escape` collapse behavior.

**Architecture:** Keep the existing expanded form and collapse helpers intact. Remove the redundant close button markup and its click binding, then cover the intended behavior with a focused shell regression test that checks for the missing button and the retained `Escape -> collapseForm()` path.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, shell-based `rg` tests

---

### Task 1: Lock the behavior with a regression test

**Files:**
- Create: `tests/add-box-expanded-actions.test.sh`
- Test: `tests/add-box-expanded-actions.test.sh`

**Step 1: Write the failing test**

Add a shell test that:
- fails if `index.html` still contains `id="closeNoteForm"`
- fails if the expanded add box no longer contains the `Save` button
- fails if the app no longer has the `Escape` branch that calls `collapseForm()`

**Step 2: Run test to verify it fails**

Run: `bash tests/add-box-expanded-actions.test.sh`
Expected: FAIL because the `Close` button still exists

**Step 3: Write minimal implementation**

Remove the `Close` button from `index.html` and delete the `closeNoteForm` click binding from `app.js`.

**Step 4: Run test to verify it passes**

Run: `bash tests/add-box-expanded-actions.test.sh`
Expected: PASS

### Task 2: Verify related behavior still holds

**Files:**
- Verify: `app.js`
- Verify: `index.html`
- Test: `tests/add-box-shortcut.test.sh`

**Step 1: Run focused regression checks**

Run:
- `bash tests/add-box-expanded-actions.test.sh`
- `bash tests/add-box-shortcut.test.sh`

Expected: both PASS
