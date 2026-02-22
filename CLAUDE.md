# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Google Keep-style note-taking application** that runs entirely in the browser and stores data directly to the local filesystem using the **File System Access API**. No server or build process required - just open `index.html` in a supported browser (Chrome, Edge, Opera).

### Features
- **Add notes** with automatic title detection (`# Title` heading or timestamp)
- **Add links** with automatic metadata fetching via Microlink API
- **Edit notes** in a full-screen modal with auto-save on close
- **Edit links** with a dedicated form-based modal for metadata
- **Tags support** for organizing notes and links
- **Title uniqueness validation** to prevent duplicate note titles
- **Delete items** (moved to `.trash` folder, not permanently deleted)
- **Markdown support** with front matter for metadata and tags

## Development

### Running the Application

Simply open `index.html` in a browser, or serve it with any static file server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve .

# Using PHP
php -S localhost:8000
```

**Note**: The File System Access API requires HTTPS or localhost. Opening the file directly (`file://` protocol) works but may have restrictions.

### Browser Compatibility

The File System Access API is supported in:
- Chrome/Edge 86+
- Opera 72+
- Not supported in Firefox, Safari (as of 2025)

## Architecture

### Data Flow

```
User Input → Form Submit → File System Write (Markdown) → UI Render
           ↓
    Link URL → Microlink API → Metadata Fetch → Front Matter → Save
```

### Storage Model

All items are stored as **Markdown files** with YAML front matter:

**Link items:**
```markdown
---
type: link
title: Example Site
url: https://example.com
description: A description
image: https://example.com/image.jpg
tags: tech, programming, javascript
---
```

**Note items:**
```markdown
---
tags: personal, todo
---
# Note Title (optional)

Note content here...
```

- **Link items**: Use front matter for metadata (type: link)
- **Note items**: Optional front matter for tags, optional `# Title` heading
- **Deleted items**: Moved to `.trash` subfolder (not permanently deleted)
- **Filename**: Based on title (sanitized) or timestamp, becomes the item ID

### Core Components

1. **IndexedDB Wrapper** ([`app.js:19-55`](app.js#L19-L55))
   - Persists directory handles across sessions
   - Database: `keep-db`, Store: `handles`
   - Handles browser security requiring re-confirmation on reload

2. **File System Operations**
   - `loadItems()` ([`app.js:378-409`](app.js#L378-L409)) - Reads all `.md` files from selected directory
   - `saveFile()` ([`app.js:412-425`](app.js#L412-L425)) - Creates/overwrites files
   - `deleteFile()` ([`app.js:427-456`](app.js#L427-L456)) - Moves to `.trash` folder
   - `verifyPermission()` ([`app.js:358-375`](app.js#L358-L375)) - Handles file handle permissions

3. **Link Processing Pipeline**
   - `fetchLinkMetadata()` ([`app.js:1150-1180`](app.js#L1150-L1180)) - Uses Microlink API
   - Image selection logic prioritizes: main image → screenshot → logo
   - Creates front matter with metadata
   - `sanitizeFilename()` ([`app.js:1198-1218`](app.js#L1198-L1218)) - Cleans titles for filesystem compatibility

4. **Tags System** ([`app.js:122-242`](app.js#L122-L242))
   - `TagsInput` class for tag management
   - Supports Enter/ comma to add tags, Backspace to remove
   - Tags stored in front matter as comma-separated values
   - Rendered on cards with `.tag` elements
   - Used in both note creation and editing

5. **Note Editing System** ([`app.js:692-865`](app.js#L692-L865))
   - `openNoteEditModal()` ([`app.js:709-725`](app.js#L709-L725)) - Opens note edit modal with content
   - `saveEditedNote()` ([`app.js:758-833`](app.js#L758-L833)) - Saves changes to filesystem and updates UI
   - `closeEditModal()` ([`app.js:744-755`](app.js#L744-L755)) - Auto-saves on close
   - Full-screen modal with backdrop, keyboard shortcuts (ESC to close)

6. **Link Editing System** ([`app.js:728-985`](app.js#L728-L985))
   - `openLinkEditModal()` ([`app.js:728-741`](app.js#L728-L741)) - Opens link edit form
   - `saveLinkEdit()` ([`app.js:903-985`](app.js#L903-L985)) - Saves link metadata changes
   - `closeLinkEditModal()` ([`app.js:889-900`](app.js#L889-L900)) - Auto-saves on close
   - Form-based modal for editing title, URL, description, image

7. **Title Validation** ([`app.js:1233-1275`](app.js#L1233-L1275))
   - `isTitleExists()` ([`app.js:1236-1243`](app.js#L1236-L1243)) - Checks title uniqueness
   - `handleTitleInput()` ([`app.js:1246-1259`](app.js#L1246-L1259)) - Real-time validation feedback
   - Prevents duplicate note titles at creation time

8. **UI Rendering**
   - Uses HTML `<template>` elements ([`index.html:96-160`](index.html#L96-L160))
   - Masonry grid layout (CSS columns)
   - Event delegation for card actions ([`handleCardClick()`](app.js#L605-L689))
   - Custom confirmation overlay for delete (no native confirm())
   - Note edit modal ([`index.html:163-189`](index.html#L163-L189))
   - Link edit modal ([`index.html:192-237`](index.html#L192-L237))

### Front Matter Parsing

Custom YAML parser ([`parseFrontMatter()`](app.js#L1033-L1048)) - handles basic `key: value` pairs. Does not support:
- Multi-line values
- Nested objects
- Arrays (tags are stored as comma-separated strings instead)
- Quotes or escape sequences

Creates front matter with [`createMarkdownWithFrontMatter()`](app.js#L1050-L1057).

### State Management

- `items` array in memory ([`app.js:111`](app.js#L111)) - synced with filesystem
- `dirHandle` ([`app.js:110`](app.js#L110)) - cached directory handle
- `pendingUrls` Set ([`app.js:112`](app.js#L112)) - prevents duplicate link additions
- `currentEditingItem` ([`app.js:115`](app.js#L115)) - currently editing item
- `noteTagsInput` ([`app.js:118`](app.js#L118)) - TagsInput instance for note creation
- `editTagsInput` ([`app.js:119`](app.js#L119)) - TagsInput instance for note editing
- `linkEditTagsInput` ([`app.js:120`](app.js#L120)) - TagsInput instance for link editing

## External Dependencies

- **Marked.js** - Markdown rendering (loaded via CDN: [`index.html:13`](index.html#L13))
- **Microlink API** - Link metadata extraction ([`app.js:7`](app.js#L7))
- **Google Fonts** - Roboto font family

## File Structure

```
├── index.html      # Main HTML with templates and edit modals
├── app.js          # All application logic (1278 lines)
├── styles.css      # Google Keep styling (988 lines)
├── CLAUDE.md       # This file
└── (user notes)    # Created at runtime in selected folder
    └── .trash/     # Deleted items
```

## Key Implementation Details

### Title Detection & Filename Generation
- **Notes with title**: If user provides a title, it's sanitized and used as filename
- **Notes without title**: Uses `generateTimestampTitle()` ([`app.js:1221-1231`](app.js#L1221-L1231)) → `20260205143125`
- **Links**: Uses link title (from API) sanitized via `sanitizeFilename()` ([`app.js:1198-1218`](app.js#L1198-L1218))
- **Filename sanitization**: Removes illegal characters (`<>:"/\|?*`), limits length to 200 chars
- **Filename becomes ID**: The filename (without .md) is used as the item ID and never changes

### Title Uniqueness Validation
- [`isTitleExists()`](app.js#L1236-L1243) checks if a title already exists in current items
- [`handleTitleInput()`](app.js#L1246-L1259) provides real-time validation feedback
- Prevents creating notes/links with duplicate titles
- Shows error message and disables save button when duplicate detected

### ID Generation
The filename (without .md extension) serves as the ID:
- Notes: `MyNote.md` → ID: `MyNote`
- Links: `Example Site.md` → ID: `Example Site`
- Untimestamped notes: `20260205143125.md` → ID: `20260205143125`

### Note Edit Flow
1. Click note card → Opens note edit modal ([`openNoteEditModal()`](app.js#L709-L725))
2. Modal shows markdown content (without front matter) and tags
3. Edit content/tags → Save button or Close → Auto-saves to filesystem
4. Updates memory and UI card (title, content, tags)
5. Filename remains unchanged (only content and front matter are updated)

### Link Edit Flow
1. Click link card → Opens link edit modal ([`openLinkEditModal()`](app.js#L728-L741))
2. Modal shows form with title, URL, description, image, and tags
3. Edit metadata → Save button or Close → Auto-saves to filesystem
4. Updates memory and UI card (all visible fields)
5. Filename remains unchanged

### Delete Flow
1. Click delete → Show custom overlay on card
2. Confirm → Move file to `.trash/{filename}` ([`deleteFile()`](app.js#L427-L456))
3. Falls back to copy+delete if `fileHandle.move()` unavailable
4. Removes from memory and animates card removal from UI

### Tags System
- **Creation**: TagsInput component in note form ([`index.html:67`](index.html#L67))
- **Editing**: Separate TagsInput instances for note and link edit modals
- **Storage**: Comma-separated in front matter (`tags: tech,programming`)
- **Display**: Rendered as pill badges on cards ([`renderTags()`](app.js#L1127-L1137))
- **Input**: Press Enter or comma to add, Backspace to remove last, click × to remove specific

## Recent Changes

Based on git commit history:

1. **Tags support** ([commit #4](https://github.com/your-repo/commit/e2e699c))
   - Added TagsInput component for tag management
   - Tags stored in front matter as comma-separated values
   - Tags displayed on cards with pill styling

2. **Link card editing** ([commit #4](https://github.com/your-repo/commit/e2e699c))
   - Dedicated link edit modal with form fields
   - Edit title, URL, description, image, and tags
   - Auto-save on modal close

3. **Title uniqueness validation** ([commit #3](https://github.com/your-repo/commit/7d8d843))
   - Prevents duplicate note titles at creation
   - Real-time validation feedback
   - Error message display and save button disable

4. **Auto-save on modal close** ([commit #2](https://github.com/your-repo/commit/4d7a4d5))
   - Modal close triggers automatic save
   - No cancel button - always save changes
   - Simplified user workflow

5. **Link title as filename** ([commit #1](https://github.com/your-repo/commit/b20030d))
   - Link titles from API used as filenames
   - Filename sanitization for filesystem compatibility
   - Filename becomes item ID

## Styling Conventions

- CSS custom properties for theming ([`styles.css:2-32`](styles.css#L2-L32))
- Mobile-first responsive breakpoints at 1100px, 800px, 600px
- Masonry layout using CSS columns (not JavaScript)
- Skeleton loading animation for link fetch ([`styles.css:511-553`](styles.css#L511-L553))
- Edit modal ([`styles.css:769-897`](styles.css#L769-L897))
  - Fixed height textarea (600px) with min-height
  - Backdrop with blur effect
  - Slide-up animation on open
- Tags input styles ([`styles.css:899-951`](styles.css#L899-L951))
  - Pill-style tags with remove button
  - Inline input field
  - Gray background for inactive state
- Link edit form ([`styles.css:952-988`](styles.css#L952-L988))
  - Form-based layout with labeled inputs
  - Bordered input fields with focus states
- Card tags display ([`styles.css:940-950`](styles.css#L940-L950))
  - Small pill tags below card content
