# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Google Keep-style note-taking application** that runs entirely in the browser and stores data directly to the local filesystem using the **File System Access API**. No server or build process required - just open `index.html` in a supported browser (Chrome, Edge, Opera).

### Features
- **Add notes** with automatic title detection (`# Title` heading or timestamp)
- **Add links** with automatic metadata fetching via Microlink API
- **Edit notes** in a full-screen modal with auto-resize textarea
- **Delete items** (moved to `.trash` folder, not permanently deleted)
- **Markdown support** with front matter for link metadata

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

```markdown
---
type: link
title: Example Site
url: https://example.com
description: A description
image: https://example.com/image.jpg
---
# Optional additional content
```

- **Link items**: Use front matter for metadata (type: link)
- **Note items**: Standard markdown with optional `# Title` heading
- **Deleted items**: Moved to `.trash` subfolder (not permanently deleted)

### Core Components

1. **IndexedDB Wrapper** ([`app.js:12-48`](app.js#L12-L48))
   - Persists directory handles across sessions
   - Database: `keep-db`, Store: `handles`
   - Handles browser security requiring re-confirmation on reload

2. **File System Operations**
   - `loadItems()` ([`app.js:212-243`](app.js#L212-L243)) - Reads all `.md` files from selected directory
   - `saveFile()` ([`app.js:246-259`](app.js#L246-L259)) - Creates/overwrites files
   - `deleteFile()` ([`app.js:261-290`](app.js#L261-L290)) - Moves to `.trash` folder
   - `verifyPermission()` ([`app.js:192-209`](app.js#L192-L209)) - Handles file handle permissions

3. **Link Processing Pipeline**
   - `fetchLinkMetadata()` ([`app.js:607-637`](app.js#L607-L637)) - Uses Microlink API
   - Image selection logic prioritizes: main image → screenshot → logo
   - Creates front matter with metadata

4. **Note Editing System**
   - `openEditModal()` ([`app.js:505-515`](app.js#L505-L515)) - Opens edit modal with note content
   - `saveEditedNote()` ([`app.js:530-577`](app.js#L530-L577)) - Saves changes to filesystem and updates UI
   - `closeEditModal()` ([`app.js:518-527`](app.js#L518-L527)) - Handles unsaved changes confirmation
   - `autoResizeTextarea()` ([`app.js:603-617`](app.js#L603-L617)) - Dynamically adjusts textarea height
   - Full-screen modal with backdrop, keyboard shortcuts (ESC to close)

5. **UI Rendering**
   - Uses HTML `<template>` elements ([`index.html:94-151`](index.html#L94-L151))
   - Masonry grid layout (CSS columns)
   - Event delegation for card actions ([`handleCardClick()`](app.js#L410-L501))
   - Custom confirmation overlay for delete (no native confirm())
   - Edit modal with auto-resize textarea ([`styles.css:745-873`](styles.css#L745-L873))

### Front Matter Parsing

Custom YAML parser ([`app.js:523-538`](app.js#L523-L538)) - handles basic `key: value` pairs. Does not support:
- Multi-line values
- Nested objects
- Arrays
- Quotes or escape sequences

### State Management

- `items` array in memory ([`app.js:96`](app.js#L96)) - synced with filesystem
- `dirHandle` ([`app.js:95`](app.js#L95)) - cached directory handle
- `pendingUrls` Set ([`app.js:97`](app.js#L97)) - prevents duplicate link additions
- `currentEditingItem` ([`app.js:100`](app.js#L100)) - currently editing note
- `isEditDirty` ([`app.js:101`](app.js#L101)) - tracks unsaved edits

## External Dependencies

- **Marked.js** - Markdown rendering (loaded via CDN: [`index.html:13`](index.html#L13))
- **Microlink API** - Link metadata extraction ([`app.js:7`](app.js#L7))
- **Google Fonts** - Roboto font family

## File Structure

```
├── index.html      # Main HTML with templates and edit modal
├── app.js          # All application logic
├── styles.css      # Google Keep styling
├── CLAUDE.md       # This file
└── (user notes)    # Created at runtime in selected folder
    └── .trash/     # Deleted items
```

## Key Implementation Details

### Title Detection
Notes use automatic title detection ([`detectTitle()`](app.js#L655-L675)):
- If content starts with `# Title`, uses that as filename
- Otherwise generates timestamp filename: `20260205143125`
- Filename becomes the note ID and is never changed on edit

### ID Generation
IDs are generated using timestamp + random string: [`app.js:650-652`](app.js#L650-L652)
```javascript
Date.now().toString(36) + Math.random().toString(36).slice(2)
```
Note: For notes, the filename (without .md) is used as ID instead

### Edit Flow
1. Click note card → Opens full-screen edit modal
2. Modal shows full markdown content (including `# Title` if present)
3. Edit content → Save → Updates filesystem, memory, and UI
4. Filename remains unchanged (only content is updated)
5. Unsaved changes trigger confirmation on close

### Delete Flow
1. Click delete → Show custom overlay
2. Confirm → Move file to `.trash/{filename}`
3. Falls back to copy+delete if `fileHandle.move()` unavailable

### Link Detection
Single-line URL input automatically triggers link metadata fetch ([`app.js:305-307`](app.js#L305-L307))

## Styling Conventions

- CSS custom properties for theming ([`styles.css:2-32`](styles.css#L2-L32))
- Mobile-first responsive breakpoints at 1100px, 800px, 600px
- Masonry layout using CSS columns (not JavaScript)
- Skeleton loading animation for link fetch
- Edit modal with auto-resize textarea ([`styles.css:818-831`](styles.css#L818-L831))
  - Min-height: 200px, max-height: limited by viewport
  - Dynamic height adjustment via JavaScript
  - Backdrop with blur effect
