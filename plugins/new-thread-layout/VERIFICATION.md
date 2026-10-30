# Verification

## 0.4.0 — 2026-10-30, BB 0.48.1, Plugin SDK 0.6.104

- `npm run typecheck`, `vitest` (7 tests: grouping, automation binding, ordering, status names, formatting, preview stripping) and `bb plugin build`: passed; reloaded plugin reports running.
- Live BB web UI, headless 1200×760, Creators selected: heading "Working on 🎬 CREATORS" near the top, composer under it, then In progress 4 (titles with last-message first lines, "Working" on the active thread), Scheduled 3 ("Tomorrow, 10:00"-style times, "Runs in <thread>" / "Runs in a new thread"), Recently done 11 ("Done 1 h ago · <last message>"). Top-left of the screen: home icon + "🎬 CREATORS".
- Thread page (BB setup manager): header row reads "⌂ ☸️ COCKPIT / BB setup manager"; clicking the project crumb landed on the New thread screen with ☸️ COCKPIT selected and the Cockpit board (In progress 4, Scheduled 5, Recently done 8).
- The homepage slot's `projectId` prop was null on `/`; the composer's `selection.projectId` matched the chip, so the board reads it.
- 0.4.0 follow-up, same day: both crumbs are plain text links without the home icon; on the New thread screen the top-left project name is a link that reselects the project (live: "☸️ COCKPIT/" in the thread header, then the Cockpit home with its board after clicking the top-left name).
- Layout rework, same day (author's direction: composer at the bottom, Recently done collapsed under In progress, schedule as a context-card-style card on the right): live headless 1400×800 on Cockpit: composer sticky at the bottom, In progress above it, Recently done collapsed with a chevron and expanding in place, the list scrolling away under the composer; the schedule card (5 automations, "Tomorrow, 10:00" style) docked top-right with the column shifted left of it at a 1080px main panel; at narrower panels the same card sits above the list.
- Earlier 0.3.0 checks still apply to the heading: popover anchoring, native chip unchanged, selection sync; disable cleanup (heading, topbar row and crumb holders are removed by their disposers).

Not checked live: compact (mobile) layout; split panes with threads from two projects (the crumb uses the route's project for every visible header row).
