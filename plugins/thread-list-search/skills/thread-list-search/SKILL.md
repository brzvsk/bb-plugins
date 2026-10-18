---
name: thread-list-search
description: Explain or troubleshoot the sidebar thread search and Include archived toggle from the Thread list with search plugin.
---
This plugin replaces bb's sidebar thread list with the same list (a patched copy of bb's bundled `thread-list` plugin) plus one row under New thread:

- **Search** — click to swap the row for an input. Typing filters the list by thread title: every whitespace-separated term must appear, case-insensitive. Parents of matching child threads stay visible; projects without matches are hidden. While a query is active all collapsed groups and More are expanded; collapse toggles made during a search are not saved. Escape, or leaving the input empty, restores the row.
- **Include archived** (archive icon) — toggles bb's `threadLifecycles` preference between `["active"]` and `["active","archived"]`. It is the same setting as Organize → Show in the list and `bb thread-list prefs set threadLifecycles '["active","archived"]'`.

Layout preferences are not stored by this plugin: its server forwards them to bb's built-in `thread-list` plugin, so that plugin must stay enabled. A change made through `bb thread-list prefs` reaches this list after a window reload.

To activate the list pick "Thread list with search" in Settings → Appearance → Sidebar (per client). Disabling this plugin returns bb's own list with the same preferences.
