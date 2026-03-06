# Edit Modal Tags Unification Design

**Goal:** Make the note edit modal tag field match the link edit modal tag field in structure and shared visual styling.

## Scope

- Keep the existing `TagsInput` component behavior unchanged.
- Move the note edit modal tag area into a labeled field wrapper that matches the link edit modal pattern.
- Extract shared spacing and divider styling for edit-modal tag fields so both modals use the same CSS hooks.

## Approach

- Update the note edit modal HTML so its tags area uses the same `form-group` style field wrapper as the link edit modal.
- Add a dedicated shared class for edit-modal tag fields and move spacing/divider rules there.
- Keep `TagsInput` responsible only for rendering tags, the input, and suggestions inside the provided container.
- Give both generated tag inputs explicit IDs so their labels point at a real focus target.

## Risks

- Moving padding and divider rules off `.tags-input-container` could affect other tag-input uses if not scoped carefully.
- The link edit modal already has unrelated in-flight changes, so edits must stay limited to the tags field block and shared CSS only.

## Validation

- Add a shell test that asserts both edit modals use the same labeled tag field wrapper.
- Run the new test plus the existing link-cover-preview positioning test to confirm the link modal structure still holds.
