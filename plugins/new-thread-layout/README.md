# Project Home

Turns BB's New thread screen into the project's home, and names the project in the top bar.

On the New thread screen (wide layout):

- the composer sits under a "Working on 📁 <project>" heading; clicking the project opens BB's own project dropdown (the native chip under the composer stays visible and works as before);
- below the composer, the selected project's threads in four groups, no cards: **Pinned** (pinned threads; an automation's next run as the second line), **In progress** (unarchived root threads, live work first, then threads that need you, then by recency; the second line is the first line of the last message, child threads counted), **Scheduled** (the project's enabled automations by next run, each naming the thread it runs in), **Recently done** (root threads archived in the last 48 hours). A read, idle thread bound to an automation lives under Scheduled and returns to In progress when it is busy, unread or needs you. Status text ("Working", "Needs you", "Failed", "Queued", "Unread", "Draft") follows bb's own thread-list indicators, drawn with bb's status glyph.
- the project name with a home icon at the top-left of the screen, where a thread's header row sits.

In every thread's header row, the project name precedes the title as a link; clicking it opens the project's home (the New thread screen with that project selected).

Data comes from bb's sidebar thread view (active and archived lifecycles), the bundled Automations plugin's `automations_list` RPC, and `threads.conversationOutline` for last messages (a few at a time, refetched when a thread's `updatedAt` changes). No server code, settings or storage.

Uses BB DOM attributes (`root-compose-main-panel`, `root-compose-compact-home`, `data-promptbox-project-control`, `app-page-header-content-row`, `thread-detail-timeline-panel`); future BB layout changes may require an update. The compact (mobile) home is unchanged. The homepage slot's `projectId` is null on the plain compose route, so the board reads the composer's selected project.

Build: `npm ci --include=dev --ignore-scripts`, `npm run typecheck`, `npm test`, `npm run build`. Install from the repository root: `bb plugin install . --plugin new-thread-layout`.
