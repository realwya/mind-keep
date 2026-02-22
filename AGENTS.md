# AGENTS.md

Guidelines for AI agents working on this Keep Notes browser application.

## Project Overview

Pure static web app (HTML/CSS/JS) using File System Access API for local storage. No build tools, no npm, no bundlers. Simply open `index.html` in Chrome/Edge.

## Commands

```bash
# Run application (serve static files)
python -m http.server 8000
npx serve .

# Run all tests
bash tests/*.test.sh

# Run single test
bash tests/feather-icons.test.sh
bash tests/copy-markdown-action.test.sh
```

## Code Style

### JavaScript (app.js)

- **Comments**: Section headers in Chinese (`// ===== 常量配置 =====`), inline comments in English
- **Naming**: camelCase for variables/functions, PascalCase for classes
- **Organization**: Group by feature with `// ===== Section Name =====` headers
- **Error handling**: Prefer `try/catch` with user-friendly `showPopup()` messages
- **Async**: Use `async/await`, wrap IndexedDB in Promise-based API
- **DOM**: Centralize element refs in `elements` object, use event delegation
- **No dependencies**: Only Marked.js via CDN, no npm packages

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
- **Links**: `type: link` with metadata in front matter
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

## File System Conventions

- **Filenames**: Sanitized titles (remove `<>:"/\|?*`, max 200 chars)
- **IDs**: Filename without `.md` extension
- **Trash**: Move to `.trash/` subfolder (don't delete)
- **Storage**: Markdown files with YAML front matter

## State Management

- Global state: `items[]`, `dirHandle`, `pendingUrls`, `currentEditingItem`
- View modes: `VIEW_ACTIVE` vs `VIEW_TRASH`
- Tags: `selectedTags` Set, `allTags` array of {name, count}
- Always sync memory state to filesystem immediately

## UI Patterns

- **Modals**: Full-screen with backdrop blur, ESC to close, auto-save on close
- **Validation**: Real-time feedback, disable submit button on error
- **Popups**: Use `showPopup(message, type)` for success/error feedback
- **Cards**: Masonry grid via CSS columns, event delegation for actions
- **Empty states**: Show helpful messaging with appropriate icons

## Security

- No eval(), innerHTML from user input (use textContent)
- File System Access API requires HTTPS or localhost
- Permission handling via `verifyPermission()` pattern
