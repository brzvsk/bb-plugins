# Sidebar Focus

Two changes to BB's own sidebar thread list, layered on top of it rather than replacing it.

**Focus.** Hovering a group header (a project, Pinned, Threads, or a custom section) shows a crosshair left of New thread. Clicking it shows only that group; the pressed crosshair stays visible and clicking it again shows everything. The focus is remembered per window.

**Automations.** Threads that an enabled automation runs in (its target thread, or the latest run thread of an automation that starts a new one each run) move to the end of their own project or section once there is nothing to look at, under a small collapsible **Automations · N** line. They stay BB's own rows, with their status, clock and row actions; only their position changes. As soon as BB shows any status on such a thread (unread dot, spinner, question, failed send, draft) it is back in its usual place and order. A group without such threads has no Automations line. Each group remembers whether its line is open.

The selected thread keeps the place it had when you opened it, so opening an unread automation thread doesn't move it, and a tucked thread you open stays visible even while its group's line is collapsed.

Requires BB 0.47.1+ with the built-in Thread list and Automations plugins. Works through BB's sidebar markup, so a sidebar change can break it until updated. No settings, network services or credentials.

Build: `npm ci --include=dev --ignore-scripts`, `npm run typecheck`, `npm test`, `npm run build`. Install: `bb plugin install . --yes`.
