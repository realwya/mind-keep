# Public Launch Checklist

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a public beta of Mindkeep that anyone can open over the web and use locally in their own browser with clear limitations, stable fallbacks, and acceptable production risk.

**Architecture:** This app is still a local-first static web app. Public launch means public hosting plus browser/runtime hardening, not a migration to accounts or cloud sync. The release should optimize for "open URL, pick local folder, use safely" rather than "shared multi-device product."

**Tech Stack:** Static HTML/CSS/JavaScript, File System Access API, IndexedDB, Markdown files with YAML front matter, Microlink API, Lucide, Marked, DOMPurify, optional CodeMirror from `esm.sh`, X widgets.

---

## Launch Scope

This checklist is for a public beta where:

- Anyone can open the deployed URL.
- Each user stores data in a folder they pick on their own device.
- No account system, cloud sync, or collaboration is included.

This checklist does **not** cover:

- User authentication
- Cross-device sync
- Shared workspaces
- Multiplayer collaboration

## P0: Must Do Before Public Launch

- [ ] Deploy to an HTTPS static host.
  Files: deployment config outside repo or hosting dashboard, optionally add project docs in `/Users/yuanwen/conductor/repos/keep-notes/README.md`
  Why: `showDirectoryPicker()` requires a secure context and is central to the current storage model.
  Current code: [fs.js](/Users/yuanwen/conductor/repos/keep-notes/fs.js#L40), [fs.js](/Users/yuanwen/conductor/repos/keep-notes/fs.js#L68)
  Done when: the production URL is served over HTTPS and the folder picker works on supported desktop browsers.

- [ ] Add browser capability detection on startup.
  Files: `/Users/yuanwen/conductor/repos/keep-notes/app.js`, `/Users/yuanwen/conductor/repos/keep-notes/config.js`, `/Users/yuanwen/conductor/repos/keep-notes/index.html`
  Why: unsupported browsers currently fail too late and too vaguely.
  Check for: `window.showDirectoryPicker`, `window.indexedDB`, `window.isSecureContext`, clipboard availability where relevant.
  Done when: unsupported browsers see a clear explanation before interacting with the app.

- [ ] Add an explicit unsupported-browser empty state.
  Files: `/Users/yuanwen/conductor/repos/keep-notes/index.html`, `/Users/yuanwen/conductor/repos/keep-notes/styles.css`, `/Users/yuanwen/conductor/repos/keep-notes/app.js`
  Why: public users need to know this is a local-folder app and which browsers are expected to work.
  Message should explain:
  - The app stores notes in a local folder chosen by the user.
  - A Chromium-based desktop browser is currently recommended.
  - HTTPS is required outside localhost.
  Done when: first-time users can understand the constraint without reading external docs.

- [ ] Harden third-party dependency failures so core note-taking still works.
  Files: `/Users/yuanwen/conductor/repos/keep-notes/config.js`, `/Users/yuanwen/conductor/repos/keep-notes/utils.js`, `/Users/yuanwen/conductor/repos/keep-notes/editor.js`, `/Users/yuanwen/conductor/repos/keep-notes/index.html`
  Why: public launch should not depend on every remote script succeeding.
  Current external dependencies:
  - Microlink API in [config.js](/Users/yuanwen/conductor/repos/keep-notes/config.js#L7) and [utils.js](/Users/yuanwen/conductor/repos/keep-notes/utils.js#L377)
  - X widgets in [config.js](/Users/yuanwen/conductor/repos/keep-notes/config.js#L16) and [utils.js](/Users/yuanwen/conductor/repos/keep-notes/utils.js#L51)
  - CodeMirror runtime imports in [editor.js](/Users/yuanwen/conductor/repos/keep-notes/editor.js#L78)
  - Fonts and CDN scripts in [index.html](/Users/yuanwen/conductor/repos/keep-notes/index.html#L12) and [index.html](/Users/yuanwen/conductor/repos/keep-notes/index.html#L544)
  Done when: users can still create, edit, search, archive, and restore notes even if previews, X embeds, or rich editor modules fail.

- [ ] Make link-save behavior resilient when Microlink fails or rate-limits.
  Files: `/Users/yuanwen/conductor/repos/keep-notes/utils.js`, `/Users/yuanwen/conductor/repos/keep-notes/app.js`
  Why: Microlink is the most likely public-launch failure point.
  Minimum behavior:
  - Saving a link should still succeed without metadata.
  - The UI should show a non-blocking message if preview metadata is unavailable.
  - No broken error page content should be persisted as title or cover.
  Done when: users can add raw links under degraded network or quota conditions.

- [ ] Replace non-deterministic production dependencies.
  Files: `/Users/yuanwen/conductor/repos/keep-notes/index.html`
  Why: `lucide@latest` is not production-safe and remote assets should be pinned.
  Current issue: [index.html](/Users/yuanwen/conductor/repos/keep-notes/index.html#L544)
  Done when: all CDN dependencies are pinned to explicit versions or self-hosted.

- [ ] Publish a privacy and data-handling page.
  Files: create `/Users/yuanwen/conductor/repos/keep-notes/privacy.html` or `/Users/yuanwen/conductor/repos/keep-notes/docs/privacy.md`, link it from `/Users/yuanwen/conductor/repos/keep-notes/index.html`
  Why: public users need a clear statement about where data is stored and what external requests happen.
  Must state:
  - Notes are stored in a local folder chosen by the user.
  - The app may request third-party services for link metadata and X embeds.
  - Clipboard actions use browser APIs only when triggered by the user.
  Done when: a user can understand the privacy boundary before trusting the app.

- [ ] Publish a short help page for first-time users.
  Files: create `/Users/yuanwen/conductor/repos/keep-notes/help.html` or `/Users/yuanwen/conductor/repos/keep-notes/docs/help.md`, link it from `/Users/yuanwen/conductor/repos/keep-notes/index.html`
  Why: the local-folder model is unfamiliar to most users.
  Must explain:
  - How to choose a folder
  - Which browsers are recommended
  - Why permissions are requested again on revisit
  - What Archive and `.trash` do
  Done when: users can self-serve basic onboarding and recovery questions.

- [ ] Run public-launch smoke tests in real browsers.
  Files: existing shell tests in `/Users/yuanwen/conductor/repos/keep-notes/tests`, plus manual verification notes in a release doc
  Why: shell tests do not validate browser permissions, secure context behavior, or third-party failures.
  Minimum matrix:
  - Latest Chrome on desktop
  - Latest Edge on desktop
  - One unsupported browser to confirm fallback UX
  Test scenarios:
  - First run on a clean profile
  - Restore previously granted folder access
  - Link save with Microlink unavailable
  - Note editing when CodeMirror import fails
  - X post rendering when widgets.js fails
  Done when: there is a written pass/fail record for each scenario.

## P1: Strongly Recommended For Stable Release

- [ ] Add a web app manifest and install metadata.
  Files: create `/Users/yuanwen/conductor/repos/keep-notes/manifest.webmanifest`, update `/Users/yuanwen/conductor/repos/keep-notes/index.html`
  Why: improves installability and helps position the app as a local-first tool.
  Include: app name, icons, theme color, display mode, start URL.

- [ ] Improve metadata for search and sharing.
  Files: `/Users/yuanwen/conductor/repos/keep-notes/index.html`
  Why: the current document head is minimal and not launch-ready for a public landing page.
  Add: `og:title`, `og:description`, `og:image`, `twitter:card`, canonical URL, theme color.

- [ ] Decide which external assets should be self-hosted.
  Files: likely `/Users/yuanwen/conductor/repos/keep-notes/assets`, `/Users/yuanwen/conductor/repos/keep-notes/index.html`, `/Users/yuanwen/conductor/repos/keep-notes/editor.js`
  Why: self-hosting reduces CDN drift and third-party outage risk.
  Highest-priority candidates:
  - Lucide bundle
  - DOMPurify
  - Marked
  - Web fonts

- [ ] Add lightweight production monitoring.
  Files: optional new config/docs, depending on provider
  Why: public launch without visibility creates long blind-debug cycles.
  Minimum signal to capture:
  - startup failures
  - folder picker unsupported errors
  - Microlink failures
  - CodeMirror import failures

- [ ] Expand release documentation.
  Files: create `/Users/yuanwen/conductor/repos/keep-notes/README.md` if needed, or update project docs in `/Users/yuanwen/conductor/repos/keep-notes/docs`
  Why: public users and future maintainers need one canonical launch document.
  Include:
  - product description
  - browser support statement
  - local storage model
  - development and deployment instructions

## P2: Can Be Deferred Until After Launch

- [ ] Service worker and offline caching.
  Files: new service worker files and `/Users/yuanwen/conductor/repos/keep-notes/index.html`
  Why: valuable, but not required for public beta if the core local-folder model is already clear.

- [ ] Desktop-quality polish for unsupported mobile flows.
  Files: `/Users/yuanwen/conductor/repos/keep-notes/styles.css`, `/Users/yuanwen/conductor/repos/keep-notes/index.html`, `/Users/yuanwen/conductor/repos/keep-notes/app.js`
  Why: mobile browser support for File System Access is uneven, so this is secondary to a good desktop experience.

- [ ] Import/export helpers and migration utilities.
  Files: likely `/Users/yuanwen/conductor/repos/keep-notes/fs.js`, `/Users/yuanwen/conductor/repos/keep-notes/app.js`, new docs/tests
  Why: useful for user confidence, but not required for initial beta.

- [ ] Multi-language onboarding copy.
  Files: `/Users/yuanwen/conductor/repos/keep-notes/index.html`, `/Users/yuanwen/conductor/repos/keep-notes/app.js`
  Why: helpful after you validate the launch model and target audience.

- [ ] Cloud sync or shared collaboration.
  Why: out of scope for this architecture and should be treated as a separate product initiative.

## Suggested Execution Order

1. Ship the deployment baseline: HTTPS hosting, domain, and browser capability checks.
2. Harden all remote dependencies so local notes still work under degraded conditions.
3. Publish help and privacy docs so the product model is explicit.
4. Run manual launch QA across supported and unsupported browsers.
5. Add P1 polish after the beta URL is already live.

## Release Sign-Off Checklist

- [ ] Production URL uses HTTPS
- [ ] Supported-browser detection is live
- [ ] Unsupported-browser message is live
- [ ] Link save works without Microlink metadata
- [ ] Rich editor falls back cleanly when `esm.sh` imports fail
- [ ] X embed failure does not break card rendering
- [ ] Privacy page is linked
- [ ] Help page is linked
- [ ] CDN dependencies are pinned or intentionally accepted with documented risk
- [ ] Manual browser QA has been recorded

## Notes For Future Scope Decisions

If the next product goal becomes "users can access the same notes across devices" or "users can share notes with each other," this checklist is no longer enough. That would require a new storage and sync architecture rather than additional launch polish on the current static app.
