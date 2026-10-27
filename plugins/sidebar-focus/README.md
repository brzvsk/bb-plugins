# Sidebar Focus

Two changes to BB's own sidebar thread list, layered on top of it rather than replacing it.

**Focus.** Hovering a group header (a project, Pinned, Threads, or a custom section) shows a small crosshair right after its collapse chevron, in the same muted tone. Clicking it shows only that group, expanding it if it was collapsed (it folds back when you leave the focus, unless you folded it yourself meanwhile); the pressed crosshair stays visible and clicking it again shows everything. Focusing and leaving the focus animate: other groups fade out, the focused one slides into place, and on the way back the others fade in once it has moved (off with the system's reduced-motion setting). The focus is remembered per window.

**In progress, Scheduled, Done.** Each project or section is split into three lines, all 11px muted labels:

- **In progress N** heads the threads left in the group, in BB's usual order. When none are left the line gives way to a **New Task +** line styled like Scheduled that opens the new-session screen in that project (BB's own New thread button).
- **Scheduled N ›** collects threads that an enabled automation runs in (its target thread, or the latest run thread of one that starts a new thread per run) once there is nothing to look at. They stay BB's own rows, sorted by the soonest next run, each with a clock and that run's time: "Today, 12:00", "Tomorrow, 9:00", "11 Nov, 22:00". As soon as BB shows any status on one (unread dot, spinner, question, failed send, draft) it moves back to In progress. The clock and time show on automation threads wherever they are and hide on hover like BB's own status glyph. Collapsed by default, remembered per group.
- **Done N ›** lists threads archived in the last 48 hours, even while the list shows active threads only. Clicking one opens it in place; on hover it has a quick Unarchive button and BB's own thread menu (⋯). Root threads only. When you show archived threads in BB's own list, it steps aside instead of repeating them.

The selected thread keeps the place it had when you opened it, so opening an unread automation thread doesn't move it, and a scheduled thread you open stays visible even while Scheduled is collapsed.

This plugin replaces Automation Clock; don't install both.

Requires BB 0.47.1+ with the built-in Thread list and Automations plugins. Works through BB's sidebar markup, so a sidebar change can break it until updated. No settings, network services or credentials.

Build: `npm ci --include=dev --ignore-scripts`, `npm run typecheck`, `npm test`, `npm run build`. Install: `bb plugin install . --yes`.
