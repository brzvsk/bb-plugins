# Project Home

Turns BB's New thread screen into the project's home, and names the project in the top bar.

On the New thread screen (wide layout):

- with a project selected, the composer sits at the bottom like a thread's and the list above it scrolls away underneath. From the bottom up: **Recently done** (root threads archived in the last 48 hours; collapsed by default, the choice is remembered), **Idle** (unarchived root threads, live work first, then threads that need you, then by recency; the second line is the first line of the last message, child threads counted), **Pinned** (pinned threads, with the same last-message line). No cards. A read, idle thread bound to an automation leaves Idle and returns when it is busy, unread or needs you. The status is bb's own status glyph on the left, as in the thread list. On hover a row shows the thread list's quick actions (the ones picked in its Customize actions, read from the bundled thread list's `listPreferences`) and a ⋯ button with bb's full thread menu; right-click opens the same menu.
- **Scheduled**: every upcoming enabled automation of the project as a compact list right under the top bar, outside the scrolling list, so it stays at the top of the screen (about six lines, then it scrolls on its own). One line each: the automation's name, the thread it runs in (muted; "new thread" for per-run automations), the next run on the right; a bound line opens its thread. Lines are dimmed unless their thread has something unread; then the line is at full strength and bb's unread dot replaces the clock.
- the project name at the top-left of the screen, where a thread's header row sits; clicking it returns to the project (reselects it in the composer).
- without a project, the original layout: the composer in the lower middle under a "Working on" heading whose project opens BB's own project dropdown (the native chip under the composer stays visible and works as before).

In every thread's header row, the project name precedes the title as a link; clicking it opens the project (the New thread screen with that project selected).

Data comes from bb's sidebar thread view (active and archived lifecycles), the bundled Automations plugin's `automations_list` RPC, and `threads.conversationOutline` for last messages (a few at a time, refetched when a thread's `updatedAt` changes). No server code, settings or storage.

Uses BB DOM attributes (`root-compose-main-panel`, `root-compose-compact-home`, `data-promptbox-project-control`, `app-page-header-content-row`, `thread-detail-timeline-panel`); future BB layout changes may require an update. The compact (mobile) home is unchanged. The homepage slot's `projectId` is null on the plain compose route, so the board reads the composer's selected project.

Build: `npm ci --include=dev --ignore-scripts`, `npm run typecheck`, `npm test`, `npm run build`. Install from the repository root: `bb plugin install . --plugin new-thread-layout`.
