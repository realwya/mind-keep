# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Google Keep-style note-taking application** that runs entirely in the browser and stores data directly to the local filesystem using the **File System Access API**. No server or build process required - just open `index.html` in a supported browser (Chrome, Edge, Opera).

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

4. **UI Rendering**
   - Uses HTML `<template>` elements ([`index.html:94-151`](index.html#L94-L151))
   - Masonry grid layout (CSS columns)
   - Event delegation for card actions
   - Custom confirmation overlay for delete (no native confirm())

### Front Matter Parsing

Custom YAML parser ([`app.js:523-538`](app.js#L523-L538)) - handles basic `key: value` pairs. Does not support:
- Multi-line values
- Nested objects
- Arrays
- Quotes or escape sequences

### State Management

- `items` array in memory ([`app.js:85`](app.js#L85)) - synced with filesystem
- `dirHandle` ([`app.js:84`](app.js#L84)) - cached directory handle
- `pendingUrls` Set ([`app.js:86`](app.js#L86)) - prevents duplicate link additions

## External Dependencies

- **Marked.js** - Markdown rendering (loaded via CDN: [`index.html:13`](index.html#L13))
- **Microlink API** - Link metadata extraction ([`app.js:7`](app.js#L7))
- **Google Fonts** - Roboto font family

## File Structure

```
├── index.html      # Main HTML with templates
├── app.js          # All application logic
├── styles.css      # Google Keep styling
└── (user notes)    # Created at runtime in selected folder
    └── .trash/     # Deleted items
```

## Key Implementation Details

### ID Generation
IDs are generated using timestamp + random string: [`app.js:650-652`](app.js#L650-L652)
```javascript
Date.now().toString(36) + Math.random().toString(36).slice(2)
```

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
