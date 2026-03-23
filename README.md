# Mindkeep

Mindkeep is a lightweight note and bookmark app built with plain HTML, CSS, and JavaScript. It runs entirely in the browser, stores data in a local folder through the File System Access API, and saves every item as a Markdown file with simple YAML front matter.

## Features

- Create and edit notes, links, and image entries
- Store everything as local Markdown files
- Browse content with search, type filters, and tag filters
- Move items to Archive or Trash instead of deleting permanently
- Render Markdown cards with interactive task checkboxes
- Fetch link metadata for richer link previews

## Tech Stack

- Static `index.html`, `styles.css`, and modular JavaScript files
- File System Access API for local-first storage
- IndexedDB for remembering the selected folder handle
- Marked, DOMPurify, Lucide, and optional CodeMirror loaded in the browser

## Run Locally

Because this app uses the File System Access API, run it on `localhost` or HTTPS.

```bash
python -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

## Live Demo

The app is also available online at [wya-mindkeep-app.vercel.app](https://wya-mindkeep-app.vercel.app/).

## Tests

Run all shell-based checks with:

```bash
bash tests/*.test.sh
```

## Project Structure

- `index.html`: app shell and templates
- `styles.css`: layout and component styles
- `app.js`: app orchestration and event wiring
- `fs.js`: file system and persistence logic
- `cards.js`, `sidebar.js`, `editor.js`, `tags-input.js`: UI modules
