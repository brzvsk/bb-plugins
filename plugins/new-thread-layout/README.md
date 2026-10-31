# Project Home

Turns BB's New thread screen into the project's home, and names the project in the top bar.

On the New thread screen (wide layout):

- with a project selected, the composer sits at the bottom like a thread's and the list above it scrolls away underneath: **Pinned**, then **Idle** (unarchived root threads, live work first, then threads that need you, then by recency; the second line is the first line of the agent's last message, child threads counted). No cards. A read, idle thread bound to an automation leaves Idle and returns when it is busy, unread or needs you.
- a fixed zone right under the top bar, outside the scrolling list, switches between **Scheduled** and **Recently done** (the choice is remembered; a tab with nothing in it is not offered). Scheduled: every upcoming enabled automation of the project, one line each with the thread it runs in (muted; "new thread" for per-run automations) and the next run on the right; a bound line opens its thread; paused automations follow at the end marked Paused; on hover a line offers the bound thread's Mark read/unread and Pin/Unpin (pinning brings it into attention), Pause or Resume, and Open automation; lines are dimmed unless their thread has something unread, then full strength with bb's unread dot instead of the clock. Recently done: root threads archived in the last 48 hours, as thread rows. The zone scrolls on its own past a few rows. On wide screens its tabs sit in the top bar's row, beside the project name.
- the project name at the top-left of the screen, where a thread's header row sits; clicking it returns to the project (reselects it in the composer).
- without a project, the original layout: the composer in the lower middle under a "Working on" heading whose project opens BB's own project dropdown (the native chip under the composer stays visible and works as before).

In every thread's header row, the project name precedes the title as a link; clicking it opens the project (the New thread screen with that project selected).

On a thread, a two-finger trackpad swipe right over the timeline goes back to the project's home, like Chrome's back swipe (gesture and arrow ported from browser-gestures): a dark arrow slides in from the timeline's left edge, lifting with it fully out navigates, pulling back cancels. Horizontal scrollers inside the timeline (wide code blocks) keep the swipe until they reach their left edge; vertical scrolls, swipes left and modifier keys are ignored. A finger held completely still commits after about 0.6 s, since a page cannot see fingers lift.

Data comes from bb's sidebar thread view (active and archived lifecycles), the bundled Automations plugin's `automations_list` RPC, and `threads.conversationOutline` (role `assistant`) for the agent's last messages (a few at a time, refetched when a thread's `updatedAt` changes). No server code, settings or storage.

Uses BB DOM attributes (`root-compose-main-panel`, `root-compose-compact-home`, `data-promptbox-project-control`, `app-page-header-content-row`, `thread-detail-timeline-panel`); future BB layout changes may require an update. The compact (mobile) home is unchanged. The homepage slot's `projectId` is null on the plain compose route, so the board reads the composer's selected project.

Build: `npm ci --include=dev --ignore-scripts`, `npm run typecheck`, `npm test`, `npm run build`. Install from the repository root: `bb plugin install . --plugin new-thread-layout`.
