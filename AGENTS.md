# AGENTS.md

Guidelines for AI agents working on this Keep Notes browser application.

## Project Overview

Pure static web app (HTML/CSS/JS) using File System Access API for local storage. No build tools, no npm, no bundlers. Data is persisted as Markdown files with YAML front matter and rendered as note/link/image cards with sidebar filters, search, and trash view.

## Instruction File Priority

- Use this `AGENTS.md` as the single source of truth for agent behavior in this repository.
- `CLAUDE.md` is optional and should only contain a short pointer back to `AGENTS.md`.
- If `CLAUDE.md` conflicts with `AGENTS.md`, follow `AGENTS.md`.

## Commands

```bash
# Run application (serve static files)
python -m http.server 8000
npx serve .

# Run all tests
bash tests/*.test.sh

# Run single test
bash tests/feather-icons.test.sh```

## Code Style

### JavaScript Architecture

- **Modularization**: Code is split by feature (`config.js`, `utils.js`, `fs.js`, `cards.js`, `sidebar.js`, `tags-input.js`, `editor.js`, `app.js`).
- **Comments**: Section headers in Chinese (`// ===== 常量配置 =====`), inline comments in English
- **Naming**: camelCase for variables/functions, PascalCase for classes
- **Organization**: Group by feature with `// ===== Section Name =====` headers
- **Error handling**: Prefer `try/catch` with user-friendly `showPopup()` messages
- **Async**: Use `async/await`, wrap IndexedDB in Promise-based API
- **DOM**: Centralize element refs in `elements` object (in `config.js`), use event delegation
- **Runtime dependencies**: Keep browser-side CDN/dynamic imports only (Marked, Feather, DOMPurify, optional CodeMirror modules), no npm packages

### CSS (styles.css)

- **Naming**: kebab-case class names
- **Organization**: CSS custom properties in `:root`, grouped by component
- **Variables**: Use existing CSS vars (`--bg-primary`, `--radius-md`, etc.)
- **Responsive**: Mobile-first, breakpoints at 1100px, 800px, 600px
- **Shadows**: Use existing shadow variables, not arbitrary values

### HTML (index.html)

- **Icons**: Use Feather Icons (`<i data-feather="name">`), never inline SVG
- **Accessibility**: Include `aria-label` on buttons, `aria-hidden` on icons
- **Templates**: Use `<template>` elements for dynamic content
- **Comments**: Chinese for structural comments

### Markdown Storage

- **Front matter**: YAML format for metadata (type, url, description, image, tags)
- **Tags**: Comma-separated values in front matter
- **Links/Images**: `type: link` or `type: image` with metadata in front matter
- **Notes**: Optional `# Title` heading, optional front matter for tags

## Testing

Tests are shell scripts using `rg` (ripgrep) to verify code patterns:

```bash
# Test file structure
#!/usr/bin/env bash
set -euo pipefail

if ! rg -q 'pattern' file; then
  echo "FAIL: description"
  exit 1
fi

echo "PASS: description"
```

Current checks in this repo:

- `tests/feather-icons.test.sh`: Feather icon usage and no inline SVG
- `tests/copy-markdown-action.test.sh`: Note-card copy markdown action wiring and clipboard feedback
- `tests/archive-view.test.sh`: Archive view functionality logic
- `tests/sidebar-collapse-toggle.test.sh`: Sidebar toggle interactions

## File System Conventions

- **Filenames**: Sanitized titles (remove `<>:"/\|?*`, max 200 chars)
- **IDs**: Filename without `.md` extension
- **Trash/Archive**: Move to `.trash/` or `Archive/` subfolders (don't delete)
- **Storage**: Markdown files with YAML front matter

## State Management

- Global state: `items[]`, `dirHandle`, `pendingUrls`, `currentEditingItem`, `currentView`, `searchQuery`
- View modes: `VIEW_ACTIVE`, `VIEW_ARCHIVE`, and `VIEW_TRASH`
- Filters: `selectedTags` Set, `allTags` array of {name, count}, single-select `selectedType`, `allTypes`
- Editor state: `noteEditorView` and lazy `noteEditorLoader` for CodeMirror fallback behavior
- Always sync memory state to filesystem immediately

## UI Patterns

- **Modals**: Full-screen with backdrop blur, ESC to close, auto-save on close
- **Validation**: Real-time feedback, disable submit button on error
- **Popups**: Use `showPopup(message, type)` for success/error feedback
- **Cards**: Masonry grid via CSS columns, event delegation for actions, copy-markdown action for notes
- **Sidebar**: Search + type/tag filters, active filter chips, mobile drawer + overlay behavior
- **Rich content**: Markdown task checkboxes stay interactive and persist back to source markdown
- **Empty states**: Show helpful messaging with appropriate icons

## Security

- No eval(), innerHTML from user input (use textContent)
- File System Access API requires HTTPS or localhost
- Permission handling via `verifyPermission()` pattern


## Technical Reference

Condensed implementation notes migrated from the former `CLAUDE.md` (deduplicated with sections above).

### Core Flows

- Data flow: `User Input -> Form Submit -> File System Write (Markdown) -> UI Render`.
- Link flow: `URL -> Microlink API -> metadata front matter -> save`.
- Storage: one Markdown file per item; deleted files move to `.trash/` (no hard delete).
- Load-time normalization: active files are normalized to `type: note/link/image` based on metadata/url.

### Components

1. IndexedDB wrapper (`keep-db`/`handles`) persists directory handles across sessions.
2. File operations center around `verifyPermission()`, `loadItems()`, `saveFile()`, and `deleteFile()`.
3. Link pipeline uses `fetchLinkMetadata()` and `sanitizeFilename()` with image priority: main image, screenshot, logo.
4. `TagsInput` supports add/remove UX and stores tags as comma-separated front matter.
5. Note/link edit modals auto-save on close; note rename updates filename/ID, link edit keeps filename-based ID.
6. Notes render via Marked with interactive task checkbox syncing (`[ ]`/`[x]`) back to markdown.
7. X/Twitter status URLs render embeds with graceful fallback when widget loading is unavailable.

### Front Matter Limits

- `parseFrontMatter()` handles simple `key: value` pairs only.
- Unsupported: multi-line values, nested objects, arrays, and escaped quoting.

### External Services

- Marked.js via CDN for Markdown rendering.
- Feather Icons via CDN for icon replacement.
- Microlink API for link metadata extraction.
- CodeMirror modules loaded lazily from `esm.sh` for note editing (fallback to `<textarea>` on load failure).
